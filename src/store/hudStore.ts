import { create } from "zustand";
import type { LogEntry } from "../types";

// Event tracking with timestamp for 60-second window
interface RecentEvent {
  type: "tool_call" | "error" | "agent_switch";
  timestamp: number;
}

interface RecentToolResponse {
  timestamp: number;
  durationMs: number;
}

// HUD metrics exposed to UI
export interface HudMetrics {
  toolCallCount: number;
  avgToolResponseMs: number | null;
  errorCount: number;
  agentSwitchCount: number;
  rateLimitActive: boolean;
}

interface HudState {
  recentEvents: RecentEvent[];
  recentToolResponses: RecentToolResponse[];
  pendingToolCalls: number[]; // timestamps for tool_call events awaiting a tool_result
  pendingToolCallHead: number; // head index for O(1) dequeue
  rateLimitActive: boolean;

  // Actions
  recordToolCall: () => void;
  recordToolResult: () => void;
  recordError: () => void;
  recordAgentSwitch: () => void;
  recordEventsBatch: (entries: LogEntry[], agentSwitchCount: number) => void;
  setRateLimitActive: (active: boolean) => void;
  pruneOldData: () => void;

  // Computed metrics
  getMetrics: () => HudMetrics;
}

const WINDOW_MS = 60_000; // 60 seconds
const MAX_RECENT_EVENTS = 2000;
const MAX_RECENT_TOOL_RESPONSES = 2000;
const MAX_PENDING_TOOL_CALLS = 200;
const PENDING_TOOL_CALLS_COMPACT_THRESHOLD = 64;

function compactPendingCalls(pending: number[], head: number): { pending: number[]; head: number } {
  if (head <= 0) return { pending, head };
  if (head < PENDING_TOOL_CALLS_COMPACT_THRESHOLD && head < pending.length / 2) return { pending, head };
  return { pending: pending.slice(head), head: 0 };
}

function capPendingCalls(pending: number[], head: number): { pending: number[]; head: number } {
  const effectiveLen = pending.length - head;
  if (effectiveLen <= MAX_PENDING_TOOL_CALLS) return { pending, head };
  // Drop oldest pending calls by advancing head (keeps newest MAX_PENDING_TOOL_CALLS items).
  return { pending, head: head + (effectiveLen - MAX_PENDING_TOOL_CALLS) };
}

export const useHudStore = create<HudState>((set, get) => ({
  recentEvents: [],
  recentToolResponses: [],
  pendingToolCalls: [],
  pendingToolCallHead: 0,
  rateLimitActive: false,

  recordToolCall: () => {
    const now = Date.now();
    const event: RecentEvent = { type: "tool_call", timestamp: now };
    set((state) => {
      let pending = [...state.pendingToolCalls, now];
      let head = state.pendingToolCallHead;
      ({ pending, head } = capPendingCalls(pending, head));
      ({ pending, head } = compactPendingCalls(pending, head));

      return {
        recentEvents: [...state.recentEvents, event].slice(-MAX_RECENT_EVENTS),
        pendingToolCalls: pending,
        pendingToolCallHead: head,
      };
    });
  },

  recordToolResult: () => {
    const now = Date.now();
    set((state) => {
      const startedAt = state.pendingToolCalls[state.pendingToolCallHead];
      if (typeof startedAt !== "number") {
        return state;
      }

      const durationMs = Math.max(0, now - startedAt);
      let pending = state.pendingToolCalls;
      let head = state.pendingToolCallHead + 1;
      ({ pending, head } = compactPendingCalls(pending, head));
      return {
        pendingToolCalls: pending,
        pendingToolCallHead: head,
        recentToolResponses: [
          ...state.recentToolResponses,
          { timestamp: now, durationMs },
        ].slice(-MAX_RECENT_TOOL_RESPONSES),
      };
    });
  },

  recordError: () => {
    const now = Date.now();
    const event: RecentEvent = { type: "error", timestamp: now };
    set((state) => ({
      recentEvents: [...state.recentEvents, event].slice(-MAX_RECENT_EVENTS),
    }));
  },

  recordAgentSwitch: () => {
    const now = Date.now();
    const event: RecentEvent = { type: "agent_switch", timestamp: now };
    set((state) => ({
      recentEvents: [...state.recentEvents, event].slice(-MAX_RECENT_EVENTS),
    }));
  },

  recordEventsBatch: (entries, agentSwitchCount) => {
    if (entries.length === 0 && agentSwitchCount === 0) return;

    const now = Date.now();

    // Count events from entries in single pass
    let toolCallCount = 0;
    let toolResultCount = 0;
    let errorCount = 0;

    for (const entry of entries) {
      if (entry.entry_type === "tool_call") toolCallCount++;
      else if (entry.entry_type === "tool_result") toolResultCount++;
      else if (entry.entry_type === "error") errorCount++;
    }

    set((state) => {
      // Build new events array with all types
      const newEvents: RecentEvent[] = [
        ...Array(toolCallCount).fill({ type: "tool_call" as const, timestamp: now }),
        ...Array(errorCount).fill({ type: "error" as const, timestamp: now }),
        ...Array(agentSwitchCount).fill({ type: "agent_switch" as const, timestamp: now }),
      ];

      // Add pending calls for tool_call events
      const newPendingCalls = Array(toolCallCount).fill(now);
      let pendingCalls = [...state.pendingToolCalls, ...newPendingCalls];
      let head = state.pendingToolCallHead;
      ({ pending: pendingCalls, head } = capPendingCalls(pendingCalls, head));

      // Process tool results against pending calls
      const newToolResponses: RecentToolResponse[] = [];
      for (let i = 0; i < toolResultCount; i++) {
        const startedAt = pendingCalls[head];
        if (typeof startedAt !== "number") break;
        head++;
        newToolResponses.push({ timestamp: now, durationMs: Math.max(0, now - startedAt) });
      }
      ({ pending: pendingCalls, head } = compactPendingCalls(pendingCalls, head));

      return {
        recentEvents: [...state.recentEvents, ...newEvents].slice(-MAX_RECENT_EVENTS),
        pendingToolCalls: pendingCalls,
        pendingToolCallHead: head,
        recentToolResponses: [...state.recentToolResponses, ...newToolResponses].slice(-MAX_RECENT_TOOL_RESPONSES),
      };
    });
  },

  setRateLimitActive: (active) => {
    set({ rateLimitActive: active });
  },

  pruneOldData: () => {
    const cutoff = Date.now() - WINDOW_MS;
    set((state) => {
      // Normalize pending calls (drop consumed head) before time-based pruning.
      let pending = state.pendingToolCalls.slice(state.pendingToolCallHead);
      pending = pending.filter((ts) => ts > cutoff);
      pending = pending.slice(-MAX_PENDING_TOOL_CALLS);

      return {
        recentEvents: state.recentEvents.filter((e) => e.timestamp > cutoff),
        recentToolResponses: state.recentToolResponses.filter((r) => r.timestamp > cutoff),
        pendingToolCalls: pending,
        pendingToolCallHead: 0,
      };
    });
  },

  getMetrics: () => {
    const { recentEvents, recentToolResponses, rateLimitActive } = get();

    const avgToolResponseMs = recentToolResponses.length > 0
      ? Math.round(recentToolResponses.reduce((acc, r) => acc + r.durationMs, 0) / recentToolResponses.length)
      : null;

    // Single-pass counting to avoid repeated filtering costs.
    let toolCallCount = 0;
    let errorCount = 0;
    let agentSwitchCount = 0;
    for (const e of recentEvents) {
      if (e.type === "tool_call") toolCallCount++;
      else if (e.type === "error") errorCount++;
      else agentSwitchCount++;
    }

    return {
      toolCallCount,
      avgToolResponseMs,
      errorCount,
      agentSwitchCount,
      rateLimitActive,
    };
  },
}));

// Start periodic pruning
let pruneIntervalId: ReturnType<typeof setInterval> | null = null;

export function startHudPruning(): void {
  if (pruneIntervalId) return;
  pruneIntervalId = setInterval(() => {
    useHudStore.getState().pruneOldData();
  }, 1000);
}

export function stopHudPruning(): void {
  if (pruneIntervalId) {
    clearInterval(pruneIntervalId);
    pruneIntervalId = null;
  }
}
