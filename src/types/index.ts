export type AgentType = "explorer" | "analyzer" | "architect" | "developer" | "operator" | "validator" | "connector" | "liaison";

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

const DESK_X_LEFT = 60;
const DESK_X_MIDDLE = 150;
const DESK_X_RIGHT = 240;

const DESK_Y_SECTION_A = 130;
const DESK_Y_SECTION_B = 320;
const DESK_Y_SECTION_C = 520;

export const DESK_CONFIGS: DeskConfig[] = [
  // Section A: 상단 3개 (facing up) - 탐색/분석/설계
  { id: "explorer", position: [DESK_X_LEFT, DESK_Y_SECTION_A], agentType: "explorer", label: "Explorer", facing: "up" },
  { id: "analyzer", position: [DESK_X_MIDDLE, DESK_Y_SECTION_A], agentType: "analyzer", label: "Analyzer", facing: "up" },
  { id: "architect", position: [DESK_X_RIGHT, DESK_Y_SECTION_A], agentType: "architect", label: "Architect", facing: "up" },

  // Section B: 중단 3개 (facing down) - 구현/실행/검증
  { id: "developer", position: [DESK_X_LEFT, DESK_Y_SECTION_B], agentType: "developer", label: "Developer", facing: "down" },
  { id: "operator", position: [DESK_X_MIDDLE, DESK_Y_SECTION_B], agentType: "operator", label: "Operator", facing: "down" },
  { id: "validator", position: [DESK_X_RIGHT, DESK_Y_SECTION_B], agentType: "validator", label: "Validator", facing: "down" },

  // Section C: 하단 2개 (facing up) - 통합/소통
  { id: "connector", position: [DESK_X_LEFT, DESK_Y_SECTION_C], agentType: "connector", label: "Connector", facing: "up" },
  { id: "liaison", position: [DESK_X_MIDDLE, DESK_Y_SECTION_C], agentType: "liaison", label: "Liaison", facing: "up" },
];

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  entry_type: LogEntryType;
  agent_id: string | null;
  tool_name: string | null;
  displayText: string;
  relativeTime: string;
}

// Re-export colors from centralized colorScheme for backward compatibility
export {
  AGENT_COLORS,
  STATUS_COLORS,
  TIMELINE_COLORS,
  TOOL_COLORS,
} from "../config/colorScheme";
