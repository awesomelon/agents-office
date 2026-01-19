import { create } from "zustand";
import type { LogEntry, TimelineEvent } from "../types";
import { formatRelativeTime, formatTimelineEntry, parseTimestamp } from "../utils/timelineUtils";

const MAX_TIMELINE_EVENTS = 30;

interface LogState {
  logs: LogEntry[];
  maxLogs: number;
  sessionId: string | null;
  watcherActive: boolean;
  watcherPath: string | null;
  addLog: (entry: LogEntry) => void;
  addLogsBatch: (entries: LogEntry[]) => void;
  setSessionId: (id: string | null) => void;
  setWatcherStatus: (active: boolean, path: string) => void;
  clearLogs: () => void;
  getTimelineEvents: () => TimelineEvent[];
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  maxLogs: 100,
  sessionId: null,
  watcherActive: false,
  watcherPath: null,

  addLog: (entry) => {
    set((state) => {
      const newLogs = [entry, ...state.logs].slice(0, state.maxLogs);
      return { logs: newLogs };
    });
  },

  addLogsBatch: (entries) => {
    if (entries.length === 0) return;
    set((state) => ({
      // Reverse to maintain chronological order (newest first)
      logs: [...entries.slice().reverse(), ...state.logs].slice(0, state.maxLogs),
    }));
  },

  setSessionId: (id) => {
    set({ sessionId: id });
  },

  setWatcherStatus: (active, path) => {
    set({ watcherActive: active, watcherPath: path });
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  getTimelineEvents: () => {
    const { logs } = get();
    const now = Date.now();

    return logs.slice(0, MAX_TIMELINE_EVENTS).map((log, index) => {
      const timestamp = parseTimestamp(log.timestamp);
      const elapsed = now - timestamp.getTime();

      return {
        id: `${log.timestamp}-${index}`,
        timestamp,
        entry_type: log.entry_type,
        agent_id: log.agent_id,
        tool_name: log.tool_name,
        displayText: formatTimelineEntry(log),
        relativeTime: formatRelativeTime(elapsed),
      };
    });
  },
}));
