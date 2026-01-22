import { useEffect, useRef, useState } from "react";
import type { VisualEffect } from "../../../../store";
import type { AgentMotion } from "../types";

export function useNowRaf(args: {
  nowRef: React.MutableRefObject<number>;
  documentTransfers: unknown[];
  motionById: Record<string, AgentMotion>;
  effects: VisualEffect[];
  removeExpiredEffects: (now: number) => void;
}): void {
  const { nowRef, documentTransfers, motionById, effects, removeExpiredEffects } = args;
  const [, forceUpdate] = useState(0);

  // Mirror frequently-changing state into refs so the RAF effect can be installed once.
  const documentTransfersRef = useRef(documentTransfers);
  const motionByIdRef = useRef(motionById);
  const effectsRef = useRef(effects);
  const removeExpiredEffectsRef = useRef(removeExpiredEffects);

  useEffect(() => {
    documentTransfersRef.current = documentTransfers;
  }, [documentTransfers]);
  useEffect(() => {
    motionByIdRef.current = motionById;
  }, [motionById]);
  useEffect(() => {
    effectsRef.current = effects;
  }, [effects]);
  useEffect(() => {
    removeExpiredEffectsRef.current = removeExpiredEffects;
  }, [removeExpiredEffects]);

  // Drive animations via requestAnimationFrame - only update when animations active
  useEffect(() => {
    let raf = 0;
    let lastUpdateTime = performance.now();
    let lastEffectPruneTime = performance.now();

    const tick = (t: number) => {
      nowRef.current = t;

      // Prune expired effects periodically (~500ms)
      if (t - lastEffectPruneTime > 500) {
        lastEffectPruneTime = t;
        removeExpiredEffectsRef.current(t);
      }

      // Check if any animations are active
      const hasActiveDocTransfers = documentTransfersRef.current.length > 0;
      const motionSnapshot = motionByIdRef.current;
      const hasEnteringMotions = Object.values(motionSnapshot).some((m) => m.phase === "entering");
      const hasWalkingMotions = Object.values(motionSnapshot).some(
        (m) => m.phase === "walking" || m.phase === "returning"
      );
      const hasActiveEffects = effectsRef.current.length > 0;
      const needsUpdate = hasActiveDocTransfers || hasEnteringMotions || hasWalkingMotions || hasActiveEffects;

      // Adaptive throttling: 60fps during animation, 5fps idle
      const targetInterval = needsUpdate ? 16 : 200;
      if (t - lastUpdateTime > targetInterval) {
        lastUpdateTime = t;
        forceUpdate((n) => n + 1);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nowRef]);
}

