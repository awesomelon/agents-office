use crate::models::{Agent, AppEvent, LogEntry, LogEntryType};
use crate::watcher::log_parser::{
    determine_agent_status, determine_agent_type, parse_debug_line, parse_session_line,
};
use notify_debouncer_full::{new_debouncer, notify::RecursiveMode, DebouncedEvent};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// File position tracker for reading new content only
struct FileTracker {
    positions: HashMap<PathBuf, u64>,
}

impl FileTracker {
    fn new() -> Self {
        Self {
            positions: HashMap::new(),
        }
    }

    fn read_new_lines(&mut self, path: &PathBuf) -> Vec<String> {
        let mut lines = Vec::new();

        let Ok(mut file) = File::open(path) else {
            return lines;
        };

        let pos = self.positions.get(path).copied().unwrap_or(0);

        if file.seek(SeekFrom::Start(pos)).is_err() {
            return lines;
        }

        let reader = BufReader::new(&file);
        for line in reader.lines().map_while(Result::ok) {
            lines.push(line);
        }

        // Update position
        if let Ok(new_pos) = file.seek(SeekFrom::End(0)) {
            self.positions.insert(path.clone(), new_pos);
        }

        lines
    }
}

/// Start watching Claude Code log files
pub async fn start_watching(app: AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
{
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
                    process_event(&event, &app_handle, &file_tracker).await;
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

async fn process_event(
    event: &DebouncedEvent,
    app: &AppHandle,
    tracker: &Arc<Mutex<FileTracker>>,
) {
    for path in &event.paths {
        // Only process .txt and .jsonl files
        let ext = path.extension().and_then(|e| e.to_str());
        if !matches!(ext, Some("txt") | Some("jsonl") | Some("json")) {
            continue;
        }

        if !path.is_file() {
            continue;
        }

        let mut tracker = tracker.lock().await;
        let new_lines = tracker.read_new_lines(path);

        for line in new_lines {
            let entry = if ext == Some("jsonl") || ext == Some("json") {
                parse_session_line(&line)
            } else {
                parse_debug_line(&line)
            };

            if let Some(entry) = entry {
                // Emit log entry
                let _ = app.emit("app-event", AppEvent::LogEntry(entry.clone()));

                // Emit agent update
                let agent_type = determine_agent_type(&entry);
                let status = determine_agent_status(&entry);

                let agent = Agent {
                    id: format!("{:?}", agent_type).to_lowercase(),
                    agent_type,
                    status,
                    current_task: Some(summarize_current_task(&entry).chars().take(200).collect()),
                    desk_position: get_desk_position(agent_type),
                };

                let _ = app.emit("app-event", AppEvent::AgentUpdate(agent));
            }
        }
    }
}

fn summarize_current_task(entry: &LogEntry) -> String {
    match entry.entry_type {
        LogEntryType::ToolCall => match entry.tool_name.as_deref() {
            Some(name) => format!("Tool call: {name}"),
            None => "Tool call".to_string(),
        },
        LogEntryType::ToolResult => match entry.tool_name.as_deref() {
            Some(name) => format!("Tool result: {name}"),
            None => "Tool result".to_string(),
        },
        LogEntryType::TodoUpdate => "Todo update".to_string(),
        LogEntryType::SessionStart => "Session start".to_string(),
        LogEntryType::SessionEnd => "Session end".to_string(),
        LogEntryType::Error => "Error".to_string(),
        LogEntryType::Message => entry.content.clone(),
    }
}

fn get_desk_position(agent_type: crate::models::AgentType) -> (f32, f32) {
    use crate::models::AgentType;
    match agent_type {
        AgentType::Researcher => (180.0, 160.0),
        AgentType::Coder => (520.0, 160.0),
        AgentType::Reviewer => (180.0, 360.0),
        AgentType::Manager => (520.0, 360.0),
    }
}
