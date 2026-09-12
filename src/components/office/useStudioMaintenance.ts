import { useEffect } from "react";
import { useAgentStore } from "../../store";
import {
  DOCUMENT_TRANSFER_DURATION_MS,
  SPEECH_BUBBLE_CHECK_INTERVAL_MS,
  SPEECH_BUBBLE_TIMEOUT_MS,
} from "./canvas/constants";

// Keep the studio's brief activity cue longer than Pixi's 600ms animation,
// then discard it so switching views cannot retain old transfers indefinitely.
const TRANSFER_RETENTION_MS = Math.max(3000, DOCUMENT_TRANSFER_DURATION_MS);

/** Expire visual details independently of animation and reduced-motion settings. */
export function useStudioMaintenance(): void {
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const prune = () => {
      if (document.visibilityState === "hidden") return;
      const state = useAgentStore.getState();
      const now = performance.now();
      // Tasks use wall time inside the store; effects/transfers use monotonic time.
      state.clearExpiredTasks(SPEECH_BUBBLE_TIMEOUT_MS);
      state.removeExpiredEffects(now);
      for (const transfer of state.documentTransfers) {
        if (now - transfer.startedAt >= TRANSFER_RETENTION_MS) {
          state.removeDocumentTransfer(transfer.id);
        }
      }
    };

    const updateVisibility = () => {
      clearInterval(interval);
      interval = undefined;
      if (document.visibilityState === "hidden") return;
      prune();
      interval = setInterval(prune, SPEECH_BUBBLE_CHECK_INTERVAL_MS);
    };

    document.addEventListener("visibilitychange", updateVisibility);
    updateVisibility();
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      clearInterval(interval);
    };
  }, []);
}
