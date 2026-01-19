import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAgentStore, useLogStore } from "../store";
import type { AppEvent, LogEntry } from "../types";

// Tauri 환경인지 체크 (브라우저에서 npm run dev 실행 시 false)
function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export function useTauriEvents() {
  const { updateAgent, setAgentVacation } = useAgentStore();
  const { addLog, setSessionId, setWatcherStatus } = useLogStore();
  const lastActiveAgentIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 브라우저 환경에서는 Tauri 이벤트 구독하지 않음
    if (!isTauriEnv()) {
      console.log("[useTauriEvents] Not in Tauri environment, skipping event listener");
      return;
    }

    // Listen for app events from Tauri
    const unlisten = listen<AppEvent>("app-event", (event) => {
      const appEvent = event.payload;

      switch (appEvent.type) {
        case "LogEntry":
          addLog(appEvent.payload);
          handleVacationFlag(appEvent.payload, setAgentVacation, lastActiveAgentIdRef);
          break;

        case "AgentUpdate":
          updateAgent(appEvent.payload);
          break;

        case "SessionStart":
          setSessionId(appEvent.payload.session_id);
          break;

        case "SessionEnd":
          setSessionId(null);
          break;

        case "WatcherStatus":
          setWatcherStatus(appEvent.payload.active, appEvent.payload.path);
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [updateAgent, addLog, setSessionId, setWatcherStatus, setAgentVacation]);
}

const LIMIT_REACHED_PATTERNS: RegExp[] = [
  // Explicit phrases
  /\blimit reached\b/i,
  /you['’]ve hit your limit\b/i,
  /\bhit your limit\b/i,

  // Observed Claude debug patterns (rate limit)
  /\brate_limit_error\b/i,
  /\brate\s*limit\b/i,
  /exceed\s+your\s+account['’]?s\s+rate\s+limit/i,
  /non-streaming\s+fallback:\s*429/i,
];

function isLimitReachedMessage(content: string): boolean {
  return LIMIT_REACHED_PATTERNS.some((re) => re.test(content));
}

function handleVacationFlag(
  entry: LogEntry,
  setAgentVacation: (id: string, on: boolean) => void,
  lastActiveAgentIdRef: { current: string | null },
): void {
  const inferred = inferAgentId(entry);
  if (inferred) {
    // Track last active agent so we can attribute error logs without tool_name.
    lastActiveAgentIdRef.current = inferred;
  }

  const agentId = inferred ?? lastActiveAgentIdRef.current;
  if (!agentId) return;

  // Turn on when limit reached, and auto-clear on the next normal activity from the same agent.
  if (isLimitReachedMessage(entry.content)) {
    setAgentVacation(agentId, true);
    return;
  }

  // Don't clear on noisy debug logs; clear when the agent resumes a real action.
  if (entry.entry_type === "tool_call" || entry.entry_type === "tool_result") {
    setAgentVacation(agentId, false);
  }
}

function inferAgentId(entry: LogEntry): string | null {
  const explicit = entry.agent_id?.trim();
  if (explicit) return explicit;

  const tool = entry.tool_name?.trim();
  if (tool) {
    const t = tool.toLowerCase();

    if (t === "read" || t === "glob" || t === "grep" || t === "websearch" || t === "webfetch") {
      return "researcher";
    }

    if (t === "write" || t === "edit" || t === "notebookedit" || t === "editnotebook") {
      return "coder";
    }

    if (t === "bash") {
      const c = entry.content.toLowerCase();
      if (c.includes("git") || c.includes("test") || c.includes("npm") || c.includes("pnpm")) {
        return "reviewer";
      }
      return "coder";
    }

    if (t === "todowrite" || t === "task") {
      return "artist";
    }

    return "coder";
  }

  return null;
}
