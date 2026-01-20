import { Container, Stage } from "@pixi/react";
import { useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { startHudPruning, stopHudPruning, useAgentStore, useHudStore } from "../../store";
import { DESK_CONFIGS } from "../../types";
import type { AgentStatus } from "../../types";
import {
  SHOW_HUD,
  SPEECH_BUBBLE_CHECK_INTERVAL_MS,
  SPEECH_BUBBLE_TIMEOUT_MS,
} from "./canvas/constants";
import { computeMotionState, getAgentPosition } from "./canvas/layout";
// ViewportRect is used inside `useOfficeViewport`.
import { AgentSprite, computeAgentMood } from "./canvas/agent/AgentSprite";
import { OfficeBackground } from "./canvas/background/OfficeBackground";
import { Desk } from "./canvas/desk/Desk";
import { FlyingDocument } from "./canvas/document/FlyingDocument";
import { EffectsLayer } from "./canvas/effects/EffectsLayer";
import { HudDisplay } from "./canvas/hud/HudDisplay";
import { HorizontalPartition } from "./canvas/partition/HorizontalPartition";
import { useAgentMotion } from "./canvas/hooks/useAgentMotion";
import { useNowRaf } from "./canvas/hooks/useNowRaf";
import { useOfficeViewport } from "./canvas/hooks/useOfficeViewport";

export function OfficeCanvas(): JSX.Element {
  // Consolidated Zustand selectors using useShallow to reduce re-renders
  const { agents, vacationById, errorById, documentTransfers, lastToolCallAtById, lastErrorAtById, effects } = useAgentStore(
    useShallow((state) => ({
      agents: state.agents,
      vacationById: state.vacationById,
      errorById: state.errorById,
      documentTransfers: state.documentTransfers,
      lastToolCallAtById: state.lastToolCallAtById,
      lastErrorAtById: state.lastErrorAtById,
      effects: state.effects,
    }))
  );
  const removeDocumentTransfer = useAgentStore((state) => state.removeDocumentTransfer);
  const clearExpiredTasks = useAgentStore((state) => state.clearExpiredTasks);
  const removeExpiredEffects = useAgentStore((state) => state.removeExpiredEffects);
  const hudMetrics = useHudStore(useShallow((state) => state.getMetrics()));
  const { dimensions, scale, offsetX, offsetY, viewport } = useOfficeViewport();

  // Use ref for `now` to avoid triggering re-renders on every RAF tick
  const nowRef = useRef(performance.now());

  const motionById = useAgentMotion({ agents, vacationById, nowRef });
  useNowRaf({
    nowRef,
    documentTransfers,
    motionById,
    effects,
    removeExpiredEffects,
  });

  // Start HUD pruning on mount
  useEffect(() => {
    startHudPruning();
    return () => stopHudPruning();
  }, []);

  // RAF loop extracted into `useNowRaf`

  // Clear speech bubbles after timeout
  useEffect(() => {
    const interval = setInterval(() => {
      clearExpiredTasks(SPEECH_BUBBLE_TIMEOUT_MS);
    }, SPEECH_BUBBLE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [clearExpiredTasks]);

  // Agent motion state extracted into `useAgentMotion`

  // Viewport calculation extracted into `useOfficeViewport`

  const visibleAgents = useMemo(() => {
    return Object.values(agents).filter((agent) => {
      const phase = motionById[agent.id]?.phase ?? "absent";
      if (phase !== "absent") return true;
      // Avoid popping an idle agent instantly at full alpha; wait for motion to start.
      return Boolean(vacationById[agent.id]) && Boolean(motionById[agent.id]);
    });
  }, [agents, motionById, vacationById]);

  return (
    <div className="office-container w-full h-full bg-inbox-bg">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        options={{ backgroundColor: 0x1a1a2e, antialias: true }}
      >
        <Container x={offsetX} y={offsetY} scale={scale}>
          <OfficeBackground viewport={viewport} />
          <HorizontalPartition y={70} />
          <HorizontalPartition y={420} />
          {DESK_CONFIGS.map((desk) => {
            const agent = agents[desk.id];
            const agentStatus: AgentStatus = agent?.status ?? "idle";
            return (
              <Desk
                key={desk.id}
                x={desk.position[0]}
                y={desk.position[1]}
                label={desk.label}
                showVacation={Boolean(vacationById[desk.id])}
                hasError={Boolean(errorById[desk.id])}
                agentStatus={agentStatus}
                agentType={desk.agentType}
              />
            );
          })}
          {visibleAgents.map((agent) => {
            const target = getAgentPosition(agent.id); // DESK_CONFIGS 사용
            const motion = motionById[agent.id];
            const state = motion ? computeMotionState(motion, nowRef.current) : { x: target.x, y: target.y, alpha: 1 };
            const mood = computeAgentMood(agent.id, errorById, vacationById, lastToolCallAtById, lastErrorAtById, Date.now());

            return (
              <AgentSprite
                key={agent.id}
                agent={agent}
                x={state.x}
                y={state.y}
                alpha={state.alpha}
                motion={motion}
                mood={mood}
              />
            );
          })}
          {documentTransfers.map((transfer, index) => {
            const stackDepth = documentTransfers.length - 1 - index; // newest = 0
            return (
              <FlyingDocument
                key={transfer.id}
                transfer={transfer}
                now={nowRef.current}
                stackDepth={stackDepth}
                onComplete={removeDocumentTransfer}
              />
            );
          })}
          <EffectsLayer effects={effects} now={nowRef.current} />
          {/* HUD overlay on top of wall */}
          {SHOW_HUD && (
            <HudDisplay
              toolCallCount={hudMetrics.toolCallCount}
              avgToolResponseMs={hudMetrics.avgToolResponseMs}
              errorCount={hudMetrics.errorCount}
              agentSwitchCount={hudMetrics.agentSwitchCount}
              rateLimitActive={hudMetrics.rateLimitActive}
            />
          )}
        </Container>
      </Stage>
    </div>
  );
}

