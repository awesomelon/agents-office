import { Container, Graphics, Text } from "@pixi/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TextStyle } from "pixi.js";
import { AGENT_COLORS, STATUS_COLORS } from "../../../../types";
import type { Agent, AgentType } from "../../../../types";
import { formatAgentMessage } from "../../../../utils";
import {
  ANIMATION_INTERVAL_MS,
  MOOD_FOCUSED_THRESHOLD_MS,
  MOOD_STRESSED_THRESHOLD_MS,
  SPEECH_BUBBLE_MAX_CHARS,
  SPEECH_BUBBLE_TRUNCATE_AT,
  WALKING_ANIMATION_INTERVAL_MS,
} from "../constants";
import type { AgentMood, AgentMotion } from "../types";

// Hair colors by agent type
const HAIR_COLORS: Record<AgentType, number> = {
  reader: 0x4a3728, // Brown
  searcher: 0x2a4a6a, // Dark blue
  writer: 0x2a5a2a, // Dark green
  editor: 0x2a2a3a, // Dark
  runner: 0x8b6914, // Blonde
  tester: 0x8b4514, // Auburn
  planner: 0x8b2252, // Reddish
  support: 0x5a2a6a, // Purple
};

export function computeAgentMood(
  agentId: string,
  errorById: Record<string, boolean>,
  vacationById: Record<string, boolean>,
  lastToolCallAtById: Record<string, number>,
  lastErrorAtById: Record<string, number>,
  now: number
): AgentMood {
  // Priority 1: Blocked (rate limit)
  if (vacationById[agentId]) return "blocked";

  // Priority 2: Stressed (recent error)
  if (errorById[agentId]) return "stressed";
  const lastError = lastErrorAtById[agentId];
  if (lastError && now - lastError < MOOD_STRESSED_THRESHOLD_MS) return "stressed";

  // Priority 3: Focused (recent tool_call)
  const lastToolCall = lastToolCallAtById[agentId];
  if (lastToolCall && now - lastToolCall < MOOD_FOCUSED_THRESHOLD_MS) return "focused";

  return "neutral";
}

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

  const draw = useCallback((g: any) => {
    g.clear();

    const effectiveFrame = isWalking ? walkFrame : frame;
    const bounce = (agent.status !== "idle" || isWalking) ? Math.sin(effectiveFrame * Math.PI / 2) * 3 : 0;
    const isWorking = agent.status === "working" || agent.status === "thinking";

    drawAgentShadow(g);
    drawAgentLegs(g, bounce, isWorking || isWalking, effectiveFrame, isWalking);
    drawAgentBody(g, bounce, color, isWorking || isWalking, effectiveFrame, isWalking);
    drawAgentHead(g, bounce, hairColor);
    drawAgentFace(g, bounce, agent.status, effectiveFrame, walkDirection, isWalking, mood);
    drawStatusIndicator(g, bounce, statusColor, agent.status === "error");
  }, [color, statusColor, hairColor, frame, walkFrame, agent.status, isWalking, walkDirection, mood]);

  const showBubble = agent.status !== "idle" && message;

  return (
    <Container x={x} y={y} alpha={alpha}>
      <Graphics draw={draw} />
      {showBubble && <SpeechBubble text={message} />}
    </Container>
  );
}

// Agent drawing helper functions
function drawAgentShadow(g: any): void {
  g.beginFill(0x000000, 0.25);
  g.drawEllipse(0, 28, 14, 5);
  g.endFill();
}

function drawAgentLegs(g: any, bounce: number, isWorking: boolean, frame: number, isWalking: boolean = false): void {
  // Walking uses larger leg movement
  const legOffset = isWalking
    ? Math.sin(frame * Math.PI) * 4
    : (isWorking ? Math.sin(frame * Math.PI) * 2 : 0);

  // Legs
  g.beginFill(0x3a3a5a);
  g.drawRect(-8, 15 - bounce, 6, 14);
  g.drawRect(2, 15 - bounce + legOffset, 6, 14 - legOffset);
  g.endFill();

  // Shoes
  g.beginFill(0x2a2a3a);
  g.drawRect(-9, 26 - bounce, 8, 4);
  g.drawRect(1, 26 - bounce + legOffset, 8, 4 - legOffset / 2);
  g.endFill();
}

function drawAgentBody(g: any, bounce: number, color: number, isWorking: boolean, frame: number, isWalking: boolean = false): void {
  // Walking uses larger arm swing
  const armSwing = isWalking
    ? Math.sin(frame * Math.PI) * 5
    : (isWorking ? Math.sin(frame * Math.PI) * 3 : 0);

  // Torso
  g.beginFill(color);
  g.drawRect(-10, -5 - bounce, 20, 22);
  g.endFill();

  // Body shading
  g.beginFill(0x000000, 0.15);
  g.drawRect(5, -3 - bounce, 5, 18);
  g.endFill();

  // Collar
  g.beginFill(0xffffff, 0.3);
  g.drawRect(-4, -5 - bounce, 8, 4);
  g.endFill();

  // Arms
  g.beginFill(color);
  g.drawRect(-14, -2 - bounce, 5, 16 + armSwing);
  g.drawRect(9, -2 - bounce + armSwing, 5, 16 - armSwing);
  g.endFill();

  // Hands
  g.beginFill(0xffd5b4);
  g.drawRect(-14, 12 - bounce + armSwing, 5, 5);
  g.drawRect(9, 12 - bounce, 5, 5);
  g.endFill();
}

function drawAgentHead(g: any, bounce: number, hairColor: number): void {
  // Head
  g.beginFill(0xffd5b4);
  g.drawRect(-10, -25 - bounce, 20, 22);
  g.endFill();

  // Hair
  g.beginFill(hairColor);
  g.drawRect(-11, -28 - bounce, 22, 8);
  g.drawRect(-10, -26 - bounce, 20, 3);
  g.drawRect(-11, -22 - bounce, 3, 6);
  g.drawRect(8, -22 - bounce, 3, 6);
  g.endFill();
}

function drawAgentFace(
  g: any,
  bounce: number,
  status: string,
  frame: number,
  direction: number = 1,
  isWalking: boolean = false,
  mood: AgentMood = "neutral"
): void {
  // Eyebrows based on mood
  if (mood === "stressed") {
    // Worried eyebrows (angled up in center)
    g.beginFill(0x4a3728, 0.8);
    g.drawRect(-8, -21 - bounce, 5, 1);
    g.drawRect(-7, -22 - bounce, 3, 1);
    g.drawRect(3, -21 - bounce, 5, 1);
    g.drawRect(4, -22 - bounce, 3, 1);
    g.endFill();
  } else if (mood === "focused") {
    // Focused eyebrows (angled down in center)
    g.beginFill(0x4a3728, 0.7);
    g.drawRect(-8, -22 - bounce, 5, 1);
    g.drawRect(-6, -21 - bounce, 3, 1);
    g.drawRect(3, -22 - bounce, 5, 1);
    g.drawRect(3, -21 - bounce, 3, 1);
    g.endFill();
  }

  // Eyes
  g.beginFill(0xffffff);
  if (mood === "blocked") {
    // Sleepy/closed eyes (horizontal lines)
    g.drawRect(-7, -16 - bounce, 5, 2);
    g.drawRect(2, -16 - bounce, 5, 2);
  } else {
    g.drawRect(-7, -18 - bounce, 5, 5);
    g.drawRect(2, -18 - bounce, 5, 5);
  }
  g.endFill();

  // Pupils - look in walking direction when walking, or based on mood
  if (mood !== "blocked") {
    const { lookX, lookY } = isWalking
      ? { lookX: direction * 1.5, lookY: 0 }
      : getPupilOffset(status, frame, mood);
    g.beginFill(0x2a2a3a);
    g.drawRect(-6 + lookX, -17 - bounce + lookY, 3, 3);
    g.drawRect(3 + lookX, -17 - bounce + lookY, 3, 3);
    g.endFill();
  }

  // Mouth
  const mouthStyle = getMouthStyle(status, mood);
  g.beginFill(mouthStyle.color);
  g.drawRect(-3 + mouthStyle.xOffset, -9 - bounce, mouthStyle.width, mouthStyle.height);
  g.endFill();

  // Sweat drop for stressed mood
  if (mood === "stressed" && frame % 2 === 0) {
    g.beginFill(0x60a5fa, 0.7);
    g.drawRect(10, -16 - bounce, 2, 3);
    g.drawRect(10, -13 - bounce, 2, 2);
    g.endFill();
  }

  // Z marks for blocked mood
  if (mood === "blocked") {
    g.beginFill(0x94a3b8, 0.6);
    g.drawRect(12, -24 - bounce, 4, 1);
    g.drawRect(14, -23 - bounce, 2, 1);
    g.drawRect(12, -22 - bounce, 4, 1);
    g.endFill();
  }
}

function getPupilOffset(status: string, frame: number, mood: AgentMood = "neutral"): { lookX: number; lookY: number } {
  // Mood-based pupil adjustments
  if (mood === "focused") {
    return { lookX: 0, lookY: 0 }; // Straight ahead, focused
  }
  if (mood === "stressed") {
    // Slightly jittery/nervous
    return { lookX: Math.sin(frame * 1.5) * 1, lookY: -0.5 };
  }

  // Status-based defaults
  if (status === "thinking") {
    return { lookX: Math.sin(frame * 0.8) * 2, lookY: -1 };
  }
  if (status === "passing") {
    return { lookX: 2, lookY: 0 };
  }
  return { lookX: 0, lookY: 0 };
}

function getMouthStyle(status: string, mood: AgentMood = "neutral"): { color: number; width: number; height: number; xOffset: number } {
  // Mood-based mouth styles
  if (mood === "stressed") {
    return { color: 0x8b4513, width: 5, height: 1, xOffset: 0 }; // Tense line
  }
  if (mood === "blocked") {
    return { color: 0xb8956a, width: 3, height: 1, xOffset: 1 }; // Neutral small
  }
  if (mood === "focused") {
    return { color: 0xd4956a, width: 3, height: 2, xOffset: 1 }; // Slight smile
  }

  // Status-based defaults
  if (status === "error") {
    return { color: 0x8b4513, width: 6, height: 2, xOffset: 0 };
  }
  if (status === "working") {
    return { color: 0xd4956a, width: 4, height: 1, xOffset: 1 };
  }
  return { color: 0xd4956a, width: 4, height: 2, xOffset: 1 };
}

function drawStatusIndicator(g: any, bounce: number, statusColor: number, isError: boolean): void {
  // Status dot
  g.beginFill(statusColor);
  g.drawCircle(14, -22 - bounce, 5);
  g.endFill();

  // Highlight
  g.beginFill(0xffffff, 0.4);
  g.drawCircle(13, -23 - bounce, 2);
  g.endFill();

  // Error badge
  if (isError) {
    g.beginFill(0xef4444);
    g.drawRect(-4, -38 - bounce, 8, 10);
    g.endFill();
    g.beginFill(0xffffff);
    g.drawRect(-1, -36 - bounce, 2, 5);
    g.drawRect(-1, -30 - bounce, 2, 2);
    g.endFill();
  }
}

interface SpeechBubbleProps {
  text: string;
}

function SpeechBubble({ text }: SpeechBubbleProps): JSX.Element {
  const displayText = text.length > SPEECH_BUBBLE_MAX_CHARS
    ? text.slice(0, SPEECH_BUBBLE_TRUNCATE_AT) + "..."
    : text;

  const bubbleWidth = Math.max(80, Math.min(160, displayText.length * 5 + 20));
  const halfWidth = bubbleWidth / 2;

  const draw = useCallback((g: any) => {
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

