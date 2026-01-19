import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAgentStore, useLogStore, useHudStore, type BatchUpdateData } from "../store";
import type { Agent, AppEvent, LogEntry } from "../types";

// Tauri 환경인지 체크 (브라우저에서 npm run dev 실행 시 false)
function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export function useTauriEvents(): void {
  const {
    updateAgent,
    processBatchUpdate,
    setAgentVacation,
    setAgentError,
    startDocumentTransfer,
    setLastActiveAgent,
  } = useAgentStore();
  const { addLog, addLogsBatch, setSessionId, setWatcherStatus } = useLogStore();
  const { recordToolCall, recordToolResult, recordError, recordAgentSwitch, recordEventsBatch, setRateLimitActive } = useHudStore();
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

        case "BatchUpdate":
          handleBatchUpdate(appEvent.payload.logs, appEvent.payload.agents, {
            addLogsBatch,
            processBatchUpdate,
            lastActiveAgentIdRef,
            recordEventsBatch,
            setRateLimitActive,
          });
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [updateAgent, processBatchUpdate, addLog, addLogsBatch, setSessionId, setWatcherStatus, setAgentVacation, setAgentError, startDocumentTransfer, setLastActiveAgent, recordToolCall, recordToolResult, recordError, recordAgentSwitch, recordEventsBatch, setRateLimitActive]);
}

// Optimized: Single regex pattern for rate limit detection
const LIMIT_REACHED_PATTERN = /limit\s*reached|hit\s+your\s+limit|rate[_\s]*limit|429/i;

function isLimitReachedMessage(content: string): boolean {
  // Fast path: quick substring check before regex
  const lower = content.toLowerCase();
  if (!lower.includes("limit") && !lower.includes("429")) {
    return false;
  }
  return LIMIT_REACHED_PATTERN.test(content);
}

function isToolActivity(entryType: string): boolean {
  return entryType === "tool_call" || entryType === "tool_result";
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
  const isActivity = isToolActivity(entry.entry_type);

  // HUD: Record tool events
  if (entry.entry_type === "tool_call") recordToolCall();
  if (entry.entry_type === "tool_result") recordToolResult();

  // Rate limit detection and vacation state
  if (isLimitReachedMessage(entry.content)) {
    setRateLimitActive(true);
    if (agentId) setAgentVacation(agentId, true);
  } else if (isActivity) {
    setRateLimitActive(false);
    if (agentId) setAgentVacation(agentId, false);
  }

  // Error state tracking
  if (entry.entry_type === "error") {
    recordError();
    if (agentId) setAgentError(agentId, true);
  } else if (agentId && isActivity) {
    setAgentError(agentId, false);
  }

  // Document transfer tracking (only on tool_call with valid agent)
  if (entry.entry_type === "tool_call" && inferredAgentId) {
    const previousAgentId = lastActiveAgentIdRef.current;
    if (previousAgentId && previousAgentId !== inferredAgentId) {
      startDocumentTransfer(previousAgentId, inferredAgentId, entry.tool_name);
      recordAgentSwitch();
    }
    lastActiveAgentIdRef.current = inferredAgentId;
    setLastActiveAgent(inferredAgentId);
  } else if (inferredAgentId) {
    lastActiveAgentIdRef.current = inferredAgentId;
  }
}

// Tool name to agent ID mapping
const TOOL_TO_AGENT: Record<string, string> = {
  read: "reader",
  glob: "searcher",
  grep: "searcher",
  websearch: "searcher",
  webfetch: "searcher",
  write: "writer",
  edit: "editor",
  notebookedit: "editor",
  editnotebook: "editor",
  todowrite: "planner",
  task: "planner",
  askuserquestion: "support",
};

// Keywords that indicate tester agent for bash commands
const TESTER_KEYWORDS = ["git", "test", "npm", "pnpm", "yarn", "cargo"];

function inferAgentId(entry: LogEntry): string | null {
  const explicit = entry.agent_id?.trim();
  if (explicit) return explicit;

  const tool = entry.tool_name?.trim()?.toLowerCase();
  if (!tool) return null;

  // Direct mapping lookup
  const mapped = TOOL_TO_AGENT[tool];
  if (mapped) return mapped;

  // Bash: context-dependent (Runner vs Tester)
  if (tool === "bash") {
    const content = entry.content.toLowerCase();
    const isTesterCommand = TESTER_KEYWORDS.some((keyword) => content.includes(keyword));
    return isTesterCommand ? "tester" : "runner";
  }

  return "editor";
}

interface BatchUpdateHandlers {
  addLogsBatch: (entries: LogEntry[]) => void;
  processBatchUpdate: (data: BatchUpdateData) => void;
  lastActiveAgentIdRef: { current: string | null };
  recordEventsBatch: (entries: LogEntry[], agentSwitchCount: number) => void;
  setRateLimitActive: (active: boolean) => void;
}

function handleBatchUpdate(logs: LogEntry[], agents: Agent[], handlers: BatchUpdateHandlers): void {
  const { addLogsBatch, processBatchUpdate, lastActiveAgentIdRef, recordEventsBatch, setRateLimitActive } = handlers;

  addLogsBatch(logs);

  const vacations: Record<string, boolean> = {};
  const errors: Record<string, boolean> = {};
  const newDocumentTransfers: BatchUpdateData["newDocumentTransfers"] = [];
  let lastActiveId: string | null = null;
  let agentSwitchCount = 0;
  let rateLimitDetected = false;
  let activityResumed = false;

  for (const entry of logs) {
    const inferredAgentId = inferAgentId(entry);
    const agentId = inferredAgentId ?? lastActiveAgentIdRef.current;
    const isActivity = isToolActivity(entry.entry_type);

    if (isLimitReachedMessage(entry.content)) {
      rateLimitDetected = true;
      if (agentId) vacations[agentId] = true;
    } else if (isActivity) {
      activityResumed = true;
      if (agentId) vacations[agentId] = false;
    }

    if (entry.entry_type === "error" && agentId) {
      errors[agentId] = true;
    } else if (agentId && isActivity) {
      errors[agentId] = false;
    }

    if (entry.entry_type === "tool_call" && inferredAgentId) {
      const previousAgentId = lastActiveAgentIdRef.current;
      if (previousAgentId && previousAgentId !== inferredAgentId) {
        newDocumentTransfers.push({ from: previousAgentId, to: inferredAgentId, toolName: entry.tool_name });
        agentSwitchCount++;
      }
      lastActiveAgentIdRef.current = inferredAgentId;
      lastActiveId = inferredAgentId;
    } else if (inferredAgentId) {
      lastActiveAgentIdRef.current = inferredAgentId;
    }
  }

  processBatchUpdate({ agentList: agents, vacations, errors, newDocumentTransfers, lastActiveId });

  if (rateLimitDetected) {
    setRateLimitActive(true);
  } else if (activityResumed) {
    setRateLimitActive(false);
  }

  recordEventsBatch(logs, agentSwitchCount);
}
