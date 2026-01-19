use crate::models::{Agent, AgentType};

/// Get the Claude home directory path
#[tauri::command]
pub fn get_claude_home() -> Result<String, String> {
    dirs::home_dir()
        .map(|h| h.join(".claude").to_string_lossy().to_string())
        .ok_or_else(|| "Could not find home directory".to_string())
}

/// Get the initial list of agents
#[tauri::command]
pub fn get_agents() -> Vec<Agent> {
    vec![
        Agent::new(
            "researcher".to_string(),
            AgentType::Researcher,
            (180.0, 160.0),
        ),
        Agent::new("coder".to_string(), AgentType::Coder, (520.0, 160.0)),
        Agent::new("reviewer".to_string(), AgentType::Reviewer, (180.0, 360.0)),
        Agent::new("manager".to_string(), AgentType::Manager, (520.0, 360.0)),
    ]
}
