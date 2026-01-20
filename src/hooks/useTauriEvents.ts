import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAgentStore, useLogStore, useHudStore, type BatchUpdateData, type EffectKind } from "../store";
import type { Agent, AppEvent, LogEntry } from "../types";
import { TOOL_COLORS } from "../types";

/** Check if running in Tauri environment (false when running npm run dev in browser) */
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
    recordToolCall: agentRecordToolCall,
    recordError: agentRecordError,
    enqueueEffect,
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
            agentRecordToolCall,
            agentRecordError,
            enqueueEffect,
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
            enqueueEffect,
          });
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [updateAgent, processBatchUpdate, addLog, addLogsBatch, setSessionId, setWatcherStatus, setAgentVacation, setAgentError, startDocumentTransfer, setLastActiveAgent, recordToolCall, recordToolResult, recordError, recordAgentSwitch, recordEventsBatch, setRateLimitActive, agentRecordToolCall, agentRecordError, enqueueEffect]);
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

// Unified tool configuration: agent mapping and visual effects
interface ToolConfig {
  agentId: string;
  effect: { kind: EffectKind; color: number };
}

const TOOL_CONFIG: Record<string, ToolConfig> = {
  read: { agentId: "reader", effect: { kind: "typeParticles", color: TOOL_COLORS.read } },
  glob: { agentId: "searcher", effect: { kind: "searchPulse", color: TOOL_COLORS.search } },
  grep: { agentId: "searcher", effect: { kind: "searchPulse", color: TOOL_COLORS.search } },
  websearch: { agentId: "searcher", effect: { kind: "searchPulse", color: TOOL_COLORS.search } },
  webfetch: { agentId: "searcher", effect: { kind: "searchPulse", color: TOOL_COLORS.search } },
  write: { agentId: "writer", effect: { kind: "typeParticles", color: TOOL_COLORS.write } },
  edit: { agentId: "editor", effect: { kind: "typeParticles", color: TOOL_COLORS.edit } },
  notebookedit: { agentId: "editor", effect: { kind: "typeParticles", color: TOOL_COLORS.edit } },
  editnotebook: { agentId: "editor", effect: { kind: "typeParticles", color: TOOL_COLORS.edit } },
  todowrite: { agentId: "planner", effect: { kind: "typeParticles", color: TOOL_COLORS.plan } },
  task: { agentId: "planner", effect: { kind: "typeParticles", color: TOOL_COLORS.plan } },
  askuserquestion: { agentId: "support", effect: { kind: "typeParticles", color: TOOL_COLORS.support } },
  bash: { agentId: "runner", effect: { kind: "runSpark", color: TOOL_COLORS.run } },
};

const DEFAULT_EFFECT: { kind: EffectKind; color: number } = { kind: "typeParticles", color: TOOL_COLORS.other };
const TESTER_KEYWORDS = ["git", "test", "npm", "pnpm", "yarn", "cargo"];

function getToolConfig(toolName: string | null | undefined): ToolConfig | null {
  const tool = toolName?.trim()?.toLowerCase();
  if (!tool) return null;
  return TOOL_CONFIG[tool] ?? null;
}

function getEffectForTool(toolName: string | null | undefined): { kind: EffectKind; color: number } {
  const config = getToolConfig(toolName);
  return config?.effect ?? DEFAULT_EFFECT;
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
  agentRecordToolCall: (id: string) => void;
  agentRecordError: (id: string) => void;
  enqueueEffect: (agentId: string, kind: EffectKind, color: number, durationMs?: number) => void;
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
    agentRecordToolCall,
    agentRecordError,
    enqueueEffect,
  } = handlers;

  addLog(entry);

  const inferredAgentId = inferAgentId(entry);
  const agentId = inferredAgentId ?? lastActiveAgentIdRef.current;
  const isActivity = isToolActivity(entry.entry_type);

  // HUD: Record tool events + Visual effects
  if (entry.entry_type === "tool_call") {
    recordToolCall();
    if (agentId) {
      agentRecordToolCall(agentId);
      const effect = getEffectForTool(entry.tool_name);
      enqueueEffect(agentId, effect.kind, effect.color);
    }
  }
  if (entry.entry_type === "tool_result") recordToolResult();

  // Rate limit detection and vacation state
  if (isLimitReachedMessage(entry.content)) {
    setRateLimitActive(true);
    if (agentId) setAgentVacation(agentId, true);
  } else if (isActivity) {
    setRateLimitActive(false);
    if (agentId) setAgentVacation(agentId, false);
  }

  // Error state tracking + Visual effects
  if (entry.entry_type === "error") {
    recordError();
    if (agentId) {
      setAgentError(agentId, true);
      agentRecordError(agentId);
      // Enqueue error burst effect
      enqueueEffect(agentId, "errorBurst", TOOL_COLORS.error, 1000);
    }
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

function inferAgentId(entry: LogEntry): string | null {
  const explicit = entry.agent_id?.trim();
  if (explicit) return explicit;

  const tool = entry.tool_name?.trim()?.toLowerCase();
  if (!tool) return null;

  // Bash: context-dependent (Runner vs Tester)
  if (tool === "bash") {
    const content = entry.content.toLowerCase();
    const isTesterCommand = TESTER_KEYWORDS.some((keyword) => content.includes(keyword));
    return isTesterCommand ? "tester" : "runner";
  }

  // Use unified config lookup
  const config = getToolConfig(entry.tool_name);
  return config?.agentId ?? "editor";
}

interface BatchUpdateHandlers {
  addLogsBatch: (entries: LogEntry[]) => void;
  processBatchUpdate: (data: BatchUpdateData) => void;
  lastActiveAgentIdRef: { current: string | null };
  recordEventsBatch: (entries: LogEntry[], agentSwitchCount: number) => void;
  setRateLimitActive: (active: boolean) => void;
  enqueueEffect: (agentId: string, kind: EffectKind, color: number, durationMs?: number) => void;
}

function handleBatchUpdate(logs: LogEntry[], agents: Agent[], handlers: BatchUpdateHandlers): void {
  const { addLogsBatch, processBatchUpdate, lastActiveAgentIdRef, recordEventsBatch, setRateLimitActive, enqueueEffect } = handlers;

  addLogsBatch(logs);

  const vacations: Record<string, boolean> = {};
  const errors: Record<string, boolean> = {};
  const newDocumentTransfers: BatchUpdateData["newDocumentTransfers"] = [];
  let lastActiveId: string | null = null;
  let agentSwitchCount = 0;
  let rateLimitDetected = false;
  let activityResumed = false;

  const moodToolCalls: string[] = [];
  const moodErrors: string[] = [];

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
      moodErrors.push(agentId);
      enqueueEffect(agentId, "errorBurst", TOOL_COLORS.error, 1000);
    } else if (agentId && isActivity) {
      errors[agentId] = false;
    }

    if (entry.entry_type === "tool_call" && inferredAgentId) {
      moodToolCalls.push(inferredAgentId);
      const effect = getEffectForTool(entry.tool_name);
      if (effect) enqueueEffect(inferredAgentId, effect.kind, effect.color);
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

  const moodEvents = (moodToolCalls.length > 0 || moodErrors.length > 0)
    ? { toolCalls: moodToolCalls, errors: moodErrors }
    : undefined;

  processBatchUpdate({ agentList: agents, vacations, errors, newDocumentTransfers, lastActiveId, moodEvents });

  if (rateLimitDetected) {
    setRateLimitActive(true);
  } else if (activityResumed) {
    setRateLimitActive(false);
  }

  recordEventsBatch(logs, agentSwitchCount);
}
