import { Graphics } from "@pixi/react";
import { useCallback } from "react";
import type { Graphics as PixiGraphics } from "pixi.js";
import { AGENT_COLORS } from "../../../../types";
import type { AgentStatus, AgentType } from "../../../../types";
import { useFrameAnimation } from "../hooks/useFrameAnimation";

/** Background colors for each status */
const SCREEN_COLORS: Record<AgentStatus, number> = {
  idle: 0x1a2a3a,
  working: 0x0a2a1a,
  thinking: 0x1a1a3a,
  passing: 0x2a1a3a,
  error: 0x3a1a1a,
};

interface MonitorScreenProps {
  status: AgentStatus;
  agentType: AgentType;
}

export function MonitorScreen({ status, agentType }: MonitorScreenProps): JSX.Element {
  const frame = useFrameAnimation(8, 150, status !== "idle");

  const draw = useCallback((g: PixiGraphics) => {
    g.clear();

    g.beginFill(SCREEN_COLORS[status]);
    g.drawRect(-16, -23, 32, 18);
    g.endFill();

    switch (status) {
      case "idle":
        drawIdleScreen(g);
        break;
      case "working":
        drawWorkingScreen(g, agentType, frame);
        break;
      case "thinking":
        drawThinkingScreen(g, frame);
        break;
      case "passing":
        drawPassingScreen(g, frame);
        break;
      case "error":
        drawErrorScreen(g, frame);
        break;
    }
  }, [status, agentType, frame]);

  return <Graphics draw={draw} />;
}

function drawIdleScreen(g: PixiGraphics): void {
  // Dim screen with scanlines
  g.beginFill(0x2a3a4a, 0.3);
  for (let y = -22; y < -5; y += 2) {
    g.drawRect(-15, y, 30, 1);
  }
  g.endFill();
}

function drawWorkingScreen(g: PixiGraphics, agentType: AgentType, frame: number): void {
  // Code lines scrolling animation
  const lineColor = AGENT_COLORS[agentType];

  for (let i = 0; i < 5; i++) {
    const yOffset = ((i + frame) % 5) * 3;
    const width = 8 + ((i * 7 + frame) % 12);
    const xOffset = (i % 2) * 4;

    g.beginFill(lineColor, 0.7);
    g.drawRect(-14 + xOffset, -21 + yOffset, width, 2);
    g.endFill();
  }

  // Cursor blink
  if (frame % 2 === 0) {
    g.beginFill(0xffffff, 0.8);
    g.drawRect(10, -9, 2, 3);
    g.endFill();
  }
}

function drawThinkingScreen(g: PixiGraphics, frame: number): void {
  // Loading dots animation
  const dotCount = 3;
  const activeIndex = frame % dotCount;

  for (let i = 0; i < dotCount; i++) {
    const alpha = i === activeIndex ? 1 : 0.3;
    g.beginFill(0x6090ff, alpha);
    g.drawCircle(-6 + i * 6, -14, 2);
    g.endFill();
  }

  // Brain/gear icon
  g.beginFill(0x8090ff, 0.6);
  g.drawCircle(0, -14, 4);
  g.beginFill(0x4060ff, 0.4);
  g.drawCircle(0, -14, 2);
  g.endFill();
}

function drawPassingScreen(g: PixiGraphics, frame: number): void {
  // Arrow animation moving right
  const arrowX = -10 + (frame % 4) * 5;

  g.beginFill(0xa060ff, 0.8);
  // Arrow body
  g.drawRect(arrowX, -15, 8, 4);
  // Arrow head
  g.moveTo(arrowX + 8, -17);
  g.lineTo(arrowX + 12, -13);
  g.lineTo(arrowX + 8, -9);
  g.closePath();
  g.endFill();

  // Transfer icon
  g.beginFill(0xffffff, 0.5);
  g.drawRect(-12, -10, 6, 4);
  g.drawRect(6, -10, 6, 4);
  g.endFill();
}

function drawErrorScreen(g: PixiGraphics, frame: number): void {
  // Flashing warning
  const flash = frame % 2 === 0;

  if (flash) {
    g.beginFill(0xff4040, 0.3);
    g.drawRect(-15, -22, 30, 16);
    g.endFill();
  }

  // Error X mark
  g.lineStyle(2, 0xff6060, 0.9);
  g.moveTo(-6, -18);
  g.lineTo(6, -10);
  g.moveTo(6, -18);
  g.lineTo(-6, -10);
}
