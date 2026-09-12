use crate::models::{
    initial_agents, Agent, AppEvent, AppEventKind, LogEntry, ObserverSnapshot, WatcherState,
    WatcherStatus,
};
use std::collections::VecDeque;

pub const MAX_SNAPSHOT_LOGS: usize = 500;

/// State mutation and snapshot reads share one mutex in the desktop adapter.
pub struct Observer {
    revision: u64,
    next_log_id: u64,
    watcher: WatcherStatus,
    agents: Vec<Agent>,
    logs: VecDeque<LogEntry>,
    session_id: Option<String>,
}

impl Observer {
    pub fn new(path: String) -> Self {
        Self {
            revision: 0,
            next_log_id: 0,
            agents: initial_agents(),
            logs: VecDeque::new(),
            session_id: None,
            watcher: WatcherStatus {
                active: false,
                path,
                state: WatcherState::Starting,
                message: "Connecting to local Codex sessions".into(),
                revision: 0,
            },
        }
    }

    pub fn snapshot(&self) -> ObserverSnapshot {
        ObserverSnapshot {
            revision: self.revision,
            watcher: self.watcher.clone(),
            agents: self.agents.clone(),
            logs: self.logs.iter().cloned().collect(),
            session_id: self.session_id.clone(),
        }
    }

    pub fn set_status(&mut self, state: WatcherState, message: &str) -> Option<AppEvent> {
        if self.watcher.state == state && self.watcher.message == message {
            return None;
        }
        self.revision += 1;
        self.watcher = WatcherStatus {
            active: state == WatcherState::Watching,
            state,
            message: message.into(),
            revision: self.revision,
            ..self.watcher.clone()
        };
        Some(AppEvent {
            revision: self.revision,
            event: AppEventKind::WatcherStatus(self.watcher.clone()),
        })
    }

    pub fn push(&mut self, mut logs: Vec<LogEntry>, agents: Vec<Agent>) -> Option<AppEvent> {
        if logs.is_empty() && self.agents == agents {
            return None;
        }
        self.revision += 1;
        for log in &mut logs {
            self.next_log_id += 1;
            log.id = format!("observed-{}", self.next_log_id);
            if log.session_id.is_some() {
                self.session_id.clone_from(&log.session_id);
            }
            self.logs.push_back(log.clone());
            if self.logs.len() > MAX_SNAPSHOT_LOGS {
                self.logs.pop_front();
            }
        }
        self.agents.clone_from(&agents);
        Some(AppEvent {
            revision: self.revision,
            event: AppEventKind::BatchUpdate { logs, agents },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{AgentStatus, LogEntryType};

    #[test]
    fn snapshot_is_revisioned_and_bounded_without_duplicate_log_ids() {
        let mut observer = Observer::new("/example/sessions".into());
        let status = observer
            .set_status(WatcherState::Watching, "Ready")
            .unwrap();
        assert_eq!(status.revision, 1);
        assert!(observer
            .set_status(WatcherState::Watching, "Ready")
            .is_none());
        for _ in 0..600 {
            let entry = LogEntry {
                id: String::new(),
                timestamp: String::new(),
                entry_type: LogEntryType::Message,
                content: "Codex message delivered".into(),
                session_id: Some("thread-a".into()),
                agent_id: Some("thread-a".into()),
                tool_name: None,
                call_id: None,
                agent_type: None,
            };
            observer.push(vec![entry], initial_agents());
        }
        let snapshot = observer.snapshot();
        assert_eq!(snapshot.revision, 601);
        assert_eq!(snapshot.logs.len(), MAX_SNAPSHOT_LOGS);
        assert_eq!(snapshot.logs.first().unwrap().id, "observed-101");
        assert_eq!(snapshot.logs.last().unwrap().id, "observed-600");
        assert_eq!(snapshot.session_id.as_deref(), Some("thread-a"));
        let mut agents = initial_agents();
        agents[0].status = AgentStatus::Working;
        assert_eq!(observer.push(vec![], agents).unwrap().revision, 602);
    }

    #[test]
    fn event_serialization_matches_frontend_envelope() {
        let mut observer = Observer::new("/example/sessions".into());
        let event = observer
            .set_status(WatcherState::Missing, "Waiting")
            .unwrap();
        let json = serde_json::to_value(event).unwrap();
        assert_eq!(json["type"], "WatcherStatus");
        assert_eq!(json["revision"], 1);
        assert_eq!(json["payload"]["state"], "missing");
        assert_eq!(json["payload"]["active"], false);
    }
}
