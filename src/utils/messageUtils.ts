import type { AgentStatus } from "../types";

export interface MessageContext {
  status: AgentStatus;
  rawTask: string | null;
}

export function formatAgentMessage(context: MessageContext): string {
  const { status, rawTask } = context;

  if (status === "idle" || !rawTask) return "";
  if (status === "error") return "Error";

  return truncate(rawTask.trim(), 50);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
