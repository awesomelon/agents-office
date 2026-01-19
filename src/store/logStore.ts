import { create } from "zustand";
import type { LogEntry } from "../types";

interface LogState {
  logs: LogEntry[];
  maxLogs: number;
  sessionId: string | null;
  watcherActive: boolean;
  watcherPath: string | null;
  addLog: (entry: LogEntry) => void;
  setSessionId: (id: string | null) => void;
  setWatcherStatus: (active: boolean, path: string) => void;
  clearLogs: () => void;
}

export const useLogStore = create<LogState>((set) => ({
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

  setSessionId: (id) => {
    set({ sessionId: id });
  },

  setWatcherStatus: (active, path) => {
    set({ watcherActive: active, watcherPath: path });
  },

  clearLogs: () => {
    set({ logs: [] });
  },
}));
