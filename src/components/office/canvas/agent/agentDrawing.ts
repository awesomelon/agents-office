/**
 * Agent drawing utilities for PixiJS Graphics.
 * Extracted from AgentSprite.tsx for better maintainability.
 */
import type { Graphics } from "pixi.js";
import type { AgentMood } from "../types";
import type { AgentType } from "../../../../types";

// =============================================================================
// Constants
// =============================================================================

/** Hair colors by agent type */
export const HAIR_COLORS: Record<AgentType, number> = {
  reader: 0x4a3728, // Brown
  searcher: 0x2a4a6a, // Dark blue
  writer: 0x2a5a2a, // Dark green
  editor: 0x2a2a3a, // Dark
  runner: 0x8b6914, // Blonde
  tester: 0x8b4514, // Auburn
  planner: 0x8b2252, // Reddish
  support: 0x5a2a6a, // Purple
};

// Agent body part pixel coordinates
const BODY = {
  // Legs
  LEG_LEFT_X: -8,
  LEG_LEFT_WIDTH: 6,
  LEG_RIGHT_X: 2,
  LEG_RIGHT_WIDTH: 6,
  LEG_HEIGHT: 14,
  LEG_Y: 15,
  SHOE_LEFT_X: -9,
  SHOE_RIGHT_X: 1,
  SHOE_WIDTH: 8,
  SHOE_HEIGHT: 4,
  SHOE_Y: 26,
  // Torso
  TORSO_X: -10,
  TORSO_Y: -5,
  TORSO_WIDTH: 20,
  TORSO_HEIGHT: 22,
  COLLAR_X: -4,
  COLLAR_Y: -5,
  COLLAR_WIDTH: 8,
  COLLAR_HEIGHT: 4,
  // Arms
  ARM_LEFT_X: -14,
  ARM_RIGHT_X: 9,
  ARM_WIDTH: 5,
  ARM_Y: -2,
  ARM_HEIGHT: 16,
  HAND_Y: 12,
  HAND_SIZE: 5,
  // Head
  HEAD_X: -10,
  HEAD_Y: -25,
  HEAD_WIDTH: 20,
  HEAD_HEIGHT: 22,
  // Hair
  HAIR_TOP_X: -11,
  HAIR_TOP_Y: -28,
  HAIR_TOP_WIDTH: 22,
  HAIR_TOP_HEIGHT: 8,
  // Eyes
  EYE_LEFT_X: -7,
  EYE_RIGHT_X: 2,
  EYE_Y: -18,
  EYE_WIDTH: 5,
  EYE_HEIGHT: 5,
  PUPIL_SIZE: 3,
  // Shadow
  SHADOW_Y: 28,
  SHADOW_RX: 14,
  SHADOW_RY: 5,
} as const;

// =============================================================================
// Drawing Functions
// =============================================================================

export function drawAgentShadow(g: Graphics): void {
  g.beginFill(0x000000, 0.25);
  g.drawEllipse(0, BODY.SHADOW_Y, BODY.SHADOW_RX, BODY.SHADOW_RY);
  g.endFill();
}

export function drawAgentLegs(
  g: Graphics,
  bounce: number,
  isAnimating: boolean,
  frame: number,
  isWalking = false
): void {
  // Walking uses larger leg movement
  const legOffset = isWalking
    ? Math.sin(frame * Math.PI) * 4
    : isAnimating
      ? Math.sin(frame * Math.PI) * 2
      : 0;

  // Legs
  g.beginFill(0x3a3a5a);
  g.drawRect(BODY.LEG_LEFT_X, BODY.LEG_Y - bounce, BODY.LEG_LEFT_WIDTH, BODY.LEG_HEIGHT);
  g.drawRect(BODY.LEG_RIGHT_X, BODY.LEG_Y - bounce + legOffset, BODY.LEG_RIGHT_WIDTH, BODY.LEG_HEIGHT - legOffset);
  g.endFill();

  // Shoes
  g.beginFill(0x2a2a3a);
  g.drawRect(BODY.SHOE_LEFT_X, BODY.SHOE_Y - bounce, BODY.SHOE_WIDTH, BODY.SHOE_HEIGHT);
  g.drawRect(BODY.SHOE_RIGHT_X, BODY.SHOE_Y - bounce + legOffset, BODY.SHOE_WIDTH, BODY.SHOE_HEIGHT - legOffset / 2);
  g.endFill();
}

export function drawAgentBody(
  g: Graphics,
  bounce: number,
  color: number,
  isAnimating: boolean,
  frame: number,
  isWalking = false
): void {
  // Walking uses larger arm swing
  const armSwing = isWalking
    ? Math.sin(frame * Math.PI) * 5
    : isAnimating
      ? Math.sin(frame * Math.PI) * 3
      : 0;

  // Torso
  g.beginFill(color);
  g.drawRect(BODY.TORSO_X, BODY.TORSO_Y - bounce, BODY.TORSO_WIDTH, BODY.TORSO_HEIGHT);
  g.endFill();

  // Body shading
  g.beginFill(0x000000, 0.15);
  g.drawRect(5, -3 - bounce, 5, 18);
  g.endFill();

  // Collar
  g.beginFill(0xffffff, 0.3);
  g.drawRect(BODY.COLLAR_X, BODY.COLLAR_Y - bounce, BODY.COLLAR_WIDTH, BODY.COLLAR_HEIGHT);
  g.endFill();

  // Arms
  g.beginFill(color);
  g.drawRect(BODY.ARM_LEFT_X, BODY.ARM_Y - bounce, BODY.ARM_WIDTH, BODY.ARM_HEIGHT + armSwing);
  g.drawRect(BODY.ARM_RIGHT_X, BODY.ARM_Y - bounce + armSwing, BODY.ARM_WIDTH, BODY.ARM_HEIGHT - armSwing);
  g.endFill();

  // Hands
  g.beginFill(0xffd5b4);
  g.drawRect(BODY.ARM_LEFT_X, BODY.HAND_Y - bounce + armSwing, BODY.HAND_SIZE, BODY.HAND_SIZE);
  g.drawRect(BODY.ARM_RIGHT_X, BODY.HAND_Y - bounce, BODY.HAND_SIZE, BODY.HAND_SIZE);
  g.endFill();
}

export function drawAgentHead(g: Graphics, bounce: number, hairColor: number): void {
  // Head
  g.beginFill(0xffd5b4);
  g.drawRect(BODY.HEAD_X, BODY.HEAD_Y - bounce, BODY.HEAD_WIDTH, BODY.HEAD_HEIGHT);
  g.endFill();

  // Hair
  g.beginFill(hairColor);
  g.drawRect(BODY.HAIR_TOP_X, BODY.HAIR_TOP_Y - bounce, BODY.HAIR_TOP_WIDTH, BODY.HAIR_TOP_HEIGHT);
  g.drawRect(-10, -26 - bounce, 20, 3);
  g.drawRect(-11, -22 - bounce, 3, 6);
  g.drawRect(8, -22 - bounce, 3, 6);
  g.endFill();
}

export function drawAgentFace(
  g: Graphics,
  bounce: number,
  status: string,
  frame: number,
  direction = 1,
  isWalking = false,
  mood: AgentMood = "neutral",
  isBlinking = false
): void {
  drawEyebrows(g, bounce, mood);
  drawEyes(g, bounce, mood, isBlinking);
  // Don't draw pupils when blinking
  if (!isBlinking) {
    drawPupils(g, bounce, status, frame, direction, isWalking, mood);
  }
  drawMouth(g, bounce, status, mood);
  drawMoodEffects(g, bounce, frame, mood);
}

function drawEyebrows(g: Graphics, bounce: number, mood: AgentMood): void {
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
}

function drawEyes(g: Graphics, bounce: number, mood: AgentMood, isBlinking = false): void {
  g.beginFill(0xffffff);
  if (mood === "blocked" || isBlinking) {
    // Closed eyes (horizontal lines) - for blocked mood or blinking
    g.drawRect(BODY.EYE_LEFT_X, -16 - bounce, BODY.EYE_WIDTH, 2);
    g.drawRect(BODY.EYE_RIGHT_X, -16 - bounce, BODY.EYE_WIDTH, 2);
  } else {
    g.drawRect(BODY.EYE_LEFT_X, BODY.EYE_Y - bounce, BODY.EYE_WIDTH, BODY.EYE_HEIGHT);
    g.drawRect(BODY.EYE_RIGHT_X, BODY.EYE_Y - bounce, BODY.EYE_WIDTH, BODY.EYE_HEIGHT);
  }
  g.endFill();
}

function drawPupils(
  g: Graphics,
  bounce: number,
  status: string,
  frame: number,
  direction: number,
  isWalking: boolean,
  mood: AgentMood
): void {
  if (mood === "blocked") return;

  const { lookX, lookY } = isWalking
    ? { lookX: direction * 1.5, lookY: 0 }
    : getPupilOffset(status, frame, mood);

  g.beginFill(0x2a2a3a);
  g.drawRect(-6 + lookX, -17 - bounce + lookY, BODY.PUPIL_SIZE, BODY.PUPIL_SIZE);
  g.drawRect(3 + lookX, -17 - bounce + lookY, BODY.PUPIL_SIZE, BODY.PUPIL_SIZE);
  g.endFill();
}

function drawMouth(g: Graphics, bounce: number, status: string, mood: AgentMood): void {
  const style = getMouthStyle(status, mood);
  g.beginFill(style.color);
  g.drawRect(-3 + style.xOffset, -9 - bounce, style.width, style.height);
  g.endFill();
}

function drawMoodEffects(g: Graphics, bounce: number, frame: number, mood: AgentMood): void {
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

function getPupilOffset(
  status: string,
  frame: number,
  mood: AgentMood = "neutral"
): { lookX: number; lookY: number } {
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

interface MouthStyle {
  color: number;
  width: number;
  height: number;
  xOffset: number;
}

function getMouthStyle(status: string, mood: AgentMood = "neutral"): MouthStyle {
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

export function drawStatusIndicator(
  g: Graphics,
  bounce: number,
  statusColor: number,
  isError: boolean
): void {
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

// =============================================================================
// Composite Drawing Function
// =============================================================================

export interface DrawAgentOptions {
  bounce: number;
  color: number;
  hairColor: number;
  statusColor: number;
  status: string;
  frame: number;
  isWalking: boolean;
  walkDirection: number;
  mood: AgentMood;
  isBlinking?: boolean;
  leanAngle?: number; // Body lean angle in radians for curved walking
}

/**
 * Draw complete agent sprite to a Graphics object.
 */
export function drawAgent(g: Graphics, options: DrawAgentOptions): void {
  const {
    bounce,
    color,
    hairColor,
    statusColor,
    status,
    frame,
    isWalking,
    walkDirection,
    mood,
    isBlinking = false,
    leanAngle = 0,
  } = options;

  const isAnimating = status === "working" || status === "thinking" || isWalking;

  g.clear();

  // Apply body lean rotation for curved walking
  if (leanAngle !== 0) {
    g.rotation = leanAngle;
  }

  drawAgentShadow(g);
  drawAgentLegs(g, bounce, isAnimating, frame, isWalking);
  drawAgentBody(g, bounce, color, isAnimating, frame, isWalking);
  drawAgentHead(g, bounce, hairColor);
  drawAgentFace(g, bounce, status, frame, walkDirection, isWalking, mood, isBlinking);
  drawStatusIndicator(g, bounce, statusColor, status === "error");

  // Reset rotation
  if (leanAngle !== 0) {
    g.rotation = 0;
  }
}
