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
  // Visual direction of the desk row (used for desk drawing / agent placement).
  facing?: "up" | "down";
}

export const DESK_CONFIGS: DeskConfig[] = [
  // Section A: 상단 3개 (facing up, 벽 밀착) - 책상 간격 0px (밀착)
  { id: "reader", position: [60, 130], agentType: "reader", label: "Reader", facing: "up" },
  { id: "searcher", position: [150, 130], agentType: "searcher", label: "Searcher", facing: "up" },
  { id: "writer", position: [240, 130], agentType: "writer", label: "Writer", facing: "up" },

  // Section B: 중단 3개 (facing down) - 책상 간격 0px (밀착)
  { id: "editor", position: [60, 320], agentType: "editor", label: "Editor", facing: "down" },
  { id: "runner", position: [150, 320], agentType: "runner", label: "Runner", facing: "down" },
  { id: "tester", position: [240, 320], agentType: "tester", label: "Tester", facing: "down" },

  // Section C: 하단 2개 (facing up) - 책상 간격 0px (밀착)
  { id: "planner", position: [60, 520], agentType: "planner", label: "Planner", facing: "up" },
  { id: "support", position: [150, 520], agentType: "support", label: "Support", facing: "up" },
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
