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
        Agent::new("reader".to_string(), AgentType::Reader, (115.0, 160.0)),
        Agent::new("searcher".to_string(), AgentType::Searcher, (315.0, 160.0)),
        Agent::new("writer".to_string(), AgentType::Writer, (515.0, 160.0)),
        Agent::new("editor".to_string(), AgentType::Editor, (715.0, 160.0)),
        Agent::new("runner".to_string(), AgentType::Runner, (115.0, 360.0)),
        Agent::new("tester".to_string(), AgentType::Tester, (315.0, 360.0)),
        Agent::new("planner".to_string(), AgentType::Planner, (515.0, 360.0)),
        Agent::new("support".to_string(), AgentType::Support, (715.0, 360.0)),
    ]
}
