import { create } from "zustand";
import type { LogEntry, TimelineEvent, WatcherStatus } from "../types";
import {
  formatRelativeTime,
  formatTimelineEntry,
  parseTimestamp,
} from "../utils/timelineUtils";

export function logKey(entry: LogEntry): string {
  return (
    entry.id ??
    JSON.stringify([
      entry.timestamp,
      entry.session_id,
      entry.call_id,
      entry.entry_type,
      entry.tool_name,
      entry.content,
    ])
  );
}

export function mergeLogs(
  current: LogEntry[],
  entries: LogEntry[],
  limit: number,
): LogEntry[] {
  const seen = new Set<string>();
  return [...entries.slice().reverse(), ...current]
    .filter((entry) => {
      const key = logKey(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

interface LogState {
  logs: LogEntry[];
  maxLogs: number;
  sessionId: string | null;
  watcherActive: boolean;
  watcherPath: string | null;
  watcherState: WatcherStatus["state"];
  watcherMessage: string;
  connectionError: string | null;
  reconnectKey: number;
  addLog: (entry: LogEntry) => void;
  addLogsBatch: (entries: LogEntry[]) => void;
  replaceLogs: (entries: LogEntry[]) => void;
  setSessionId: (id: string | null) => void;
  setWatcherStatus: (status: WatcherStatus) => void;
  setConnectionError: (message: string | null) => void;
  reconnect: () => void;
  clearLogs: () => void;
  getTimelineEvents: () => TimelineEvent[];
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  maxLogs: 500,
  sessionId: null,
  watcherActive: false,
  watcherPath: null,
  watcherState: "starting",
  watcherMessage: "Connecting to the local observer…",
  connectionError: null,
  reconnectKey: 0,
  addLog: (entry) =>
    set((state) => ({ logs: mergeLogs(state.logs, [entry], state.maxLogs) })),
  addLogsBatch: (entries) =>
    set((state) => ({ logs: mergeLogs(state.logs, entries, state.maxLogs) })),
  replaceLogs: (entries) =>
    set((state) => ({ logs: mergeLogs([], entries, state.maxLogs) })),
  setSessionId: (sessionId) => set({ sessionId }),
  setWatcherStatus: (status) =>
    set({
      watcherActive: status.active,
      watcherPath: status.path,
      watcherState: status.state,
      watcherMessage: status.message,
    }),
  setConnectionError: (connectionError) => set({ connectionError }),
  reconnect: () =>
    set((state) => ({
      reconnectKey: state.reconnectKey + 1,
      connectionError: null,
      watcherState: "starting",
      watcherMessage: "Reconnecting…",
    })),
  clearLogs: () => set({ logs: [] }),
  getTimelineEvents: () =>
    get()
      .logs.slice(0, 20)
      .map((log) => ({
        id: logKey(log),
        timestamp: parseTimestamp(log.timestamp),
        entry_type: log.entry_type,
        agent_id: log.agent_id,
        tool_name: log.tool_name,
        displayText: formatTimelineEntry(log),
        relativeTime: formatRelativeTime(
          Math.max(0, Date.now() - parseTimestamp(log.timestamp).getTime()),
        ),
      })),
}));
