use super::file_tailer::{FileTailer, MAX_LINE_BYTES};
use super::log_parser::CodexParser;
use crate::models::{
    initial_agents, Agent, AgentStatus, AgentType, LogEntry, LogEntryType, WatcherState,
};
use std::cmp::Reverse;
use std::collections::{BTreeMap, BinaryHeap, HashMap, HashSet};
use std::fs::File;
use std::io::{self, BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

const MAX_TRACKED_FILES: usize = 512;
const MAX_REMEMBERED_FILES: usize = 4096;
const MAX_DIRECTORY_ENTRIES: usize = 100_000;
const MAX_BYTES_PER_POLL: usize = 1024 * 1024;
const MAX_BYTES_PER_FILE: usize = 256 * 1024;
const MAX_LOGS_PER_POLL: usize = 128;

struct TrackedFile {
    tailer: FileTailer,
    parser: CodexParser,
    needs_metadata: bool,
    failed: bool,
}

pub struct PollResult {
    pub logs: Vec<LogEntry>,
    pub agents: Vec<Agent>,
    pub state: WatcherState,
    pub message: &'static str,
}

/// Bounded read-only reconciler. Directory scans and tail reads are separate so
/// native filesystem notification losses cannot strand newly created sessions.
pub struct SessionMonitor {
    root: PathBuf,
    started: SystemTime,
    tracked: BTreeMap<PathBuf, TrackedFile>,
    seen: HashSet<PathBuf>,
    cursor: usize,
    first_scan: bool,
    limited: bool,
    skipped_records: bool,
    discovery_error: Option<io::ErrorKind>,
}

impl SessionMonitor {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            started: SystemTime::now(),
            tracked: BTreeMap::new(),
            seen: HashSet::new(),
            cursor: 0,
            first_scan: true,
            limited: false,
            skipped_records: false,
            discovery_error: None,
        }
    }

    pub fn poll(&mut self, discover: bool) -> PollResult {
        if discover || self.first_scan {
            self.discover();
        }
        let mut logs = Vec::new();
        let mut bytes_left = MAX_BYTES_PER_POLL;
        let mut read_error = false;
        let paths: Vec<_> = self.tracked.keys().cloned().collect();
        let start_index = self.cursor;
        for offset in 0..paths.len() {
            let index = (start_index + offset) % paths.len();
            let path = &paths[index];
            let tracked = self
                .tracked
                .get_mut(path)
                .expect("tracked path is from the same map");
            if tracked.needs_metadata {
                if bytes_left < MAX_LINE_BYTES {
                    self.cursor = index;
                    break;
                }
                match seed_metadata(path, &mut tracked.parser) {
                    Ok((bytes, retry)) => {
                        bytes_left = bytes_left.saturating_sub(bytes);
                        tracked.needs_metadata = retry;
                        if retry {
                            self.cursor = (index + 1) % paths.len();
                            continue;
                        }
                    }
                    Err(_) => {
                        read_error = true;
                        self.cursor = (index + 1) % paths.len();
                        continue;
                    }
                }
            }
            if bytes_left == 0 || logs.len() >= MAX_LOGS_PER_POLL {
                self.cursor = index;
                break;
            }
            match tracked.tailer.read(
                path,
                bytes_left.min(MAX_BYTES_PER_FILE),
                MAX_LOGS_PER_POLL - logs.len(),
            ) {
                Ok(read) => {
                    bytes_left -= read.bytes_read;
                    if read.reset {
                        tracked.parser = CodexParser::default();
                        tracked.failed = false;
                    }
                    self.skipped_records |= read.skipped_lines > 0;
                    for line in read.lines {
                        if let Some(entry) = tracked.parser.parse(&line) {
                            if entry.entry_type == LogEntryType::Error {
                                tracked.failed = true;
                            }
                            if matches!(
                                entry.entry_type,
                                LogEntryType::TaskStart
                                    | LogEntryType::TaskComplete
                                    | LogEntryType::TurnAborted
                            ) {
                                tracked.failed = false;
                            }
                            logs.push(entry);
                        }
                    }
                }
                Err(_) => read_error = true,
            }
            self.cursor = (index + 1) % paths.len();
            // `cursor` changes only the next poll, not this poll's iteration base.
            if bytes_left == 0 || logs.len() >= MAX_LOGS_PER_POLL {
                break;
            }
        }
        let agents = self.agents();
        let (state, message) = if let Some(error) = self.discovery_error {
            if error == io::ErrorKind::NotFound {
                (WatcherState::Missing, "Codex sessions folder is missing. Start Codex to create it; observation will reconnect automatically.")
            } else {
                (WatcherState::Error, "Cannot read the Codex sessions folder. Check the configured path and local file permissions.")
            }
        } else if read_error {
            (
                WatcherState::Error,
                "A Codex rollout could not be read. Observation will retry automatically.",
            )
        } else if self.limited
            || self
                .tracked
                .values()
                .any(|file| file.parser.capacity_exceeded)
        {
            (WatcherState::Error, "Observation capacity reached: 512 recent rollouts, 256 pending calls per rollout, and 4096 remembered paths. Activity may be incomplete.")
        } else if self.skipped_records {
            (WatcherState::Error, "Some oversized or invalid UTF-8 records were skipped. Activity may be incomplete; other records are still observed.")
        } else {
            (WatcherState::Watching, "Watching new Codex activity. Existing history is skipped; only metadata summaries are shown.")
        };
        PollResult {
            logs,
            agents,
            state,
            message,
        }
    }

    fn discover(&mut self) {
        match discover_files(&self.root) {
            Ok(discovery) => {
                self.discovery_error = None;
                self.limited = discovery.limited;
                let files = discovery.files;
                let selected: HashSet<_> = files.iter().map(|(_, path)| path.clone()).collect();
                self.tracked.retain(|path, _| selected.contains(path));
                for (modified, path) in files {
                    if self.tracked.contains_key(&path) {
                        continue;
                    }
                    let remembered = self.seen.contains(&path);
                    let memory_full = self.seen.len() >= MAX_REMEMBERED_FILES;
                    self.limited |= memory_full;
                    // A resumed historical file must not replay its entire history.
                    // Revisited evicted files also baseline instead of duplicating logs.
                    let baseline =
                        self.first_scan || modified <= self.started || remembered || memory_full;
                    let tailer = if baseline {
                        FileTailer::baseline(&path)
                    } else {
                        Ok(FileTailer::default())
                    };
                    match tailer {
                        Ok(tailer) => {
                            if !memory_full {
                                self.seen.insert(path.clone());
                            }
                            self.tracked.insert(
                                path,
                                TrackedFile {
                                    tailer,
                                    parser: CodexParser::default(),
                                    needs_metadata: baseline,
                                    failed: false,
                                },
                            );
                        }
                        Err(error) => self.discovery_error = Some(error.kind()),
                    }
                }
                // Remember unselected history as well: resuming an old rollout
                // changes its mtime but must never make its history look new.
                for path in discovery.observed_paths {
                    if self.seen.len() >= MAX_REMEMBERED_FILES {
                        self.limited = true;
                        break;
                    }
                    self.seen.insert(path);
                }
            }
            Err(error) => {
                self.discovery_error = Some(error.kind());
                if error.kind() == io::ErrorKind::NotFound {
                    self.tracked.clear();
                }
            }
        }
        self.first_scan = false;
    }

    fn agents(&self) -> Vec<Agent> {
        let mut agents = initial_agents();
        let mut pending = HashMap::<AgentType, usize>::new();
        let mut turn_active = false;
        let mut failed = false;
        for tracked in self.tracked.values() {
            for lane in tracked.parser.pending_lanes() {
                *pending.entry(lane).or_default() += 1;
            }
            turn_active |= tracked.parser.turn_active;
            failed |= tracked.failed;
        }
        for agent in &mut agents {
            if let Some(count) = pending.get(&agent.agent_type) {
                agent.status = AgentStatus::Working;
                agent.current_task = Some(if *count == 1 {
                    "1 Codex tool call in progress".into()
                } else {
                    format!("{count} Codex tool calls in progress")
                });
            } else if agent.agent_type == AgentType::Liaison && failed {
                agent.status = AgentStatus::Error;
                agent.current_task = Some("Codex reported an error".into());
            } else if agent.agent_type == AgentType::Architect && turn_active && pending.is_empty()
            {
                agent.status = AgentStatus::Thinking;
                agent.current_task = Some("Codex turn active".into());
            }
        }
        agents
    }
}

fn seed_metadata(path: &Path, parser: &mut CodexParser) -> io::Result<(usize, bool)> {
    let mut bytes = Vec::new();
    BufReader::new(File::open(path)?)
        .take(MAX_LINE_BYTES as u64)
        .read_until(b'\n', &mut bytes)?;
    let complete = bytes.iter().position(|byte| *byte == b'\n');
    if let Some(end) = complete {
        if let Ok(line) = std::str::from_utf8(&bytes[..end]) {
            // Only the header establishes identity; none of the historical events
            // after it are interpreted or emitted.
            let record: serde_json::Value = serde_json::from_str(line).unwrap_or_default();
            if record.get("type").and_then(serde_json::Value::as_str) == Some("session_meta") {
                parser.parse(line);
            }
        }
    }
    Ok((
        bytes.len(),
        complete.is_none() && bytes.len() < MAX_LINE_BYTES,
    ))
}

type Candidates = BinaryHeap<Reverse<(SystemTime, PathBuf)>>;

struct Discovery {
    files: Vec<(SystemTime, PathBuf)>,
    observed_paths: Vec<PathBuf>,
    limited: bool,
}

fn discover_files(root: &Path) -> io::Result<Discovery> {
    let mut selected = Candidates::new();
    let mut observed_paths = Vec::new();
    let mut visited = 0;
    let mut total_files = 0;
    visit_directory(
        root,
        0,
        &mut visited,
        &mut total_files,
        &mut selected,
        &mut observed_paths,
    )?;
    Ok(Discovery {
        files: selected.into_iter().map(|Reverse(item)| item).collect(),
        observed_paths,
        limited: total_files > MAX_TRACKED_FILES,
    })
}

fn visit_directory(
    path: &Path,
    depth: usize,
    visited: &mut usize,
    total_files: &mut usize,
    selected: &mut Candidates,
    observed_paths: &mut Vec<PathBuf>,
) -> io::Result<()> {
    if depth > 16 {
        return Err(io::Error::other(
            "Session directory depth exceeds the observation limit",
        ));
    }
    for entry in std::fs::read_dir(path)? {
        *visited += 1;
        if *visited > MAX_DIRECTORY_ENTRIES {
            return Err(io::Error::other("Session directory entry limit exceeded"));
        }
        let entry = entry?;
        let kind = entry.file_type()?;
        // Never follow directory or file symlinks outside the configured tree.
        if kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            visit_directory(
                &entry.path(),
                depth + 1,
                visited,
                total_files,
                selected,
                observed_paths,
            )?;
        } else if kind.is_file()
            && entry
                .path()
                .extension()
                .is_some_and(|extension| extension == "jsonl")
        {
            let modified = entry
                .metadata()?
                .modified()
                .unwrap_or(SystemTime::UNIX_EPOCH);
            *total_files += 1;
            if observed_paths.len() < MAX_REMEMBERED_FILES {
                observed_paths.push(entry.path());
            }
            selected.push(Reverse((modified, entry.path())));
            if selected.len() > MAX_TRACKED_FILES {
                selected.pop();
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::sync::atomic::{AtomicUsize, Ordering};
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            static NEXT: AtomicUsize = AtomicUsize::new(0);
            Self(std::env::temp_dir().join(format!(
                "codex-monitor-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            )))
        }
        fn write(&self, path: &str, value: &str) -> PathBuf {
            let path = self.0.join(path);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, value).unwrap();
            path
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    const META: &str = "{\"type\":\"session_meta\",\"payload\":{\"id\":\"thread-a\"}}\n";
    const START: &str = "{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_started\"}}\n";
    const CALL: &str = "{\"type\":\"response_item\",\"payload\":{\"type\":\"function_call\",\"call_id\":\"a\",\"name\":\"apply_patch\",\"arguments\":\"SECRET\"}}\n";

    #[test]
    fn missing_folder_recovers_and_discovers_nested_sessions() {
        let fixture = Fixture::new();
        let mut monitor = SessionMonitor::new(fixture.0.clone());
        assert_eq!(monitor.poll(true).state, WatcherState::Missing);
        // Avoid timestamp-resolution dependence when emulating a post-start file.
        monitor.started = SystemTime::UNIX_EPOCH;
        fixture.write(
            "2026/09/12/rollout-a.jsonl",
            &format!("{META}{START}{CALL}"),
        );
        let read = monitor.poll(true);
        assert_eq!(read.state, WatcherState::Watching);
        assert_eq!(read.logs.len(), 3);
        assert_eq!(
            read.agents
                .iter()
                .find(|agent| agent.agent_type == AgentType::Developer)
                .unwrap()
                .status,
            AgentStatus::Working
        );
        assert!(monitor.poll(false).logs.is_empty());
    }

    #[test]
    fn startup_is_idle_then_new_results_preserve_thread_identity() {
        let fixture = Fixture::new();
        let path = fixture.write(
            "2026/09/12/rollout-a.jsonl",
            &format!("{META}{START}{CALL}"),
        );
        let mut monitor = SessionMonitor::new(fixture.0.clone());
        let startup = monitor.poll(true);
        assert!(startup.logs.is_empty());
        assert!(startup
            .agents
            .iter()
            .all(|agent| agent.status == AgentStatus::Idle));
        let result = "{\"type\":\"response_item\",\"payload\":{\"type\":\"function_call_output\",\"call_id\":\"a\",\"output\":\"SECRET\"}}\n";
        std::fs::OpenOptions::new()
            .append(true)
            .open(path)
            .unwrap()
            .write_all(result.as_bytes())
            .unwrap();
        let read = monitor.poll(false);
        assert_eq!(read.logs.len(), 1);
        assert_eq!(read.logs[0].session_id.as_deref(), Some("thread-a"));
        assert!(!read.logs[0].content.contains("SECRET"));
    }

    #[test]
    fn one_threads_completion_does_not_idle_another_threads_lane() {
        let fixture = Fixture::new();
        let mut monitor = SessionMonitor::new(fixture.0.clone());
        monitor.poll(true);
        monitor.started = SystemTime::UNIX_EPOCH;
        let path = fixture.write("rollout-a.jsonl", &format!("{META}{START}{CALL}"));
        fixture.write(
            "nested/rollout-b.jsonl",
            &format!("{}{START}{CALL}", META.replace("thread-a", "thread-b")),
        );
        monitor.poll(true);
        std::fs::OpenOptions::new()
            .append(true)
            .open(path)
            .unwrap()
            .write_all(b"{\"type\":\"event_msg\",\"payload\":{\"type\":\"task_complete\"}}\n")
            .unwrap();
        let read = monitor.poll(false);
        assert_eq!(
            read.agents
                .iter()
                .find(|agent| agent.agent_type == AgentType::Developer)
                .unwrap()
                .status,
            AgentStatus::Working
        );
    }

    #[test]
    fn every_file_is_visited_once_per_poll() {
        let fixture = Fixture::new();
        let mut monitor = SessionMonitor::new(fixture.0.clone());
        monitor.poll(true);
        monitor.started = SystemTime::UNIX_EPOCH;
        for thread in ["a", "b", "c"] {
            fixture.write(
                &format!("rollout-{thread}.jsonl"),
                &format!(
                    "{}{START}",
                    META.replace("thread-a", &format!("thread-{thread}"))
                ),
            );
        }
        let read = monitor.poll(true);
        assert_eq!(read.logs.len(), 6);
        for thread in ["thread-a", "thread-b", "thread-c"] {
            assert_eq!(
                read.logs
                    .iter()
                    .filter(|log| log.session_id.as_deref() == Some(thread))
                    .count(),
                2
            );
        }
        assert!(monitor.poll(false).logs.is_empty());
    }

    #[test]
    fn resuming_unselected_history_does_not_replay_it_as_new() {
        let fixture = Fixture::new();
        let old = fixture.write("old.jsonl", &format!("{META}{START}{CALL}"));
        File::open(&old)
            .unwrap()
            .set_modified(SystemTime::UNIX_EPOCH)
            .unwrap();
        for index in 0..MAX_TRACKED_FILES {
            fixture.write(&format!("recent-{index}.jsonl"), META);
        }
        let mut monitor = SessionMonitor::new(fixture.0.clone());
        assert!(monitor.poll(true).logs.is_empty());
        assert!(!monitor.tracked.contains_key(&old));
        assert!(monitor.seen.contains(&old));
        std::fs::OpenOptions::new()
            .append(true)
            .open(&old)
            .unwrap()
            .write_all(START.as_bytes())
            .unwrap();
        assert!(monitor.poll(true).logs.is_empty());
        assert!(monitor.tracked.contains_key(&old));
        std::fs::OpenOptions::new()
            .append(true)
            .open(&old)
            .unwrap()
            .write_all(CALL.as_bytes())
            .unwrap();
        let read = monitor.poll(false);
        assert_eq!(read.logs.len(), 1);
        assert_eq!(read.logs[0].session_id.as_deref(), Some("thread-a"));
    }

    #[test]
    fn partial_startup_header_is_retried_before_new_activity() {
        let fixture = Fixture::new();
        let split = META.len() / 2;
        let path = fixture.write("rollout-a.jsonl", &META[..split]);
        let mut monitor = SessionMonitor::new(fixture.0.clone());
        assert!(monitor.poll(true).logs.is_empty());
        let rest = format!("{}{START}", &META[split..]);
        std::fs::OpenOptions::new()
            .append(true)
            .open(path)
            .unwrap()
            .write_all(rest.as_bytes())
            .unwrap();
        let read = monitor.poll(false);
        assert_eq!(read.logs.len(), 1);
        assert_eq!(read.logs[0].session_id.as_deref(), Some("thread-a"));
        assert_eq!(read.logs[0].entry_type, LogEntryType::TaskStart);
    }

    #[cfg(unix)]
    #[test]
    fn does_not_follow_symlinks_or_read_non_jsonl_files() {
        let fixture = Fixture::new();
        fixture.write("debug.txt", "PRIVATE");
        let external = Fixture::new();
        let target = external.write("external.jsonl", META);
        std::os::unix::fs::symlink(target, fixture.0.join("linked.jsonl")).unwrap();
        let discovery = discover_files(&fixture.0).unwrap();
        assert!(discovery.files.is_empty());
    }
}
