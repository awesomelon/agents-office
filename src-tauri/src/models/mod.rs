use serde::{Deserialize, Serialize};

/// Type of agent in the office
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentType {
    Researcher,
    Coder,
    Reviewer,
    Manager,
}

impl Default for AgentType {
    fn default() -> Self {
        Self::Coder
    }
}

/// Current status of an agent
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

/// An agent in the office
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub agent_type: AgentType,
    pub status: AgentStatus,
    pub current_task: Option<String>,
    pub desk_position: (f32, f32),
}

impl Agent {
    pub fn new(id: String, agent_type: AgentType, desk_position: (f32, f32)) -> Self {
        Self {
            id,
            agent_type,
            status: AgentStatus::Idle,
            current_task: None,
            desk_position,
        }
    }
}

/// A log entry from Claude Code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub entry_type: LogEntryType,
    pub content: String,
    pub agent_id: Option<String>,
    pub tool_name: Option<String>,
}

/// Type of log entry
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
}

/// Event sent to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum AppEvent {
    LogEntry(LogEntry),
    AgentUpdate(Agent),
    SessionStart { session_id: String },
    SessionEnd { session_id: String },
    WatcherStatus { active: bool, path: String },
}
