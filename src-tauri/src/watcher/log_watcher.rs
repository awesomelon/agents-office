use crate::models::{Agent, AppEvent, LogEntry, LogEntryType};
use crate::watcher::log_parser::{
    determine_agent_status, determine_agent_type, parse_debug_line, parse_session_line,
};
use notify_debouncer_full::{new_debouncer, notify::RecursiveMode, DebouncedEvent};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// File position tracker for reading new content only
struct FileTracker {
    positions: HashMap<PathBuf, u64>,
    /// Buffer for a trailing line fragment when a file does not end with '\n'.
    /// This prevents losing/duplicating content across incremental reads.
    partial_lines: HashMap<PathBuf, String>,
}

impl FileTracker {
    fn new() -> Self {
        Self {
            positions: HashMap::new(),
            partial_lines: HashMap::new(),
        }
    }

    fn read_new_lines(&mut self, path: &PathBuf) -> Vec<String> {
        let mut lines: Vec<String> = Vec::new();

        let Ok(metadata) = std::fs::metadata(path) else {
            return lines;
        };
        let file_len = metadata.len();

        let mut pos = self.positions.get(path).copied().unwrap_or(0);
        let original_pos = pos;

        // If the file was truncated/rotated, reset to start and drop any partial tail.
        if pos > file_len {
            tracing::debug!(
                "File truncated/rotated; resetting position: {:?} (pos={}, len={})",
                path,
                pos,
                file_len
            );
            pos = 0;
            self.positions.insert(path.clone(), 0);
            self.partial_lines.remove(path);
        }

        let Ok(mut file) = File::open(path) else {
            return lines;
        };

        if file.seek(SeekFrom::Start(pos)).is_err() {
            return lines;
        }

        // Carry over the previous trailing fragment (no newline at EOF).
        let mut carry = self.partial_lines.remove(path).unwrap_or_default();

        let mut reader = BufReader::new(file);
        let mut buf = String::new();

        loop {
            buf.clear();
            match reader.read_line(&mut buf) {
                Ok(0) => break,
                Ok(_) => {
                    // `read_line` keeps the newline if present.
                    if buf.ends_with('\n') {
                        let line = buf.trim_end_matches(['\n', '\r']);
                        if !carry.is_empty() {
                            carry.push_str(line);
                            lines.push(std::mem::take(&mut carry));
                        } else {
                            lines.push(line.to_string());
                        }
                    } else {
                        // EOF without newline: store as partial, to be continued next time.
                        carry.push_str(&buf);
                    }
                }
                Err(err) => {
                    tracing::warn!("Failed to read line from {:?}: {}", path, err);
                    break;
                }
            }
        }

        // Update to the actual stream position (not EOF), avoiding skipping appended bytes.
        if let Ok(new_pos) = reader.stream_position() {
            if new_pos < original_pos {
                tracing::warn!(
                    "Non-monotonic stream position for {:?}: old_pos={}, new_pos={}",
                    path,
                    original_pos,
                    new_pos
                );
            }
            self.positions.insert(path.clone(), new_pos);
        }

        if !carry.is_empty() {
            self.partial_lines.insert(path.clone(), carry);
        }

        lines
    }
}

/// Start watching Claude Code log files
pub fn start_watching(app: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let claude_home = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".claude");

    if !claude_home.exists() {
        tracing::warn!("Claude home directory does not exist: {:?}", claude_home);
        // Still continue - it might be created later
    }

    let debug_dir = claude_home.join("debug");
    let projects_dir = claude_home.join("projects");

    // Emit initial status
    let _ = app.emit(
        "app-event",
        AppEvent::WatcherStatus {
            active: true,
            path: claude_home.to_string_lossy().to_string(),
        },
    );

    let file_tracker = Arc::new(Mutex::new(FileTracker::new()));
    let app_handle = app.clone();

    // Create debounced watcher
    let (tx, rx) = std::sync::mpsc::channel();
    let mut debouncer = new_debouncer(Duration::from_millis(200), None, tx)?;

    // Watch directories - use debouncer directly since it implements Watcher
    if debug_dir.exists() {
        debouncer.watch(&debug_dir, RecursiveMode::Recursive)?;
        tracing::info!("Watching debug directory: {:?}", debug_dir);
    }

    if projects_dir.exists() {
        debouncer.watch(&projects_dir, RecursiveMode::Recursive)?;
        tracing::info!("Watching projects directory: {:?}", projects_dir);
    }

    // Also watch the claude home for new directories
    if claude_home.exists() {
        debouncer.watch(&claude_home, RecursiveMode::NonRecursive)?;
    }

    // Process events
    loop {
        match rx.recv() {
            Ok(Ok(events)) => {
                for event in events {
                    process_event(&event, &app_handle, &file_tracker);
                }
            }
            Ok(Err(errors)) => {
                for error in errors {
                    tracing::error!("Watch error: {:?}", error);
                }
            }
            Err(e) => {
                tracing::error!("Channel error: {:?}", e);
                break;
            }
        }
    }

    Ok(())
}

fn process_event(event: &DebouncedEvent, app: &AppHandle, tracker: &Arc<Mutex<FileTracker>>) {
    let started_at = std::time::Instant::now();
    // Collect all logs and agents for batch emit
    let mut all_logs: Vec<LogEntry> = Vec::new();
    // Deduplicate agent updates within a batch to reduce IPC payload.
    let mut agents_by_id: HashMap<String, Agent> = HashMap::new();
    let mut total_lines_read: usize = 0;
    let mut total_entries_parsed: usize = 0;

    for path in &event.paths {
        // Only process .txt and .jsonl files
        let ext = path.extension().and_then(|e| e.to_str());
        if !matches!(ext, Some("txt") | Some("jsonl") | Some("json")) {
            continue;
        }

        if !path.is_file() {
            continue;
        }

        let new_lines = {
            let mut tracker = tracker
                .lock()
                .expect("FileTracker mutex poisoned in watcher thread");
            tracker.read_new_lines(path)
        };
        total_lines_read += new_lines.len();

        for line in new_lines {
            let entry = if ext == Some("jsonl") || ext == Some("json") {
                parse_session_line(&line)
            } else {
                parse_debug_line(&line)
            };

            if let Some(entry) = entry {
                total_entries_parsed += 1;

                // Collect agent update (dedup within batch).
                let agent_type = determine_agent_type(&entry);
                let status = determine_agent_status(&entry);

                let agent = Agent {
                    id: agent_id_for_type(agent_type).to_string(),
                    agent_type,
                    status,
                    current_task: Some(summarize_current_task(&entry)),
                    desk_position: get_desk_position(agent_type),
                };

                agents_by_id.insert(agent.id.clone(), agent);

                // Collect log entry (move, no clone).
                all_logs.push(entry);
            }
        }
    }

    // Emit single batch update instead of individual events
    if !all_logs.is_empty() {
        let agents: Vec<Agent> = agents_by_id.into_values().collect();
        tracing::debug!(
            "BatchUpdate emit: paths={}, lines_read={}, entries_parsed={}, logs={}, agents={}, elapsed_ms={}",
            event.paths.len(),
            total_lines_read,
            total_entries_parsed,
            all_logs.len(),
            agents.len(),
            started_at.elapsed().as_millis()
        );
        let _ = app.emit(
            "app-event",
            AppEvent::BatchUpdate {
                logs: all_logs,
                agents,
            },
        );
    }
}

fn summarize_current_task(entry: &LogEntry) -> String {
    let summary: String = match entry.entry_type {
        LogEntryType::ToolCall | LogEntryType::ToolResult => {
            let prefix = if entry.entry_type == LogEntryType::ToolCall {
                "Tool call"
            } else {
                "Tool result"
            };
            entry
                .tool_name
                .as_deref()
                .map_or_else(|| prefix.to_string(), |name| format!("{prefix}: {name}"))
        }
        LogEntryType::TodoUpdate => "Todo update".to_string(),
        LogEntryType::SessionStart => "Session start".to_string(),
        LogEntryType::SessionEnd => "Session end".to_string(),
        LogEntryType::Error => "Error".to_string(),
        // Avoid cloning the full message; keep only a short preview.
        LogEntryType::Message => entry.content.chars().take(200).collect(),
    };

    // Hard cap to keep payload small even if other branches produce longer strings.
    summary.chars().take(200).collect()
}

fn agent_id_for_type(agent_type: crate::models::AgentType) -> &'static str {
    use crate::models::AgentType;
    match agent_type {
        AgentType::Explorer => "explorer",
        AgentType::Analyzer => "analyzer",
        AgentType::Architect => "architect",
        AgentType::Developer => "developer",
        AgentType::Operator => "operator",
        AgentType::Validator => "validator",
        AgentType::Connector => "connector",
        AgentType::Liaison => "liaison",
    }
}

/// Desk positions matching TypeScript DESK_CONFIGS (workflow-based).
/// Note: These values are currently unused by frontend (which uses its own DESK_CONFIGS),
/// but kept for API consistency.
fn get_desk_position(agent_type: crate::models::AgentType) -> (f32, f32) {
    use crate::models::AgentType;
    // Layout: 3-3-2 vertical arrangement (workflow-based)
    // Section A (Y=130): Explorer, Analyzer, Architect
    // Section B (Y=320): Developer, Operator, Validator
    // Section C (Y=520): Connector, Liaison
    match agent_type {
        AgentType::Explorer => (60.0, 130.0),
        AgentType::Analyzer => (150.0, 130.0),
        AgentType::Architect => (240.0, 130.0),
        AgentType::Developer => (60.0, 320.0),
        AgentType::Operator => (150.0, 320.0),
        AgentType::Validator => (240.0, 320.0),
        AgentType::Connector => (60.0, 520.0),
        AgentType::Liaison => (150.0, 520.0),
    }
}
