use crate::models::{Agent, AgentType};

/// Get the Claude home directory path
#[tauri::command]
pub fn get_claude_home() -> Result<String, String> {
    dirs::home_dir()
        .map(|h| h.join(".claude").to_string_lossy().to_string())
        .ok_or_else(|| "Could not find home directory".to_string())
}

/// Get the initial list of agents (workflow-based)
#[tauri::command]
pub fn get_agents() -> Vec<Agent> {
    vec![
        // Section A: 탐색/분석/설계
        Agent::new("explorer".to_string(), AgentType::Explorer, (60.0, 130.0)),
        Agent::new("analyzer".to_string(), AgentType::Analyzer, (150.0, 130.0)),
        Agent::new("architect".to_string(), AgentType::Architect, (240.0, 130.0)),
        // Section B: 구현/실행/검증
        Agent::new("developer".to_string(), AgentType::Developer, (60.0, 320.0)),
        Agent::new("operator".to_string(), AgentType::Operator, (150.0, 320.0)),
        Agent::new("validator".to_string(), AgentType::Validator, (240.0, 320.0)),
        // Section C: 통합/소통
        Agent::new("connector".to_string(), AgentType::Connector, (60.0, 520.0)),
        Agent::new("liaison".to_string(), AgentType::Liaison, (150.0, 520.0)),
    ]
}
