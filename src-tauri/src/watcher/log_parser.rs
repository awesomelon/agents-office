use crate::models::{AgentType, LogEntry, LogEntryType};
use serde_json::Value;
use std::collections::{HashMap, VecDeque};

const MAX_PENDING_CALLS: usize = 256;

#[derive(Debug, Clone)]
struct PendingCall {
    name: String,
    lane: AgentType,
}

/// One parser per rollout file. Call ids are scoped to their thread.
#[derive(Default)]
pub struct CodexParser {
    pub session_id: Option<String>,
    pub turn_active: bool,
    turn_id: Option<String>,
    pending: HashMap<String, PendingCall>,
    order: VecDeque<String>,
    pub capacity_exceeded: bool,
}

impl CodexParser {
    pub fn pending_lanes(&self) -> impl Iterator<Item = AgentType> + '_ {
        self.pending.values().map(|call| call.lane)
    }

    pub fn parse(&mut self, line: &str) -> Option<LogEntry> {
        let record: Value = serde_json::from_str(line).ok()?;
        let payload = record.get("payload")?;
        let timestamp = record
            .get("timestamp")
            .and_then(Value::as_str)
            .filter(|value| value.len() <= 64)
            .unwrap_or_default()
            .to_owned();
        let mut tool = None;
        let mut call_id = None;
        let (entry_type, lane, content) = match record.get("type")?.as_str()? {
            "session_meta" => {
                let id = metadata_id(payload.get("id")?)?;
                if self.session_id.as_deref() == Some(&id) {
                    return None;
                }
                self.clear_turn();
                self.turn_id = None;
                self.session_id = Some(id);
                (
                    LogEntryType::SessionStart,
                    AgentType::Liaison,
                    "Codex session detected".into(),
                )
            }
            "response_item" => match payload.get("type")?.as_str()? {
                "function_call" | "custom_tool_call" => {
                    let name = tool_name(payload.get("name")?.as_str()?)?;
                    let id = metadata_id(payload.get("call_id")?)?;
                    let lane = classify_tool(&name, payload);
                    if !self.track_call(&id, &name, lane) {
                        return None;
                    }
                    self.turn_active = true;
                    tool = Some(name.clone());
                    call_id = Some(id);
                    (
                        LogEntryType::ToolCall,
                        lane,
                        format!("Tool started: {name}"),
                    )
                }
                "function_call_output" | "custom_tool_call_output" => {
                    let id = payload.get("call_id").and_then(metadata_id);
                    let pending = id.as_ref().and_then(|id| self.pending.remove(id));
                    if let Some(ref id) = id {
                        self.order.retain(|item| item != id);
                    }
                    let (name, lane) = pending
                        .map(|call| (Some(call.name), call.lane))
                        .unwrap_or_else(|| {
                            let name = payload
                                .get("name")
                                .and_then(Value::as_str)
                                .and_then(tool_name);
                            let lane = name
                                .as_ref()
                                .map(|name| classify_tool(name, payload))
                                .unwrap_or(AgentType::Operator);
                            (name, lane)
                        });
                    let summary = name
                        .as_ref()
                        .map(|name| format!("Tool returned: {name}"))
                        .unwrap_or_else(|| "Tool returned (call began before observation)".into());
                    tool = name;
                    call_id = id;
                    // An arbitrary output string containing "error" is not a failure signal.
                    (LogEntryType::ToolResult, lane, summary)
                }
                "web_search_call" => {
                    let id = payload.get("id").and_then(metadata_id);
                    let status = payload.get("status").and_then(Value::as_str);
                    tool = Some("web_search".into());
                    call_id = id.clone();
                    match status {
                        Some("in_progress" | "searching") => {
                            if let Some(id) = id.as_deref() {
                                if !self.track_call(id, "web_search", AgentType::Analyzer) {
                                    return None;
                                }
                            }
                            self.turn_active = true;
                            (
                                LogEntryType::ToolCall,
                                AgentType::Analyzer,
                                "Web search started".into(),
                            )
                        }
                        Some("completed" | "failed") => {
                            if let Some(id) = id.as_ref() {
                                self.pending.remove(id);
                                self.order.retain(|item| item != id);
                            }
                            if status == Some("failed") {
                                (
                                    LogEntryType::Error,
                                    AgentType::Analyzer,
                                    "Web search failed".into(),
                                )
                            } else {
                                (
                                    LogEntryType::ToolResult,
                                    AgentType::Analyzer,
                                    "Web search returned".into(),
                                )
                            }
                        }
                        // Some providers omit status. Do not infer completion from that.
                        _ => (
                            LogEntryType::Message,
                            AgentType::Analyzer,
                            "Web search activity recorded".into(),
                        ),
                    }
                }
                // Messages are represented once by persisted event_msg records.
                // Never turn internal reasoning or unknown records into UI messages.
                _ => return None,
            },
            "event_msg" => match payload.get("type")?.as_str()? {
                "task_started" | "turn_started" => {
                    let id = payload.get("turn_id").and_then(metadata_id);
                    if id.is_some() && id == self.turn_id {
                        return None;
                    }
                    self.clear_turn();
                    self.turn_id = id;
                    self.turn_active = true;
                    (
                        LogEntryType::TaskStart,
                        AgentType::Architect,
                        "Codex turn started".into(),
                    )
                }
                "task_complete" | "turn_complete" => {
                    if self.is_other_turn(payload) {
                        return None;
                    }
                    self.clear_turn();
                    if payload.get("error").is_some_and(|error| !error.is_null()) {
                        (
                            LogEntryType::Error,
                            AgentType::Liaison,
                            "Codex turn failed".into(),
                        )
                    } else {
                        (
                            LogEntryType::TaskComplete,
                            AgentType::Liaison,
                            "Codex turn completed".into(),
                        )
                    }
                }
                "turn_aborted" => {
                    if self.is_other_turn(payload) {
                        return None;
                    }
                    self.clear_turn();
                    (
                        LogEntryType::TurnAborted,
                        AgentType::Liaison,
                        "Codex turn stopped".into(),
                    )
                }
                "error" => (
                    LogEntryType::Error,
                    AgentType::Liaison,
                    "Codex reported an error".into(),
                ),
                "user_message" => (
                    LogEntryType::Message,
                    AgentType::Liaison,
                    "User message received".into(),
                ),
                "agent_message" => (
                    LogEntryType::Message,
                    AgentType::Liaison,
                    "Codex message delivered".into(),
                ),
                "item_completed" => {
                    let thread = payload.get("thread_id").and_then(metadata_id);
                    if thread.is_some() && self.session_id.is_some() && thread != self.session_id {
                        return None;
                    }
                    if self.is_other_turn(payload) {
                        return None;
                    }
                    let item = payload.get("item")?;
                    match item.get("type")?.as_str()? {
                        "UserMessage" => (
                            LogEntryType::Message,
                            AgentType::Liaison,
                            "User message received".into(),
                        ),
                        "AgentMessage" => (
                            LogEntryType::Message,
                            AgentType::Liaison,
                            "Codex message delivered".into(),
                        ),
                        "CommandExecution" | "DynamicToolCall" | "McpToolCall" | "FileChange" => {
                            // Raw response outputs already represent results. Emit only an
                            // additional explicit failure signal from this durable UI record.
                            if !has_explicit_failure(item) {
                                return None;
                            }
                            call_id = item.get("id").and_then(metadata_id);
                            let pending = call_id.as_ref().and_then(|id| self.pending.get(id));
                            let (name, fallback_lane) = match item.get("type")?.as_str()? {
                                "CommandExecution" => {
                                    (Some("exec_command".into()), AgentType::Operator)
                                }
                                "FileChange" => (Some("apply_patch".into()), AgentType::Developer),
                                "McpToolCall" => (
                                    item.get("tool").and_then(Value::as_str).and_then(tool_name),
                                    AgentType::Connector,
                                ),
                                _ => (
                                    item.get("tool").and_then(Value::as_str).and_then(tool_name),
                                    AgentType::Operator,
                                ),
                            };
                            let lane = pending.map(|call| call.lane).unwrap_or(fallback_lane);
                            tool = pending.map(|call| call.name.clone()).or(name);
                            let summary =
                                if item.get("status").and_then(Value::as_str) == Some("declined") {
                                    "Tool execution declined"
                                } else {
                                    "Tool execution failed"
                                };
                            (LogEntryType::Error, lane, summary.into())
                        }
                        _ => return None,
                    }
                }
                _ => return None,
            },
            _ => return None,
        };
        Some(LogEntry {
            id: String::new(),
            timestamp,
            entry_type,
            content,
            agent_id: self.session_id.clone(),
            session_id: self.session_id.clone(),
            tool_name: tool,
            call_id,
            agent_type: Some(lane),
        })
    }

    fn clear_turn(&mut self) {
        self.turn_active = false;
        self.pending.clear();
        self.order.clear();
        self.capacity_exceeded = false;
    }

    fn track_call(&mut self, id: &str, name: &str, lane: AgentType) -> bool {
        if self.pending.contains_key(id) {
            return false;
        }
        if self.pending.len() >= MAX_PENDING_CALLS {
            if let Some(oldest) = self.order.pop_front() {
                self.pending.remove(&oldest);
            }
            self.capacity_exceeded = true;
        }
        self.pending.insert(
            id.to_owned(),
            PendingCall {
                name: name.to_owned(),
                lane,
            },
        );
        self.order.push_back(id.to_owned());
        true
    }

    fn is_other_turn(&self, payload: &Value) -> bool {
        match (
            self.turn_id.as_deref(),
            payload.get("turn_id").and_then(Value::as_str),
        ) {
            (Some(current), Some(incoming)) => current != incoming,
            _ => false,
        }
    }
}

fn has_explicit_failure(item: &Value) -> bool {
    matches!(
        item.get("status").and_then(Value::as_str),
        Some("failed" | "declined")
    ) || item.get("success").and_then(Value::as_bool) == Some(false)
        || item
            .get("exit_code")
            .and_then(Value::as_i64)
            .is_some_and(|code| code != 0)
        || item
            .get("result")
            .and_then(|result| result.get("isError"))
            .and_then(Value::as_bool)
            == Some(true)
}

fn metadata_id(value: &Value) -> Option<String> {
    let value = value.as_str()?;
    (!value.is_empty()
        && value.len() <= 160
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_-:.".contains(c)))
    .then(|| value.to_owned())
}

fn tool_name(name: &str) -> Option<String> {
    (!name.is_empty()
        && name.len() <= 100
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_-.:/".contains(c)))
    .then(|| name.to_owned())
}

fn classify_tool(name: &str, payload: &Value) -> AgentType {
    use AgentType::*;
    let name = name.strip_prefix("functions.").unwrap_or(name);
    match name {
        "apply_patch" => Developer,
        "update_plan" | "spawn_agent" | "send_input" | "wait_agent" | "close_agent" => Architect,
        "request_user_input" => Liaison,
        "view_image" => Explorer,
        "exec_command" | "shell" | "shell_command" => {
            // Classification examines only the first command, never emits it.
            let arguments = payload
                .get("arguments")
                .and_then(Value::as_str)
                .and_then(|value| serde_json::from_str::<Value>(value).ok());
            let command = arguments
                .as_ref()
                .and_then(|value| value.get("cmd").or_else(|| value.get("command")))
                .and_then(Value::as_str)
                .unwrap_or_default();
            let mut words = command.split_whitespace();
            let executable = words
                .next()
                .unwrap_or_default()
                .rsplit('/')
                .next()
                .unwrap_or_default();
            let subcommand = words.next().unwrap_or_default();
            match (executable, subcommand) {
                ("rg" | "grep", _) => Analyzer,
                ("ls" | "find" | "cat" | "head" | "tail" | "pwd", _) => Explorer,
                ("pytest" | "vitest" | "jest" | "tsc" | "eslint", _) => Validator,
                ("cargo", "test" | "check" | "clippy") => Validator,
                ("npm" | "pnpm" | "yarn" | "bun", "test" | "lint" | "typecheck") => Validator,
                _ => Operator,
            }
        }
        "write_stdin" => Operator,
        _ if name.starts_with("mcp__") || name.contains("__") => Connector,
        _ if name.starts_with("web.") || name == "web" => Analyzer,
        _ => Operator,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn line(kind: &str, payload: Value) -> String {
        json!({"timestamp":"2026-09-12T08:00:00Z","type":kind,"payload":payload}).to_string()
    }

    #[test]
    fn correlates_custom_calls_and_ignores_private_content() {
        let mut parser = CodexParser::default();
        parser
            .parse(&line(
                "session_meta",
                json!({"id":"thread-a","session_id":"shared-parent"}),
            ))
            .unwrap();
        let call = parser.parse(&line("response_item", json!({"type":"custom_tool_call","call_id":"call-a","name":"apply_patch","input":"SECRET_SOURCE"}))).unwrap();
        assert_eq!(call.agent_type, Some(AgentType::Developer));
        let output = parser.parse(&line("response_item", json!({"type":"custom_tool_call_output","call_id":"call-a","output":"SECRET_OUTPUT error"}))).unwrap();
        assert_eq!(output.tool_name.as_deref(), Some("apply_patch"));
        assert_eq!(output.session_id.as_deref(), Some("thread-a"));
        assert_eq!(output.entry_type, LogEntryType::ToolResult);
        assert_eq!(parser.pending_lanes().count(), 0);
        assert!(!serde_json::to_string(&output).unwrap().contains("SECRET"));
    }

    #[test]
    fn call_ids_are_isolated_and_parallel_results_do_not_finish_other_calls() {
        let mut a = CodexParser::default();
        let mut b = CodexParser::default();
        a.parse(&line(
            "response_item",
            json!({"type":"function_call","call_id":"same","name":"apply_patch","arguments":"{}"}),
        ));
        a.parse(&line("response_item", json!({"type":"function_call","call_id":"second","name":"exec_command","arguments":"{\"cmd\":\"cargo test SECRET\"}"})));
        b.parse(&line(
            "response_item",
            json!({"type":"function_call","call_id":"same","name":"update_plan","arguments":"{}"}),
        ));
        let result = b
            .parse(&line(
                "response_item",
                json!({"type":"function_call_output","call_id":"same","output":"private"}),
            ))
            .unwrap();
        assert_eq!(result.agent_type, Some(AgentType::Architect));
        a.parse(&line(
            "response_item",
            json!({"type":"function_call_output","call_id":"same","output":"private"}),
        ));
        assert_eq!(
            a.pending_lanes().collect::<Vec<_>>(),
            vec![AgentType::Validator]
        );
    }

    #[test]
    fn terminal_events_clear_inflight_calls_and_do_not_expose_error_text() {
        for terminal in ["task_complete", "turn_complete", "turn_aborted"] {
            let mut parser = CodexParser::default();
            parser.parse(&line("event_msg", json!({"type":"task_started"})));
            parser.parse(&line("response_item", json!({"type":"function_call","call_id":"a","name":"exec_command","arguments":"{}"})));
            let entry = parser.parse(&line("event_msg", json!({"type":terminal,"error":{"message":"SECRET_ERROR"},"last_agent_message":"SECRET_FINAL"}))).unwrap();
            assert!(!parser.turn_active);
            assert_eq!(parser.pending_lanes().count(), 0);
            assert!(!entry.content.contains("SECRET"));
        }
    }

    #[test]
    fn malformed_unknown_reasoning_and_tokens_are_not_messages() {
        let mut parser = CodexParser::default();
        for input in [
            "not json",
            "{}",
            "{\"type\":\"new_future_type\",\"payload\":{}}",
        ] {
            assert!(parser.parse(input).is_none());
        }
        for kind in ["reasoning", "message", "future_tool"] {
            assert!(parser
                .parse(&line(
                    "response_item",
                    json!({"type":kind,"content":"SECRET"})
                ))
                .is_none());
        }
        assert!(parser
            .parse(&line(
                "event_msg",
                json!({"type":"token_count","info":"SECRET"})
            ))
            .is_none());
    }

    #[test]
    fn paginated_messages_are_metadata_only_and_do_not_complete_turns() {
        let mut parser = CodexParser::default();
        parser.parse(&line("event_msg", json!({"type":"turn_started"})));
        let entry = parser.parse(&line("event_msg", json!({"type":"item_completed","item":{"type":"AgentMessage","text":"SECRET","phase":"commentary"}}))).unwrap();
        assert_eq!(entry.content, "Codex message delivered");
        assert!(parser.turn_active);
    }

    #[test]
    fn pending_memory_is_bounded_and_duplicate_calls_are_ignored() {
        let mut parser = CodexParser::default();
        for id in 0..300 {
            parser.parse(&line("response_item", json!({"type":"function_call","call_id":format!("call-{id}"),"name":"exec_command","arguments":"{}"})));
        }
        assert_eq!(parser.pending.len(), MAX_PENDING_CALLS);
        assert_eq!(parser.order.len(), MAX_PENDING_CALLS);
        assert!(parser.capacity_exceeded);
        assert!(parser.parse(&line("response_item", json!({"type":"function_call","call_id":"call-299","name":"exec_command","arguments":"{}"}))).is_none());
    }

    #[test]
    fn hosted_web_search_records_are_private_and_clear_only_their_call() {
        let mut parser = CodexParser::default();
        parser.parse(&line("response_item", json!({"type":"function_call","call_id":"edit-a","name":"apply_patch","arguments":"{}"})));
        let started = parser
            .parse(&line(
                "response_item",
                json!({
                    "type":"web_search_call","id":"ws-a","status":"in_progress",
                    "action":{"type":"search","query":"SECRET_QUERY"}
                }),
            ))
            .unwrap();
        assert_eq!(started.entry_type, LogEntryType::ToolCall);
        assert_eq!(started.agent_type, Some(AgentType::Analyzer));
        let completed = parser
            .parse(&line(
                "response_item",
                json!({
                    "type":"web_search_call","id":"ws-a","status":"completed",
                    "action":{"type":"open_page","url":"https://example.test/SECRET"}
                }),
            ))
            .unwrap();
        assert_eq!(completed.entry_type, LogEntryType::ToolResult);
        assert_eq!(completed.call_id.as_deref(), Some("ws-a"));
        assert_eq!(
            parser.pending_lanes().collect::<Vec<_>>(),
            vec![AgentType::Developer]
        );
        assert!(parser.turn_active);
        assert!(!serde_json::to_string(&[started, completed])
            .unwrap()
            .contains("SECRET"));
        let unknown = parser
            .parse(&line(
                "response_item",
                json!({"type":"web_search_call","id":"ws-unknown"}),
            ))
            .unwrap();
        assert_eq!(unknown.entry_type, LogEntryType::Message);
    }

    #[test]
    fn modern_completed_items_expose_explicit_failures_without_private_output() {
        let mut parser = CodexParser::default();
        parser.parse(&line("session_meta", json!({"id":"thread-a"})));
        parser.parse(&line(
            "event_msg",
            json!({"type":"task_started","turn_id":"turn-a"}),
        ));
        parser.parse(&line("response_item", json!({"type":"function_call","call_id":"call-a","name":"exec_command","arguments":"{\"cmd\":\"cargo test\"}"})));
        let failed = parser.parse(&line("event_msg", json!({
            "type":"item_completed","thread_id":"thread-a","turn_id":"turn-a","completed_at_ms":1,
            "item":{"type":"CommandExecution","id":"call-a","command":["cargo","test"],
                "cwd":"/example/project","parsed_cmd":[],"source":"agent",
                "status":"failed","exit_code":1,"stderr":"SECRET_STDERR"}
        }))).unwrap();
        assert_eq!(failed.entry_type, LogEntryType::Error);
        assert_eq!(failed.agent_type, Some(AgentType::Validator));
        assert_eq!(failed.call_id.as_deref(), Some("call-a"));
        assert!(!serde_json::to_string(&failed).unwrap().contains("SECRET"));
        assert!(parser.turn_active);
        // The raw output still closes the original call and retains its lane.
        let output = parser
            .parse(&line(
                "response_item",
                json!({"type":"function_call_output","call_id":"call-a","output":"SECRET_STDERR"}),
            ))
            .unwrap();
        assert_eq!(output.agent_type, Some(AgentType::Validator));
        assert_eq!(parser.pending_lanes().count(), 0);

        for item in [
            json!({"type":"DynamicToolCall","id":"dynamic-a","tool":"example","arguments":{},"status":"completed","success":false,"error":"SECRET_ERROR"}),
            json!({"type":"McpToolCall","id":"mcp-a","server":"example","tool":"example","arguments":{},"status":"completed","result":{"content":[],"isError":true}}),
            json!({"type":"FileChange","id":"patch-a","changes":{},"status":"declined","stderr":"SECRET_STDERR"}),
        ] {
            let entry = parser.parse(&line("event_msg", json!({"type":"item_completed","thread_id":"thread-a","turn_id":"turn-a","item":item}))).unwrap();
            assert_eq!(entry.entry_type, LogEntryType::Error);
            assert!(!serde_json::to_string(&entry).unwrap().contains("SECRET"));
        }
        assert!(parser
            .parse(&line(
                "event_msg",
                json!({"type":"item_completed","item":{
                    "type":"CommandExecution","id":"success-a","status":"completed","exit_code":0,
                    "stdout":"the word error is ordinary output"
                }})
            ))
            .is_none());
    }

    #[test]
    fn duplicate_starts_and_unrelated_terminals_preserve_active_calls() {
        let mut parser = CodexParser::default();
        parser.parse(&line("session_meta", json!({"id":"thread-a"})));
        parser.parse(&line(
            "event_msg",
            json!({"type":"task_started","turn_id":"turn-new"}),
        ));
        parser.parse(&line("response_item", json!({"type":"function_call","call_id":"call-a","name":"apply_patch","arguments":"{}"})));
        assert!(parser
            .parse(&line(
                "event_msg",
                json!({"type":"turn_started","turn_id":"turn-new"})
            ))
            .is_none());
        assert!(parser
            .parse(&line(
                "event_msg",
                json!({"type":"task_complete","turn_id":"turn-old"})
            ))
            .is_none());
        assert!(parser
            .parse(&line(
                "event_msg",
                json!({"type":"item_completed","thread_id":"parent-thread","turn_id":"turn-new",
                    "item":{"type":"CommandExecution","id":"call-a","status":"failed"}
                })
            ))
            .is_none());
        assert!(parser.turn_active);
        assert_eq!(parser.pending_lanes().count(), 1);
        parser.parse(&line(
            "event_msg",
            json!({"type":"task_complete","turn_id":"turn-new"}),
        ));
        assert!(!parser.turn_active);
        assert_eq!(parser.pending_lanes().count(), 0);
    }
}
