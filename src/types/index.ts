export type AgentType = "reader" | "searcher" | "writer" | "editor" | "runner" | "tester" | "planner" | "support";

export type AgentStatus = "idle" | "working" | "thinking" | "passing" | "error";

export interface Agent {
  id: string;
  agent_type: AgentType;
  status: AgentStatus;
  current_task: string | null;
  desk_position: [number, number];
}

export type LogEntryType =
  | "tool_call"
  | "tool_result"
  | "message"
  | "error"
  | "todo_update"
  | "session_start"
  | "session_end";

export interface LogEntry {
  timestamp: string;
  entry_type: LogEntryType;
  content: string;
  agent_id: string | null;
  tool_name: string | null;
}

export type AppEvent =
  | { type: "LogEntry"; payload: LogEntry }
  | { type: "AgentUpdate"; payload: Agent }
  | { type: "SessionStart"; payload: { session_id: string } }
  | { type: "SessionEnd"; payload: { session_id: string } }
  | { type: "WatcherStatus"; payload: { active: boolean; path: string } }
  | { type: "BatchUpdate"; payload: { logs: LogEntry[]; agents: Agent[] } };

export interface DeskConfig {
  id: string;
  position: [number, number];
  agentType: AgentType;
  label: string;
}

export const DESK_CONFIGS: DeskConfig[] = [
  { id: "reader", position: [115, 160], agentType: "reader", label: "Reader" },
  { id: "searcher", position: [315, 160], agentType: "searcher", label: "Searcher" },
  { id: "writer", position: [515, 160], agentType: "writer", label: "Writer" },
  { id: "editor", position: [715, 160], agentType: "editor", label: "Editor" },
  { id: "runner", position: [115, 360], agentType: "runner", label: "Runner" },
  { id: "tester", position: [315, 360], agentType: "tester", label: "Tester" },
  { id: "planner", position: [515, 360], agentType: "planner", label: "Planner" },
  { id: "support", position: [715, 360], agentType: "support", label: "Support" },
];

export const AGENT_COLORS: Record<AgentType, number> = {
  reader: 0x60a5fa, // blue
  searcher: 0x38bdf8, // sky blue
  writer: 0x4ade80, // green
  editor: 0x22c55e, // dark green
  runner: 0xfbbf24, // yellow
  tester: 0xf97316, // orange
  planner: 0xf472b6, // pink
  support: 0xa78bfa, // purple
};

export const STATUS_COLORS: Record<AgentStatus, number> = {
  idle: 0x6b7280,
  working: 0x22c55e,
  thinking: 0x3b82f6,
  passing: 0xa855f7,
  error: 0xef4444,
};

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  entry_type: LogEntryType;
  agent_id: string | null;
  tool_name: string | null;
  displayText: string;
  relativeTime: string;
}

export const TIMELINE_COLORS: Record<LogEntryType, string> = {
  tool_call: "#3b82f6",    // blue
  tool_result: "#22c55e",  // green
  error: "#ef4444",        // red
  todo_update: "#a855f7",  // purple
  message: "#6b7280",      // gray
  session_start: "#facc15", // yellow
  session_end: "#facc15",   // yellow
};
