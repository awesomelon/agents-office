use crate::models::{AgentStatus, AgentType, LogEntry, LogEntryType};

/// Parse a line from a debug log file
pub fn parse_debug_line(line: &str) -> Option<LogEntry> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }

    // Extract timestamp if present (format: YYYY-MM-DD HH:MM:SS)
    let (timestamp, content) = extract_timestamp(line);

    // Determine entry type
    let (entry_type, tool_name) = determine_entry_type(content);

    Some(LogEntry {
        timestamp: timestamp.unwrap_or_default(),
        entry_type,
        content: content.to_string(),
        agent_id: None,
        tool_name,
    })
}

/// Parse a line from a session JSONL file
pub fn parse_session_line(line: &str) -> Option<LogEntry> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }

    // Try to parse as JSON
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
        let entry_type = match json.get("type").and_then(|v| v.as_str()) {
            Some("tool_use") => LogEntryType::ToolCall,
            Some("tool_result") => LogEntryType::ToolResult,
            Some("message") => LogEntryType::Message,
            Some("error") => LogEntryType::Error,
            _ => LogEntryType::Message,
        };

        let tool_name = json
            .get("name")
            .or_else(|| json.get("tool"))
            .and_then(|v| v.as_str())
            .map(String::from);

        let content = json
            .get("content")
            .or_else(|| json.get("message"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let timestamp = json
            .get("timestamp")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        return Some(LogEntry {
            timestamp,
            entry_type,
            content,
            agent_id: json
                .get("agent_id")
                .and_then(|v| v.as_str())
                .map(String::from),
            tool_name,
        });
    }

    // Fall back to text parsing
    parse_debug_line(line)
}

/// Determine which agent type should handle this log entry
pub fn determine_agent_type(entry: &LogEntry) -> AgentType {
    if let Some(ref tool) = entry.tool_name {
        // Avoid allocating `to_lowercase()` for common tool names.
        if tool.eq_ignore_ascii_case("read") {
            return AgentType::Reader;
        }
        if tool.eq_ignore_ascii_case("glob")
            || tool.eq_ignore_ascii_case("grep")
            || tool.eq_ignore_ascii_case("websearch")
            || tool.eq_ignore_ascii_case("webfetch")
        {
            return AgentType::Searcher;
        }
        if tool.eq_ignore_ascii_case("write") {
            return AgentType::Writer;
        }
        if tool.eq_ignore_ascii_case("edit") || tool.eq_ignore_ascii_case("notebookedit") {
            return AgentType::Editor;
        }
        if tool.eq_ignore_ascii_case("bash") {
            // Bash: context-dependent (Runner vs Tester)
            // We keep a single lowercase allocation only for this branch.
            let content = entry.content.to_ascii_lowercase();
            // Tester: git, test, npm, pnpm, yarn, cargo commands
            if content.contains("git")
                || content.contains("test")
                || content.contains("npm")
                || content.contains("pnpm")
                || content.contains("yarn")
                || content.contains("cargo")
            {
                return AgentType::Tester;
            }
            return AgentType::Runner;
        }
        if tool.eq_ignore_ascii_case("todowrite") || tool.eq_ignore_ascii_case("task") {
            return AgentType::Planner;
        }
        if tool.eq_ignore_ascii_case("askuserquestion") {
            return AgentType::Support;
        }
        AgentType::Editor
    } else if entry.entry_type == LogEntryType::Error {
        AgentType::Support
    } else {
        AgentType::Editor
    }
}

/// Determine the agent status based on entry type
pub fn determine_agent_status(entry: &LogEntry) -> AgentStatus {
    match entry.entry_type {
        LogEntryType::ToolCall => AgentStatus::Working,
        LogEntryType::ToolResult => AgentStatus::Idle,
        LogEntryType::Error => AgentStatus::Error,
        LogEntryType::Message => AgentStatus::Thinking,
        _ => AgentStatus::Idle,
    }
}

fn extract_timestamp(line: &str) -> (Option<String>, &str) {
    // Simple timestamp extraction - looks for ISO-like format at the start
    if line.len() >= 19 && line.chars().take(4).all(|c| c.is_ascii_digit()) {
        let potential_ts = &line[..19];
        if potential_ts.contains('-') && (potential_ts.contains(':') || potential_ts.contains('T'))
        {
            return (Some(potential_ts.to_string()), line[20..].trim());
        }
    }
    (None, line)
}

fn determine_entry_type(content: &str) -> (LogEntryType, Option<String>) {
    // Fast path: avoid regex for tool call/result lines.
    if let Some(rest) = content.strip_prefix("Tool call: ") {
        let tool_name = rest.split_whitespace().next().map(|s| s.to_string());
        return (LogEntryType::ToolCall, tool_name);
    }
    if let Some(rest) = content.strip_prefix("Tool result: ") {
        let tool_name = rest.split_whitespace().next().map(|s| s.to_string());
        return (LogEntryType::ToolResult, tool_name);
    }

    // Check for errors
    if content.contains("[ERROR]")
        || content.contains("[error]")
        || content.contains("Error:")
        || content.contains("error:")
    {
        return (LogEntryType::Error, None);
    }

    // Check for todo updates
    if content.contains("TodoWrite")
        || content.contains("Task:")
        || content.contains("todo")
        || content.contains("TODO")
    {
        return (LogEntryType::TodoUpdate, Some("TodoWrite".to_string()));
    }

    // Check for tool names in content
    let known_tools = [
        "Read", "Write", "Edit", "Glob", "Grep", "Bash", "WebSearch", "WebFetch", "Task",
        "TodoWrite",
    ];
    for tool in known_tools {
        if content.contains(tool) {
            return (LogEntryType::ToolCall, Some(tool.to_string()));
        }
    }

    (LogEntryType::Message, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tool_call() {
        let line = "Tool call: Read";
        let entry = parse_debug_line(line).unwrap();
        assert_eq!(entry.entry_type, LogEntryType::ToolCall);
        assert_eq!(entry.tool_name, Some("Read".to_string()));
    }

    #[test]
    fn test_determine_agent_type_searcher() {
        let entry = LogEntry {
            timestamp: String::new(),
            entry_type: LogEntryType::ToolCall,
            content: String::new(),
            agent_id: None,
            tool_name: Some("Grep".to_string()),
        };
        assert_eq!(determine_agent_type(&entry), AgentType::Searcher);
    }
}
