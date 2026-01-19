import type { LogEntry } from "../types";

/**
 * 밀리초를 상대 시간 문자열로 변환
 * @param ms 경과 시간 (밀리초)
 * @returns "now", "5s", "2m" 형식의 문자열
 */
export function formatRelativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);

  if (seconds < 3) return "now";
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

/**
 * 로그 엔트리를 타임라인 표시용 텍스트로 변환
 * @param entry 로그 엔트리
 * @returns 표시할 텍스트 (도구명 또는 내용 요약)
 */
export function formatTimelineEntry(entry: LogEntry): string {
  // 도구명이 있으면 도구명 사용
  if (entry.tool_name) {
    return entry.tool_name;
  }

  // 엔트리 타입별 기본 표시 텍스트
  switch (entry.entry_type) {
    case "session_start":
      return "Session Start";
    case "session_end":
      return "Session End";
    case "error":
      return "Error";
    case "todo_update":
      return "Todo Update";
    case "message":
      // 메시지 내용 요약 (최대 20자)
      return entry.content.length > 20
        ? entry.content.slice(0, 20) + "..."
        : entry.content;
    default:
      return entry.entry_type;
  }
}

/**
 * 타임스탬프 문자열을 Date 객체로 파싱
 * @param timestamp ISO 8601 형식 타임스탬프 문자열
 * @returns Date 객체
 */
export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}
