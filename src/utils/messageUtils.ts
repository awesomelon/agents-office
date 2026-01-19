import type { AgentStatus, AgentType } from "../types";

interface MessageContext {
  status: AgentStatus;
  agentType: AgentType;
  rawTask: string | null;
}

const TOOL_ACTIONS: Record<string, string> = {
  Read: "파일 읽는 중",
  Write: "파일 쓰는 중",
  Edit: "코드 수정 중",
  EditNotebook: "노트북 수정 중",
  NotebookEdit: "노트북 수정 중",
  Glob: "파일 찾는 중",
  Grep: "코드 검색 중",
  WebFetch: "웹 페이지 가져오는 중",
  WebSearch: "웹 검색 중",
  Bash: "명령 실행 중",
  Task: "작업 위임 중",
  AskUserQuestion: "사용자에게 질문 중",
  TodoWrite: "할 일 업데이트 중",
};

export function formatAgentMessage(context: MessageContext): string {
  const { status, rawTask, agentType } = context;

  if (status === "idle" || !rawTask) {
    return "";
  }

  if (status === "error") {
    return "문제가 발생했어요";
  }

  const normalized = normalizeRawTask(rawTask);

  const diagnosticSummary = summarizeDiagnostic(normalized);
  if (diagnosticSummary) return diagnosticSummary;

  const { toolName, remainder } = extractToolCall(normalized);
  if (toolName) {
    const action = TOOL_ACTIONS[toolName];
    if (action) {
      if (toolName === "Bash") {
        const command = extractBashCommand(remainder) ?? extractBashCommand(normalized);
        return command ? `${action}: ${command}` : action;
      }

      const target = extractTarget(remainder) ?? extractTarget(normalized);
      return target ? `${action}: ${target}` : action;
    }
  }

  if (status === "passing") {
    const targetAgent = extractTargetAgent(normalized);
    return targetAgent ? `작업 전달 중: ${targetAgent}` : "작업 전달 중";
  }

  // If the message is mostly English free-text (e.g. "Stream Started received..."),
  // don't show the raw content in bubble. Keep it as a simple Korean status summary.
  if (isMostlyEnglishFreeText(normalized)) {
    return getStatusSummaryKo(agentType, status);
  }

  if (status === "thinking") {
    return simplifyMessage(normalized, 28);
  }

  return simplifyMessage(normalized, 34);
}

function getStatusSummaryKo(agentType: AgentType, status: AgentStatus): string {
  const label = getAgentLabelKo(agentType);
  if (status === "thinking") return `${label} 생각 중`;
  if (status === "working") return `${label} 작업 중`;
  // For unexpected statuses (idle/error are handled earlier), fall back to a safe message.
  return `${label} 작업 중`;
}

function getAgentLabelKo(agentType: AgentType): string {
  const label: Record<AgentType, string> = {
    researcher: "리서처",
    coder: "코더",
    reviewer: "리뷰어",
    manager: "매니저",
  };
  return label[agentType] ?? "에이전트";
}

function isMostlyEnglishFreeText(message: string): boolean {
  const t = message.trim();
  if (t.length < 10) return false;

  // If there's any Korean, treat it as not-English.
  if (/[가-힣]/.test(t)) return false;

  const alpha = (t.match(/[A-Za-z]/g) ?? []).length;
  const alnum = (t.match(/[A-Za-z0-9]/g) ?? []).length;
  if (alnum === 0) return false;

  // Require enough English letters and a high ratio to avoid false positives on paths/ids.
  const ratio = alpha / alnum;
  return alpha >= 6 && ratio >= 0.5;
}

function normalizeRawTask(rawTask: string): string {
  let t = rawTask.trim();

  // Examples: "322Z Matched ...", "266Z High write ratio..."
  t = t.replace(/^\d+Z\s+/, "");

  // ISO-ish timestamp prefix: "2026-01-19 11:31:00 ..." or "2026-01-19T11:31:00 ..."
  t = t.replace(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\s+/, "");

  // Common log levels / prefixes
  t = t.replace(
    /^(?:\[(?:INFO|DEBUG|WARN|ERROR|TRACE)\]\s+|(?:INFO|DEBUG|WARN|ERROR|TRACE)\s+)+/i,
    ""
  );

  return t.trim();
}

function summarizeDiagnostic(message: string): string | null {
  const matchedHooks = message.match(/Matched\s+(\d+)\s+unique\s+hook/i);
  if (matchedHooks) {
    return `파일 감시 훅 매칭: ${matchedHooks[1]}개`;
  }

  if (/High\s+write\s+ratio/i.test(message)) {
    return "파일 변경이 매우 잦음(이벤트 폭주 가능)";
  }

  if (/Watch error/i.test(message)) {
    return "파일 감시 오류가 발생했어요";
  }

  if (/Channel error/i.test(message)) {
    return "파일 감시 채널 오류가 발생했어요";
  }

  return null;
}

function extractToolCall(message: string): { toolName: string | null; remainder: string } {
  const toolCallMatch = message.match(/^Tool call:\s*(\w+)(?:\s+|$)/i);
  if (toolCallMatch) {
    const name = toolCallMatch[1];
    const remainder = message.slice(toolCallMatch[0].length).trim();
    return { toolName: name, remainder };
  }

  const toolMatch = message.match(/^(\w+)(?:\s|:|\(|$)/);
  if (toolMatch) {
    const toolName = toolMatch[1];
    const remainder = message.slice(toolMatch[0].length).replace(/^[:(]\s*/, "").trim();
    return { toolName, remainder };
  }

  return { toolName: null, remainder: "" };
}

function extractBashCommand(message: string): string | null {
  const t = message.trim();
  if (!t) return null;

  // Avoid leaking huge JSON payloads; keep a compact, readable command snippet.
  const condensed = condenseBracketedPayloads(t);
  return truncate(condensed.replace(/\s+/g, " "), 26);
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
  const agentMatch = rawTask.match(/to\s+(researcher|coder|reviewer|manager)/i);
  if (!agentMatch) return null;

  const label: Record<string, string> = {
    researcher: "리서처",
    coder: "코더",
    reviewer: "리뷰어",
    manager: "매니저",
  };

  const key = agentMatch[1].toLowerCase();
  return label[key] ?? capitalize(key);
}

function simplifyMessage(message: string, maxLength: number): string {
  let simplified = normalizeRawTask(message)
    .replace(/^(Calling|Invoking|Running|Executing)\s+/i, "")
    .replace(/^(tool|function|command)\s*:\s*/i, "")
    .trim();

  simplified = condenseBracketedPayloads(simplified);
  simplified = simplified.replace(/\s+/g, " ").trim();
  simplified = simplified.replace(/\s*\.\.\.\s*$/, "").trim();

  if (simplified.startsWith("/")) {
    const parts = simplified.split("/");
    simplified = parts[parts.length - 1] || simplified;
  }

  return truncate(simplified, maxLength);
}

function condenseBracketedPayloads(text: string): string {
  // Replace only *large* bracketed segments to avoid wiping meaningful short content.
  const MAX_BRACKET_SEGMENT = 60;

  let t = text;
  t = t.replace(/\{[^{}]*\}/g, (m) => (m.length > MAX_BRACKET_SEGMENT ? "{…}" : m));
  t = t.replace(/\[[^\[\]]*\]/g, (m) => (m.length > MAX_BRACKET_SEGMENT ? "[…]" : m));
  return t;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
