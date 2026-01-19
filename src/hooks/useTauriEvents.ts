import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAgentStore, useLogStore } from "../store";
import type { AppEvent } from "../types";

export function useTauriEvents() {
  const { initializeAgents, updateAgent } = useAgentStore();
  const { addLog, setSessionId, setWatcherStatus } = useLogStore();

  useEffect(() => {
    // Initialize agents on mount
    initializeAgents();

    // Listen for app events from Tauri
    const unlisten = listen<AppEvent>("app-event", (event) => {
      const appEvent = event.payload;

      switch (appEvent.type) {
        case "LogEntry":
          addLog(appEvent.payload);
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
  }, [initializeAgents, updateAgent, addLog, setSessionId, setWatcherStatus]);
}
