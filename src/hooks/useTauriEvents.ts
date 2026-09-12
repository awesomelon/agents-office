import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useLogStore } from "../store";
import type { AppEvent } from "../types";
import { connectObserver } from "../services/observerConnection";
import { applyObserverEvent, hydrateObserver } from "../services/observerState";
import { getObserverSnapshot, isDesktop } from "../services/tauriCommands";

export function useTauriEvents(): void {
  const reconnectKey = useLogStore((state) => state.reconnectKey);
  useEffect(() => {
    if (!isDesktop()) return;
    return connectObserver({
      listen: (handler) =>
        listen<AppEvent>("app-event", (event) => handler(event.payload)),
      snapshot: getObserverSnapshot,
      hydrate: hydrateObserver,
      apply: applyObserverEvent,
      onError: (message) => useLogStore.getState().setConnectionError(message),
    });
  }, [reconnectKey]);
}
