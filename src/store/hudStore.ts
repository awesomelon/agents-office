import { create } from "zustand";

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
  rateLimitActive: boolean;

  // Actions
  recordToolCall: () => void;
  recordToolResult: () => void;
  recordError: () => void;
  recordAgentSwitch: () => void;
  setRateLimitActive: (active: boolean) => void;
  pruneOldData: () => void;

  // Computed metrics
  getMetrics: () => HudMetrics;
}

const WINDOW_MS = 60_000; // 60 seconds
const MAX_RECENT_EVENTS = 2000;
const MAX_RECENT_TOOL_RESPONSES = 2000;
const MAX_PENDING_TOOL_CALLS = 200;

function countByType(events: RecentEvent[], type: RecentEvent["type"]): number {
  return events.filter((e) => e.type === type).length;
}

export const useHudStore = create<HudState>((set, get) => ({
  recentEvents: [],
  recentToolResponses: [],
  pendingToolCalls: [],
  rateLimitActive: false,

  recordToolCall: () => {
    const now = Date.now();
    const event: RecentEvent = { type: "tool_call", timestamp: now };
    set((state) => ({
      recentEvents: [
        ...state.recentEvents,
        event,
      ].slice(-MAX_RECENT_EVENTS),
      pendingToolCalls: [...state.pendingToolCalls, now].slice(-MAX_PENDING_TOOL_CALLS),
    }));
  },

  recordToolResult: () => {
    const now = Date.now();
    set((state) => {
      const [startedAt, ...rest] = state.pendingToolCalls;
      if (typeof startedAt !== "number") {
        return state;
      }

      const durationMs = Math.max(0, now - startedAt);
      return {
        pendingToolCalls: rest,
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
      recentEvents: [
        ...state.recentEvents,
        event,
      ].slice(-MAX_RECENT_EVENTS),
    }));
  },

  recordAgentSwitch: () => {
    const now = Date.now();
    const event: RecentEvent = { type: "agent_switch", timestamp: now };
    set((state) => ({
      recentEvents: [
        ...state.recentEvents,
        event,
      ].slice(-MAX_RECENT_EVENTS),
    }));
  },

  setRateLimitActive: (active) => {
    set({ rateLimitActive: active });
  },

  pruneOldData: () => {
    const cutoff = Date.now() - WINDOW_MS;
    set((state) => ({
      recentEvents: state.recentEvents.filter((e) => e.timestamp > cutoff),
      recentToolResponses: state.recentToolResponses.filter((r) => r.timestamp > cutoff),
      pendingToolCalls: state.pendingToolCalls.filter((ts) => ts > cutoff),
    }));
  },

  getMetrics: () => {
    const { recentEvents, recentToolResponses, rateLimitActive } = get();

    const avgToolResponseMs = recentToolResponses.length > 0
      ? Math.round(recentToolResponses.reduce((acc, r) => acc + r.durationMs, 0) / recentToolResponses.length)
      : null;

    return {
      toolCallCount: countByType(recentEvents, "tool_call"),
      avgToolResponseMs,
      errorCount: countByType(recentEvents, "error"),
      agentSwitchCount: countByType(recentEvents, "agent_switch"),
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
