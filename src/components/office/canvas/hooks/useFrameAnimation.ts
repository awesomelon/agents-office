import { useEffect, useState } from "react";

/**
 * Custom hook for frame-based animations with automatic cleanup.
 * Returns the current frame index that cycles through [0, frameCount).
 *
 * @param frameCount - Number of frames in the animation cycle
 * @param intervalMs - Milliseconds between frame changes
 * @param enabled - Whether the animation is active (default: true)
 * @returns Current frame index
 */
export function useFrameAnimation(
  frameCount: number,
  intervalMs: number,
  enabled: boolean = true
): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frameCount);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, frameCount, intervalMs]);

  return frame;
}
