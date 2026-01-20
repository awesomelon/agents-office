import { Container, Graphics, Text } from "@pixi/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TextStyle } from "pixi.js";
import type { Graphics as PixiGraphics } from "pixi.js";
import { AGENT_COLORS, STATUS_COLORS } from "../../../../types";
import type { Agent } from "../../../../types";
import { formatAgentMessage } from "../../../../utils";
import {
  ANIMATION_INTERVAL_MS,
  SPEECH_BUBBLE_MAX_CHARS,
  SPEECH_BUBBLE_TRUNCATE_AT,
  WALKING_ANIMATION_INTERVAL_MS,
} from "../constants";
import type { AgentMood, AgentMotion } from "../types";
import { drawAgent, HAIR_COLORS } from "./agentDrawing";

// Re-export for backward compatibility
export { computeAgentMood } from "./agentMood";

interface AgentSpriteProps {
  agent: Agent;
  x: number;
  y: number;
  alpha: number;
  motion?: AgentMotion;
  mood: AgentMood;
}

export function AgentSprite({ agent, x, y, alpha, motion, mood }: AgentSpriteProps): JSX.Element {
  const [frame, setFrame] = useState(0);
  const [walkFrame, setWalkFrame] = useState(0);
  const color = AGENT_COLORS[agent.agent_type];
  const statusColor = STATUS_COLORS[agent.status];
  const hairColor = HAIR_COLORS[agent.agent_type];

  // Walking state
  const isWalking = motion?.phase === "walking" || motion?.phase === "returning";
  const walkDirection = isWalking && motion ? (motion.to.x < motion.from.x ? -1 : 1) : 1;

  useEffect(() => {
    if (agent.status === "idle" && !isWalking) return;

    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 4);
    }, ANIMATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [agent.status, isWalking]);

  // Faster walking animation
  useEffect(() => {
    if (!isWalking) return;

    const interval = setInterval(() => {
      setWalkFrame((f) => (f + 1) % 4);
    }, WALKING_ANIMATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isWalking]);

  const message = useMemo(() => {
    if (agent.status === "idle") return "";
    return formatAgentMessage({
      status: agent.status,
      agentType: agent.agent_type,
      rawTask: agent.current_task,
    });
  }, [agent.status, agent.agent_type, agent.current_task]);

  const effectiveFrame = isWalking ? walkFrame : frame;
  const bounce = (agent.status !== "idle" || isWalking) ? Math.sin(effectiveFrame * Math.PI / 2) * 3 : 0;

  const draw = useCallback((g: PixiGraphics) => {
    drawAgent(g, {
      bounce,
      color,
      hairColor,
      statusColor,
      status: agent.status,
      frame: effectiveFrame,
      isWalking,
      walkDirection,
      mood,
    });
  }, [bounce, color, hairColor, statusColor, agent.status, effectiveFrame, isWalking, walkDirection, mood]);

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
