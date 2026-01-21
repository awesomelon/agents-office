import { useEffect, useState } from "react";
import type { Agent } from "../../../../types";
import {
  ENTER_DURATION_MS,
  ENTRY_START_X,
  ENTRY_START_Y,
  WALKABLE_BANDS,
  WALKING_PAUSE_MAX_MS,
  WALKING_PAUSE_MIN_MS,
} from "../constants";
import {
  calculateReturnDuration,
  calculateBezierWalkDuration,
  computeMotionState,
  findCurrentBand,
  generateWaypointInBand,
  generateWalkingControlPoint,
  getAgentPosition,
} from "../layout";
import type { AgentMotion, MotionPhase } from "../types";

/** Create a walking motion from a starting position. */
function createWalkingMotion(
  startPos: { x: number; y: number },
  startedAt: number
): AgentMotion {
  const band = findCurrentBand(startPos.y) ?? WALKABLE_BANDS[1];
  const waypoint = generateWaypointInBand(band);
  const controlPoint = generateWalkingControlPoint(startPos, waypoint);
  return {
    phase: "walking",
    startedAt,
    durationMs: calculateBezierWalkDuration(startPos, waypoint, controlPoint),
    from: { ...startPos, alpha: 1 },
    to: { ...waypoint, alpha: 1 },
    controlPoint,
  };
}

/** Get random pause duration between walking waypoints. */
function getRandomWalkingPause(): number {
  return WALKING_PAUSE_MIN_MS + Math.random() * (WALKING_PAUSE_MAX_MS - WALKING_PAUSE_MIN_MS);
}

export function useAgentMotion(args: {
  agents: Record<string, Agent>;
  vacationById: Record<string, boolean>;
  nowRef: React.MutableRefObject<number>;
}): Record<string, AgentMotion> {
  const { agents, vacationById, nowRef } = args;
  const [motionById, setMotionById] = useState<Record<string, AgentMotion>>({});

  // Start entering transition when agent becomes visible, or set absent when hidden.
  // Also handle walking/returning transitions.
  useEffect(() => {
    const ts = nowRef.current;
    const start = { x: ENTRY_START_X, y: ENTRY_START_Y };

    setMotionById((prev) => {
      const next: Record<string, AgentMotion> = { ...prev };

      for (const agent of Object.values(agents)) {
        const id = agent.id;
        const target = getAgentPosition(id); // DESK_CONFIGS 사용
        const wantsVisible = agent.status !== "idle" || Boolean(vacationById[id]);
        const current = next[id];

        const currentPhase: MotionPhase = current?.phase ?? "absent";
        const isCurrentlyWalking = currentPhase === "walking" || currentPhase === "returning";

        if (wantsVisible) {
          // idle -> working transition
          if (isCurrentlyWalking && current) {
            // Walking -> returning to desk
            const pos = computeMotionState(current, ts);
            next[id] = {
              phase: "returning",
              startedAt: ts,
              durationMs: calculateReturnDuration(pos, target),
              from: { x: pos.x, y: pos.y, alpha: 1 },
              to: { x: target.x, y: target.y, alpha: 1 },
            };
          } else if (currentPhase === "absent") {
            // First appearance: entering from entrance
            next[id] = {
              phase: "entering",
              startedAt: ts,
              durationMs: ENTER_DURATION_MS,
              from: { x: start.x, y: start.y, alpha: 0 },
              to: { x: target.x, y: target.y, alpha: 1 },
            };
          }
        } else if (currentPhase === "present") {
          // working -> idle transition: start walking from desk
          next[id] = createWalkingMotion(target, ts);
        }
        // Keep absent agents in absent state (no walking on first idle)
      }

      return next;
    });
  }, [agents, vacationById, nowRef]);

  // Finalize motion transitions (entering->present, walking->next waypoint, returning->present).
  // Intentionally no dependency array - runs every render to detect completed animations.
  useEffect(() => {
    const ts = nowRef.current;
    setMotionById((prev) => {
      let changed = false;
      const next: Record<string, AgentMotion> = { ...prev };

      for (const [id, motion] of Object.entries(prev)) {
        const progress = (ts - motion.startedAt) / motion.durationMs;
        if (progress < 1) continue;

        if (motion.phase === "entering" || motion.phase === "returning") {
          // Both entering and returning settle into present state
          next[id] = { ...motion, phase: "present" };
          changed = true;
        } else if (motion.phase === "walking") {
          // Walking complete: move to next waypoint in same band after pause
          const pause = getRandomWalkingPause();
          next[id] = createWalkingMotion(motion.to, ts + pause);
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  });

  return motionById;
}

