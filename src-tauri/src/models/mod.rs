use serde::{Deserialize, Serialize};

/// Illustrative activity lanes, not identities of individual Codex agents.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentType {
    Explorer,
    Analyzer,
    Architect,
    Developer,
    Operator,
    Validator,
    Connector,
    Liaison,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    #[default]
    Idle,
    Working,
    Thinking,
    Passing,
    Error,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub agent_type: AgentType,
    pub status: AgentStatus,
    pub current_task: Option<String>,
    pub desk_position: (f32, f32),
}

pub fn initial_agents() -> Vec<Agent> {
    use AgentType::*;
    [
        ("explorer", Explorer, (60.0, 130.0)),
        ("analyzer", Analyzer, (150.0, 130.0)),
        ("architect", Architect, (240.0, 130.0)),
        ("developer", Developer, (60.0, 320.0)),
        ("operator", Operator, (150.0, 320.0)),
        ("validator", Validator, (240.0, 320.0)),
        ("connector", Connector, (60.0, 520.0)),
        ("liaison", Liaison, (150.0, 520.0)),
    ]
    .into_iter()
    .map(|(id, agent_type, desk_position)| Agent {
        id: id.into(),
        agent_type,
        desk_position,
        status: AgentStatus::Idle,
        current_task: None,
    })
    .collect()
}

/// Only bounded metadata summaries cross IPC. No prompts, reasoning or output.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: String,
    pub entry_type: LogEntryType,
    pub content: String,
    pub agent_id: Option<String>,
    pub session_id: Option<String>,
    pub tool_name: Option<String>,
    pub call_id: Option<String>,
    pub agent_type: Option<AgentType>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogEntryType {
    ToolCall,
    ToolResult,
    Message,
    Error,
    TodoUpdate,
    SessionStart,
    SessionEnd,
    TaskStart,
    TaskComplete,
    TurnAborted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WatcherState {
    Starting,
    Watching,
    Missing,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatcherStatus {
    pub active: bool,
    pub path: String,
    pub state: WatcherState,
    pub message: String,
    pub revision: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObserverSnapshot {
    pub revision: u64,
    pub watcher: WatcherStatus,
    pub agents: Vec<Agent>,
    pub logs: Vec<LogEntry>,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppEvent {
    pub revision: u64,
    #[serde(flatten)]
    pub event: AppEventKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum AppEventKind {
    WatcherStatus(WatcherStatus),
    BatchUpdate {
        logs: Vec<LogEntry>,
        agents: Vec<Agent>,
    },
}
