import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAgentStore, useLogStore, useHudStore } from "../store";
import type { AppEvent, LogEntry } from "../types";

// Tauri 환경인지 체크 (브라우저에서 npm run dev 실행 시 false)
function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export function useTauriEvents(): void {
  const { updateAgent, setAgentVacation, setAgentError, startDocumentTransfer, setLastActiveAgent } = useAgentStore();
  const { addLog, setSessionId, setWatcherStatus } = useLogStore();
  const { recordToolCall, recordToolResult, recordError, recordAgentSwitch, setRateLimitActive } = useHudStore();
  const lastActiveAgentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isTauriEnv()) {
      console.log("[useTauriEvents] Not in Tauri environment, skipping event listener");
      return;
    }

    const unlisten = listen<AppEvent>("app-event", (event) => {
      const appEvent = event.payload;

      switch (appEvent.type) {
        case "LogEntry":
          handleLogEntry(appEvent.payload, {
            addLog,
            setAgentVacation,
            setAgentError,
            startDocumentTransfer,
            setLastActiveAgent,
            lastActiveAgentIdRef,
            recordToolCall,
            recordToolResult,
            recordError,
            recordAgentSwitch,
            setRateLimitActive,
          });
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
  }, [updateAgent, addLog, setSessionId, setWatcherStatus, setAgentVacation, setAgentError, startDocumentTransfer, setLastActiveAgent, recordToolCall, recordToolResult, recordError, recordAgentSwitch, setRateLimitActive]);
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

interface LogEntryHandlers {
  addLog: (entry: LogEntry) => void;
  setAgentVacation: (id: string, on: boolean) => void;
  setAgentError: (id: string, hasError: boolean) => void;
  startDocumentTransfer: (fromAgentId: string, toAgentId: string, toolName?: string | null) => void;
  setLastActiveAgent: (id: string) => void;
  lastActiveAgentIdRef: { current: string | null };
  recordToolCall: () => void;
  recordToolResult: () => void;
  recordError: () => void;
  recordAgentSwitch: () => void;
  setRateLimitActive: (active: boolean) => void;
}

function handleLogEntry(entry: LogEntry, handlers: LogEntryHandlers): void {
  const {
    addLog,
    setAgentVacation,
    setAgentError,
    startDocumentTransfer,
    setLastActiveAgent,
    lastActiveAgentIdRef,
    recordToolCall,
    recordToolResult,
    recordError,
    recordAgentSwitch,
    setRateLimitActive,
  } = handlers;

  addLog(entry);

  const inferredAgentId = inferAgentId(entry);
  const agentId = inferredAgentId ?? lastActiveAgentIdRef.current;

  // HUD: Record tool calls
  if (entry.entry_type === "tool_call") {
    recordToolCall();
  }
  if (entry.entry_type === "tool_result") {
    recordToolResult();
  }

  // HUD: Handle rate limit detection
  if (isLimitReachedMessage(entry.content)) {
    setRateLimitActive(true);
    if (agentId) {
      setAgentVacation(agentId, true);
    }
  } else if (entry.entry_type === "tool_call" || entry.entry_type === "tool_result") {
    // Activity resumes, rate limit over
    setRateLimitActive(false);
    if (agentId) {
      setAgentVacation(agentId, false);
    }
  }

  // HUD: Record errors and set agent error state
  if (entry.entry_type === "error") {
    recordError();
    if (agentId) {
      setAgentError(agentId, true);
    }
  } else if (agentId && (entry.entry_type === "tool_call" || entry.entry_type === "tool_result")) {
    // Clear error on successful tool activity
    setAgentError(agentId, false);
  }

  // Handle document transfer (only on tool_call with valid agent)
  if (entry.entry_type === "tool_call" && inferredAgentId) {
    const previousAgentId = lastActiveAgentIdRef.current;

    if (previousAgentId && previousAgentId !== inferredAgentId) {
      startDocumentTransfer(previousAgentId, inferredAgentId, entry.tool_name);
      recordAgentSwitch(); // HUD: Record agent switch
    }

    lastActiveAgentIdRef.current = inferredAgentId;
    setLastActiveAgent(inferredAgentId);
  } else if (inferredAgentId) {
    // Track last active agent for error attribution
    lastActiveAgentIdRef.current = inferredAgentId;
  }
}

function inferAgentId(entry: LogEntry): string | null {
  const explicit = entry.agent_id?.trim();
  if (explicit) return explicit;

  const tool = entry.tool_name?.trim()?.toLowerCase();
  if (!tool) return null;

  // Reader: file reading
  if (tool === "read") {
    return "reader";
  }

  // Searcher: search and web tools
  if (tool === "glob" || tool === "grep" || tool === "websearch" || tool === "webfetch") {
    return "searcher";
  }

  // Writer: file creation
  if (tool === "write") {
    return "writer";
  }

  // Editor: code modification
  if (tool === "edit" || tool === "notebookedit" || tool === "editnotebook") {
    return "editor";
  }

  // Bash: context-dependent (Runner vs Tester)
  if (tool === "bash") {
    const content = entry.content.toLowerCase();
    if (content.includes("git") || content.includes("test") || content.includes("npm") || content.includes("pnpm") || content.includes("yarn") || content.includes("cargo")) {
      return "tester";
    }
    return "runner";
  }

  // Planner: task management
  if (tool === "todowrite" || tool === "task") {
    return "planner";
  }

  // Support: user questions
  if (tool === "askuserquestion") {
    return "support";
  }

  return "editor";
}
