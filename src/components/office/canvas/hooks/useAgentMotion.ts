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
  calculateWalkDuration,
  computeMotionState,
  findCurrentBand,
  generateWaypointInBand,
  getAgentPosition,
} from "../layout";
import type { AgentMotion, MotionPhase } from "../types";

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
          // idle → working 전환
          if (isCurrentlyWalking) {
            // walking 중이면 returning으로 전환 (책상으로 복귀)
            const pos = computeMotionState(current!, ts);
            next[id] = {
              phase: "returning",
              startedAt: ts,
              durationMs: calculateReturnDuration(pos, target),
              from: { x: pos.x, y: pos.y, alpha: 1 },
              to: { x: target.x, y: target.y, alpha: 1 },
            };
          } else if (currentPhase === "absent") {
            // 첫 등장: entering
            next[id] = {
              phase: "entering",
              startedAt: ts,
              durationMs: ENTER_DURATION_MS,
              from: { x: start.x, y: start.y, alpha: 0 },
              to: { x: target.x, y: target.y, alpha: 1 },
            };
          }
        } else {
          // working → idle 전환: present면 walking 시작
          if (currentPhase === "present") {
            const startPos = { x: target.x, y: target.y };
            const band = findCurrentBand(startPos.y) ?? WALKABLE_BANDS[1]; // fallback
            const waypoint = generateWaypointInBand(band);
            next[id] = {
              phase: "walking",
              startedAt: ts,
              durationMs: calculateWalkDuration(startPos, waypoint),
              from: { ...startPos, alpha: 1 },
              to: { ...waypoint, alpha: 1 },
            };
          }
          // absent 상태면 그대로 유지 (처음 idle은 walking 안 함)
        }
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

        if (motion.phase === "entering") {
          changed = true;
          next[id] = { ...motion, phase: "present" };
        } else if (motion.phase === "returning") {
          changed = true;
          next[id] = { ...motion, phase: "present" };
        } else if (motion.phase === "walking") {
          // walking 완료: 같은 band 내 새 웨이포인트로 이동
          const band = findCurrentBand(motion.to.y) ?? WALKABLE_BANDS[1];
          const waypoint = generateWaypointInBand(band);
          const pause = WALKING_PAUSE_MIN_MS + Math.random() * (WALKING_PAUSE_MAX_MS - WALKING_PAUSE_MIN_MS);

          next[id] = {
            phase: "walking",
            startedAt: ts + pause, // 잠시 멈춤 후 이동
            durationMs: calculateWalkDuration(motion.to, waypoint),
            from: { ...motion.to },
            to: { ...waypoint, alpha: 1 },
          };
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  });

  return motionById;
}

