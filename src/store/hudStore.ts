import { create } from "zustand";
import type { LogEntry } from "../types";

interface RecentEvent {
  type: "tool_call" | "error" | "agent_switch";
  timestamp: number;
}

interface RecentToolResponse {
  timestamp: number;
  durationMs: number;
}

interface PendingToolEvent {
  sessionId: string;
  timestamp: number;
}

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
  pendingToolCalls: Map<string, PendingToolEvent>;
  pendingToolResults: Map<string, PendingToolEvent>;
  seenEvents: Map<string, number>;
  rateLimitActive: boolean;
  recordEventsBatch: (entries: LogEntry[], agentSwitchCount: number) => void;
  setRateLimitActive: (active: boolean) => void;
  pruneOldData: () => void;
  reset: () => void;
  getMetrics: () => HudMetrics;
}

const WINDOW_MS = 60_000;
// A long-running tool may start outside the display window and finish inside it.
const CORRELATION_WINDOW_MS = 15 * 60_000;
const MAX_RECENT_EVENTS = 2000;
const MAX_RECENT_TOOL_RESPONSES = 2000;
const MAX_PENDING_TOOL_EVENTS = 200;
const MAX_SEEN_EVENTS = 4000;

function initialState() {
  return {
    recentEvents: [] as RecentEvent[],
    recentToolResponses: [] as RecentToolResponse[],
    pendingToolCalls: new Map<string, PendingToolEvent>(),
    pendingToolResults: new Map<string, PendingToolEvent>(),
    seenEvents: new Map<string, number>(),
    rateLimitActive: false,
  };
}

function prunePending(pending: Map<string, PendingToolEvent>, now: number) {
  return new Map(
    [...pending]
      .filter(([, event]) => event.timestamp > now - CORRELATION_WINDOW_MS)
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(-MAX_PENDING_TOOL_EVENTS),
  );
}

function pruneSeen(seen: Map<string, number>, now: number) {
  return new Map(
    [...seen]
      .filter(([, receivedAt]) => receivedAt > now - CORRELATION_WINDOW_MS)
      .slice(-MAX_SEEN_EVENTS),
  );
}

function eventKey(entry: LogEntry) {
  return entry.id
    ? JSON.stringify([entry.session_id, entry.id])
    : JSON.stringify([
        entry.session_id,
        entry.call_id,
        entry.entry_type,
        entry.timestamp,
        entry.agent_id,
        entry.tool_name,
        entry.content,
      ]);
}

export const useHudStore = create<HudState>((set, get) => ({
  ...initialState(),

  recordEventsBatch: (entries, agentSwitchCount) => {
    if (entries.length === 0 && agentSwitchCount === 0) return;
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    // Delivery order and batch boundaries do not describe tool execution time.
    const chronological = entries
      .map((entry) => ({ entry, timestamp: Date.parse(entry.timestamp) }))
      .filter(({ timestamp }) => Number.isFinite(timestamp))
      .sort(
        (a, b) =>
          a.timestamp - b.timestamp ||
          Number(b.entry.entry_type === "tool_call") -
            Number(a.entry.entry_type === "tool_call"),
      );

    set((state) => {
      const recentEvents = state.recentEvents.filter(
        (event) => event.timestamp > cutoff,
      );
      const recentToolResponses = state.recentToolResponses.filter(
        (event) => event.timestamp > cutoff,
      );
      const pendingToolCalls = prunePending(state.pendingToolCalls, now);
      const pendingToolResults = prunePending(state.pendingToolResults, now);
      const seenEvents = pruneSeen(state.seenEvents, now);
      let acceptedEntries = 0;

      for (const { entry, timestamp } of chronological) {
        const id = eventKey(entry);
        if (seenEvents.has(id)) continue;
        seenEvents.set(id, now);
        acceptedEntries++;

        if (
          (entry.entry_type === "tool_call" || entry.entry_type === "error") &&
          timestamp > cutoff
        ) {
          recentEvents.push({ type: entry.entry_type, timestamp });
        }

        if (
          entry.entry_type === "session_end" ||
          entry.entry_type === "turn_aborted"
        ) {
          // Other sessions can still have tools running concurrently.
          if (entry.session_id) {
            for (const pending of [pendingToolCalls, pendingToolResults]) {
              for (const [key, event] of pending) {
                if (event.sessionId === entry.session_id) pending.delete(key);
              }
            }
          }
          continue;
        }

        if (
          !entry.session_id ||
          !entry.call_id ||
          timestamp <= now - CORRELATION_WINDOW_MS
        )
          continue;
        if (
          entry.entry_type !== "tool_call" &&
          entry.entry_type !== "tool_result"
        )
          continue;

        const key = JSON.stringify([entry.session_id, entry.call_id]);
        const pending =
          entry.entry_type === "tool_call"
            ? pendingToolCalls
            : pendingToolResults;
        if (!pending.has(key))
          pending.set(key, { sessionId: entry.session_id, timestamp });
        const call = pendingToolCalls.get(key);
        const result = pendingToolResults.get(key);
        if (!call || !result) continue;

        pendingToolCalls.delete(key);
        pendingToolResults.delete(key);
        // Missing or inconsistent timestamps never become synthetic zero timings.
        if (result.timestamp >= call.timestamp && result.timestamp > cutoff) {
          recentToolResponses.push({
            timestamp: result.timestamp,
            durationMs: result.timestamp - call.timestamp,
          });
        }
      }

      // Switches are derived from the same entries: history retains its original time.
      const switchTimestamp =
        chronological[chronological.length - 1]?.timestamp ??
        (entries.length === 0 ? now : 0);
      if (
        switchTimestamp > cutoff &&
        (acceptedEntries > 0 || entries.length === 0)
      ) {
        const count = Number.isFinite(agentSwitchCount)
          ? Math.min(
              MAX_RECENT_EVENTS,
              Math.max(0, Math.trunc(agentSwitchCount)),
            )
          : 0;
        for (let i = 0; i < count; i++)
          recentEvents.push({
            type: "agent_switch",
            timestamp: switchTimestamp,
          });
      }

      return {
        recentEvents: recentEvents
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-MAX_RECENT_EVENTS),
        recentToolResponses: recentToolResponses
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-MAX_RECENT_TOOL_RESPONSES),
        pendingToolCalls: prunePending(pendingToolCalls, now),
        pendingToolResults: prunePending(pendingToolResults, now),
        seenEvents: pruneSeen(seenEvents, now),
      };
    });
  },

  setRateLimitActive: (active) => set({ rateLimitActive: active }),
  reset: () => set(initialState()),

  pruneOldData: () => {
    const now = Date.now();
    set((state) => ({
      recentEvents: state.recentEvents.filter(
        (event) => event.timestamp > now - WINDOW_MS,
      ),
      recentToolResponses: state.recentToolResponses.filter(
        (event) => event.timestamp > now - WINDOW_MS,
      ),
      pendingToolCalls: prunePending(state.pendingToolCalls, now),
      pendingToolResults: prunePending(state.pendingToolResults, now),
      seenEvents: pruneSeen(state.seenEvents, now),
    }));
  },

  getMetrics: () => {
    const { recentEvents, recentToolResponses, rateLimitActive } = get();
    const now = Date.now();
    const isRecent = (timestamp: number) =>
      timestamp > now - WINDOW_MS && timestamp <= now;
    const responses = recentToolResponses.filter((event) =>
      isRecent(event.timestamp),
    );
    let toolCallCount = 0;
    let errorCount = 0;
    let agentSwitchCount = 0;
    for (const event of recentEvents) {
      if (!isRecent(event.timestamp)) continue;
      if (event.type === "tool_call") toolCallCount++;
      else if (event.type === "error") errorCount++;
      else agentSwitchCount++;
    }
    return {
      toolCallCount,
      avgToolResponseMs:
        responses.length > 0
          ? Math.round(
              responses.reduce(
                (sum, response) => sum + response.durationMs,
                0,
              ) / responses.length,
            )
          : null,
      errorCount,
      agentSwitchCount,
      rateLimitActive,
    };
  },
}));

let pruneIntervalId: ReturnType<typeof setInterval> | null = null;

export function startHudPruning(): void {
  if (pruneIntervalId) return;
  pruneIntervalId = setInterval(
    () => useHudStore.getState().pruneOldData(),
    1000,
  );
}

export function stopHudPruning(): void {
  if (pruneIntervalId) {
    clearInterval(pruneIntervalId);
    pruneIntervalId = null;
  }
}
