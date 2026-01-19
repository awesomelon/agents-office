export type AgentType = "researcher" | "coder" | "reviewer" | "artist";

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
  | { type: "WatcherStatus"; payload: { active: boolean; path: string } };

export interface DeskConfig {
  id: string;
  position: [number, number];
  agentType: AgentType;
  label: string;
}

export const DESK_CONFIGS: DeskConfig[] = [
  { id: "researcher", position: [180, 160], agentType: "researcher", label: "Researcher" },
  { id: "coder", position: [520, 160], agentType: "coder", label: "Coder" },
  { id: "reviewer", position: [180, 360], agentType: "reviewer", label: "Reviewer" },
  { id: "artist", position: [520, 360], agentType: "artist", label: "Artist" },
];

export const AGENT_COLORS: Record<AgentType, number> = {
  researcher: 0x60a5fa, // blue
  coder: 0x4ade80, // green
  reviewer: 0xfbbf24, // yellow
  artist: 0xf472b6, // pink
};

export const STATUS_COLORS: Record<AgentStatus, number> = {
  idle: 0x6b7280,
  working: 0x22c55e,
  thinking: 0x3b82f6,
  passing: 0xa855f7,
  error: 0xef4444,
};
