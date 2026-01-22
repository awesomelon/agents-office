import { Container, Graphics, Text } from "@pixi/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextStyle } from "pixi.js";
import type { Graphics as PixiGraphics } from "pixi.js";
import { AGENT_COLORS, STATUS_COLORS } from "../../../../types";
import type { Agent } from "../../../../types";
import { formatAgentMessage } from "../../../../utils";
import {
  BOUNCE_AMPLITUDE,
  LIMB_CYCLE_DURATION_MS,
  SPEECH_BUBBLE_MAX_CHARS,
  SPEECH_BUBBLE_TRUNCATE_AT,
  WALK_BOUNCE_AMPLITUDE,
  WALK_LIMB_CYCLE_DURATION_MS,
} from "../constants";
import { calculateMotionLean } from "../layout";
import type { AgentMood, AgentMotion, BlinkState } from "../types";
import { drawAgent, HAIR_COLORS } from "./agentDrawing";
import { createBlinkState, updateBlinkState } from "./idleAnimations";

// Re-export for backward compatibility
export { computeAgentMood } from "./agentMood";

interface AgentSpriteProps {
  agent: Agent;
  x: number;
  y: number;
  alpha: number;
  motion?: AgentMotion;
  mood: AgentMood;
  now: number;
}

export function AgentSprite({ agent, x, y, alpha, motion, mood, now }: AgentSpriteProps): JSX.Element {
  const color = AGENT_COLORS[agent.agent_type];
  const statusColor = STATUS_COLORS[agent.status];
  const hairColor = HAIR_COLORS[agent.agent_type];

  // Blink state using centralized blink system
  const blinkRef = useRef<BlinkState>(createBlinkState(now));
  const [isBlinking, setIsBlinking] = useState(false);

  // Walking state
  const isWalking = motion?.phase === "walking" || motion?.phase === "returning";
  const walkDirection = isWalking && motion ? (motion.to.x < motion.from.x ? -1 : 1) : 1;

  // Calculate lean angle for curved walking
  const leanAngle = useMemo(() => {
    if (!motion) return 0;
    return calculateMotionLean(motion, now);
  }, [motion, now]);

  // Eye blink effect - uses immutable update pattern
  useEffect(() => {
    const prevState = blinkRef.current;
    const nextState = updateBlinkState(prevState, now);

    // Only update if state actually changed
    if (nextState !== prevState) {
      blinkRef.current = nextState;
      if (nextState.isBlinking !== prevState.isBlinking) {
        setIsBlinking(nextState.isBlinking);
      }
    }
  }, [now]);

  // Calculate continuous animation phase (0-1)
  const animationPhase = useMemo(() => {
    if (agent.status === "idle" && !isWalking) return 0;
    const cycleDuration = isWalking ? WALK_LIMB_CYCLE_DURATION_MS : LIMB_CYCLE_DURATION_MS;
    return (now % cycleDuration) / cycleDuration;
  }, [agent.status, isWalking, now]);

  // Continuous bounce (smooth sinusoidal)
  const bounce = useMemo(() => {
    if (agent.status === "idle" && !isWalking) return 0;
    const amplitude = isWalking ? WALK_BOUNCE_AMPLITUDE : BOUNCE_AMPLITUDE;
    return Math.sin(animationPhase * Math.PI * 2) * amplitude;
  }, [agent.status, isWalking, animationPhase]);

  const message = useMemo(() => {
    if (agent.status === "idle") return "";
    return formatAgentMessage({
      status: agent.status,
      rawTask: agent.current_task,
    });
  }, [agent.status, agent.current_task]);

  const draw = useCallback((g: PixiGraphics) => {
    drawAgent(g, {
      bounce,
      color,
      hairColor,
      statusColor,
      status: agent.status,
      animationPhase,
      isWalking,
      walkDirection,
      mood,
      isBlinking,
      leanAngle,
    });
  }, [bounce, color, hairColor, statusColor, agent.status, animationPhase, isWalking, walkDirection, mood, isBlinking, leanAngle]);

  const showBubble = agent.status !== "idle" && message;

  return (
    <Container x={x} y={y} alpha={alpha}>
      <Graphics draw={draw} />
      {showBubble && <SpeechBubble text={message} />}
    </Container>
  );
}

// =============================================================================
// SpeechBubble Component
// =============================================================================

interface SpeechBubbleProps {
  text: string;
}

function SpeechBubble({ text }: SpeechBubbleProps): JSX.Element {
  const displayText = text.length > SPEECH_BUBBLE_MAX_CHARS
    ? text.slice(0, SPEECH_BUBBLE_TRUNCATE_AT) + "..."
    : text;

  const bubbleWidth = Math.max(80, Math.min(160, displayText.length * 5 + 20));
  const halfWidth = bubbleWidth / 2;

  const draw = useCallback((g: PixiGraphics) => {
    g.clear();

    // Shadow
    g.beginFill(0x000000, 0.15);
    g.drawRoundedRect(-halfWidth + 2, -48, bubbleWidth, 32, 8);
    g.endFill();

    // Background
    g.beginFill(0xffffff);
    g.drawRoundedRect(-halfWidth, -50, bubbleWidth, 32, 8);
    g.endFill();

    // Border
    g.lineStyle(1.5, 0x4a4a6a, 0.5);
    g.drawRoundedRect(-halfWidth, -50, bubbleWidth, 32, 8);

    // Tail
    g.lineStyle(0);
    g.beginFill(0xffffff);
    g.moveTo(-6, -18);
    g.lineTo(6, -18);
    g.lineTo(0, -8);
    g.closePath();
    g.endFill();

    g.lineStyle(1.5, 0x4a4a6a, 0.5);
    g.moveTo(-6, -18);
    g.lineTo(0, -8);
    g.lineTo(6, -18);
  }, [bubbleWidth, halfWidth]);

  const textStyle = useMemo(() => new TextStyle({
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 6,
    fill: 0x2d2d4a,
    wordWrap: true,
    wordWrapWidth: bubbleWidth - 16,
    align: "center",
    lineHeight: 10,
  }), [bubbleWidth]);

  return (
    <Container>
      <Graphics draw={draw} />
      <Text text={displayText} style={textStyle} anchor={0.5} y={-34} />
    </Container>
  );
}
