import { useSyncExternalStore } from "react";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(callback: () => void): () => void {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function subscribeVisibility(callback: () => void): () => void {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

const getReducedMotion = () => window.matchMedia(MOTION_QUERY).matches;
const getVisible = () => document.visibilityState !== "hidden";

export function useAnimationPreferences(): {
  reducedMotion: boolean;
  visible: boolean;
} {
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    getReducedMotion,
    () => true,
  );
  const visible = useSyncExternalStore(
    subscribeVisibility,
    getVisible,
    () => false,
  );
  return { reducedMotion, visible };
}
