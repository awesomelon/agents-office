import type { AgentType, LogEntry } from "../types";
import type { EffectKind } from "../store";
import { TOOL_COLORS } from "./colorScheme";

/** Desks illustrate kinds of Codex activity; they are never session or worker IDs. */
export interface ToolConfig {
  agentId: AgentType;
  effect: { kind: EffectKind; color: number };
}

export const TOOL_CONFIG: Record<string, ToolConfig> = {
  apply_patch: {
    agentId: "developer",
    effect: { kind: "typeParticles", color: TOOL_COLORS.develop },
  },
  exec_command: {
    agentId: "operator",
    effect: { kind: "runSpark", color: TOOL_COLORS.operate },
  },
  shell_command: {
    agentId: "operator",
    effect: { kind: "runSpark", color: TOOL_COLORS.operate },
  },
  shell: {
    agentId: "operator",
    effect: { kind: "runSpark", color: TOOL_COLORS.operate },
  },
  write_stdin: {
    agentId: "operator",
    effect: { kind: "runSpark", color: TOOL_COLORS.operate },
  },
  update_plan: {
    agentId: "architect",
    effect: { kind: "typeParticles", color: TOOL_COLORS.architect },
  },
  spawn_agent: {
    agentId: "architect",
    effect: { kind: "typeParticles", color: TOOL_COLORS.architect },
  },
  send_input: {
    agentId: "liaison",
    effect: { kind: "typeParticles", color: TOOL_COLORS.liaison },
  },
  request_user_input: {
    agentId: "liaison",
    effect: { kind: "typeParticles", color: TOOL_COLORS.liaison },
  },
  view_image: {
    agentId: "explorer",
    effect: { kind: "searchPulse", color: TOOL_COLORS.explore },
  },
};

export const DEFAULT_EFFECT: ToolConfig["effect"] = {
  kind: "typeParticles",
  color: TOOL_COLORS.other,
};
const ROLES: AgentType[] = [
  "explorer",
  "analyzer",
  "architect",
  "developer",
  "operator",
  "validator",
  "connector",
  "liaison",
];

export function isDeskId(value: unknown): value is AgentType {
  return typeof value === "string" && ROLES.includes(value as AgentType);
}

function normalizeTool(toolName: string | null | undefined): string {
  return (toolName ?? "")
    .trim()
    .toLowerCase()
    .replace(/^functions\./, "");
}

export function getToolConfig(
  toolName: string | null | undefined,
): ToolConfig | null {
  return TOOL_CONFIG[normalizeTool(toolName)] ?? null;
}

export function getEffectForTool(
  toolName: string | null | undefined,
): ToolConfig["effect"] {
  return getToolConfig(toolName)?.effect ?? DEFAULT_EFFECT;
}

/** Fallback only; the backend classifies shell commands before redacting their arguments. */
export function inferAgentIdFromTool(
  toolName: string | null | undefined,
  _content = "",
): AgentType | null {
  const tool = normalizeTool(toolName);
  if (tool.startsWith("mcp__") || tool.startsWith("web.")) return "connector";
  return TOOL_CONFIG[tool]?.agentId ?? null;
}

export function deskForEntry(entry: LogEntry): AgentType | null {
  if (isDeskId(entry.agent_type)) return entry.agent_type;
  // agent_id identifies a real Codex session/worker, even when its text resembles a role.
  return inferAgentIdFromTool(entry.tool_name);
}

export function isLimitReachedMessage(content: string): boolean {
  return /limit\s*reached|hit\s+your\s+limit|rate[_\s]*limit|\b429\b/i.test(
    content,
  );
}
