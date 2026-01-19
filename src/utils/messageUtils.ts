import type { AgentStatus, AgentType } from "../types";

interface MessageContext {
  status: AgentStatus;
  agentType: AgentType;
  rawTask: string | null;
}

const TOOL_ACTIONS: Record<string, string> = {
  Read: "Reading file",
  Write: "Writing file",
  Edit: "Editing code",
  Glob: "Searching files",
  Grep: "Searching code",
  WebFetch: "Fetching web page",
  WebSearch: "Searching the web",
  Bash: "Running command",
  Task: "Delegating task",
  AskUserQuestion: "Asking user",
  TodoWrite: "Updating todos",
};

export function formatAgentMessage(context: MessageContext): string {
  const { status, rawTask } = context;

  if (status === "idle" || !rawTask) {
    return "";
  }

  if (status === "error") {
    return "Something went wrong!";
  }

  const toolMatch = rawTask.match(/^(\w+)(?:\s|:|\(|$)/);
  if (toolMatch) {
    const toolName = toolMatch[1];
    const action = TOOL_ACTIONS[toolName];
    if (action) {
      const target = extractTarget(rawTask);
      return target ? `${action}: ${target}` : action;
    }
  }

  if (status === "passing") {
    const targetAgent = extractTargetAgent(rawTask);
    return targetAgent ? `Passing to ${targetAgent}...` : "Passing work...";
  }

  if (status === "thinking") {
    return simplifyMessage(rawTask, 25);
  }

  return simplifyMessage(rawTask, 30);
}

function extractTarget(rawTask: string): string | null {
  const pathMatch = rawTask.match(/(?:\/[\w\-./]+)+/);
  if (pathMatch) {
    const parts = pathMatch[0].split("/");
    return parts[parts.length - 1] || parts[parts.length - 2] || null;
  }

  const quotedMatch = rawTask.match(/["']([^"']+)["']/);
  if (quotedMatch) {
    return truncate(quotedMatch[1], 20);
  }

  return null;
}

function extractTargetAgent(rawTask: string): string | null {
  const agentMatch = rawTask.match(/to\s+(researcher|coder|reviewer|artist)/i);
  return agentMatch ? capitalize(agentMatch[1]) : null;
}

function simplifyMessage(message: string, maxLength: number): string {
  let simplified = message
    .replace(/^(Calling|Invoking|Running|Executing)\s+/i, "")
    .replace(/^(tool|function|command)\s*:\s*/i, "")
    .replace(/\{.*\}/g, "")
    .replace(/\[.*\]/g, "")
    .trim();

  if (simplified.startsWith("/")) {
    const parts = simplified.split("/");
    simplified = parts[parts.length - 1] || simplified;
  }

  return truncate(simplified, maxLength);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
