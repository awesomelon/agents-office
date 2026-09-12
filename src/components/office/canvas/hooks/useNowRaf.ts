import { useEffect, useRef, useState } from "react";
import type { VisualEffect } from "../../../../store";
import type { AgentMotion } from "../types";

export function useNowRaf(args: {
  nowRef: React.MutableRefObject<number>;
  documentTransfers: unknown[];
  motionById: Record<string, AgentMotion>;
  effects: VisualEffect[];
  removeExpiredEffects: (now: number) => void;
  enabled: boolean;
  reducedMotion: boolean;
}): void {
  const { nowRef, enabled, reducedMotion } = args;
  const [, forceUpdate] = useState(0);
  const stateRef = useRef(args);
  useEffect(() => {
    stateRef.current = args;
  });

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let lastEffectPruneTime = 0;

    const tick = (now: number) => {
      nowRef.current = now;
      const { documentTransfers, motionById, effects, removeExpiredEffects } =
        stateRef.current;
      if (now - lastEffectPruneTime >= 500) {
        lastEffectPruneTime = now;
        removeExpiredEffects(now);
      }
      forceUpdate((n) => n + 1);

      const moving = Object.values(motionById).some(
        (motion) =>
          motion.phase === "entering" ||
          motion.phase === "walking" ||
          motion.phase === "returning",
      );
      if (
        !reducedMotion &&
        (documentTransfers.length > 0 || effects.length > 0 || moving)
      ) {
        raf = requestAnimationFrame(tick);
      } else {
        // No 60fps polling when the scene is idle. Wall-clock expiry continues
        // even with reduced motion, so transfers/effects cannot become stuck.
        timeout = setTimeout(
          () => tick(performance.now()),
          reducedMotion ? 1000 : 200,
        );
      }
    };
    tick(performance.now());
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [enabled, nowRef, reducedMotion]);
}
