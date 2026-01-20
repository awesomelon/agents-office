import { Container, Graphics, Text } from "@pixi/react";
import { useCallback } from "react";
import { TextStyle } from "pixi.js";
import { AGENT_COLORS } from "../../../../types";
import type { AgentStatus, AgentType } from "../../../../types";
import {
  ALERT_LIGHT_BLINK_MS,
  DESK_VACATION_SIGN_X,
  DESK_VACATION_SIGN_Y,
  QUEUE_DOT_BLINK_MS,
  VACATION_SIGN_HEIGHT,
  VACATION_SIGN_WIDTH,
} from "../constants";
import { useFrameAnimation } from "../hooks/useFrameAnimation";

interface DeskProps {
  x: number;
  y: number;
  label: string;
  showVacation: boolean;
  hasError: boolean;
  agentStatus: AgentStatus;
  agentType: AgentType;
}

const DESK_LABEL_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 7,
  fill: 0xe0d0c0,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

export function Desk({ x, y, label, showVacation, hasError, agentStatus, agentType }: DeskProps): JSX.Element {
  const draw = useCallback((g: any) => {
    g.clear();
    drawDeskBase(g);
    drawMonitorFrame(g);
    drawKeyboard(g);
    drawDeskItems(g);
  }, []);

  return (
    <Container x={x} y={y}>
      <Graphics draw={draw} />
      <MonitorScreen status={agentStatus} agentType={agentType} />
      {hasError && (
        <Container x={25} y={-28}>
          <AlertLight />
        </Container>
      )}
      {showVacation && (
        <Container x={DESK_VACATION_SIGN_X} y={DESK_VACATION_SIGN_Y}>
          <VacationSign />
          <Container x={0} y={22}>
            <QueueIndicator />
          </Container>
        </Container>
      )}
      <Text text={label} style={DESK_LABEL_STYLE} anchor={0.5} y={45} />
    </Container>
  );
}

function drawDeskBase(g: any): void {
  // Shadow
  g.beginFill(0x000000, 0.2);
  g.drawRect(-42, 28, 84, 8);
  g.endFill();

  // Legs
  g.beginFill(0x654321);
  g.drawRect(-38, 20, 6, 15);
  g.drawRect(32, 20, 6, 15);
  g.endFill();

  // Surface
  g.beginFill(0x8b5a2b);
  g.drawRect(-45, -5, 90, 30);
  g.endFill();

  // Surface highlight
  g.beginFill(0xa0693e);
  g.drawRect(-43, -3, 86, 8);
  g.endFill();

  // Edge
  g.beginFill(0x654321);
  g.drawRect(-45, 23, 90, 4);
  g.endFill();
}

function drawMonitorFrame(g: any): void {
  // Back/frame
  g.beginFill(0x2a2a2a);
  g.drawRect(-18, -25, 36, 24);
  g.endFill();

  // Stand
  g.beginFill(0x2a2a2a);
  g.drawRect(-4, -3, 8, 6);
  g.endFill();
}

interface MonitorScreenProps {
  status: AgentStatus;
  agentType: AgentType;
}

function MonitorScreen({ status, agentType }: MonitorScreenProps): JSX.Element {
  const frame = useFrameAnimation(8, 150, status !== "idle");

  const draw = useCallback((g: any) => {
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

const SCREEN_COLORS: Record<AgentStatus, number> = {
  idle: 0x1a2a3a,
  working: 0x0a2a1a,
  thinking: 0x1a1a3a,
  passing: 0x2a1a3a,
  error: 0x3a1a1a,
};

function drawIdleScreen(g: any): void {
  // Dim screen with scanlines
  g.beginFill(0x2a3a4a, 0.3);
  for (let y = -22; y < -5; y += 2) {
    g.drawRect(-15, y, 30, 1);
  }
  g.endFill();
}

function drawWorkingScreen(g: any, agentType: AgentType, frame: number): void {
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

function drawThinkingScreen(g: any, frame: number): void {
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

function drawPassingScreen(g: any, frame: number): void {
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

function drawErrorScreen(g: any, frame: number): void {
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

function drawKeyboard(g: any): void {
  g.beginFill(0x3a3a3a);
  g.drawRect(-14, 8, 28, 10);
  g.endFill();

  // Keys
  g.beginFill(0x4a4a4a);
  for (let kx = -12; kx < 12; kx += 4) {
    g.drawRect(kx, 10, 3, 3);
    g.drawRect(kx, 14, 3, 2);
  }
  g.endFill();
}

function drawDeskItems(g: any): void {
  // Mug
  g.beginFill(0xd4a574);
  g.drawRect(25, 2, 12, 14);
  g.endFill();
  g.beginFill(0xb8956a);
  g.drawRect(27, 4, 8, 10);
  g.endFill();

  // Notebook
  g.beginFill(0xf5f5dc);
  g.drawRect(-38, 6, 16, 12);
  g.endFill();
  g.lineStyle(1, 0x87ceeb);
  g.moveTo(-36, 10);
  g.lineTo(-24, 10);
  g.moveTo(-36, 13);
  g.lineTo(-26, 13);
}

const VACATION_SIGN_TEXT_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 6,
  fill: 0xfff7ed,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

function VacationSign(): JSX.Element {
  const draw = useCallback((g: any) => {
    g.clear();

    // Sign shadow
    g.beginFill(0x000000, 0.2);
    g.drawRoundedRect(-VACATION_SIGN_WIDTH / 2 + 1, -VACATION_SIGN_HEIGHT / 2 + 1, VACATION_SIGN_WIDTH, VACATION_SIGN_HEIGHT, 4);
    g.endFill();

    // Sign base
    g.beginFill(0x8b5a2b);
    g.drawRoundedRect(-VACATION_SIGN_WIDTH / 2, -VACATION_SIGN_HEIGHT / 2, VACATION_SIGN_WIDTH, VACATION_SIGN_HEIGHT, 4);
    g.endFill();

    // Border
    g.lineStyle(1, 0x654321, 0.8);
    g.drawRoundedRect(-VACATION_SIGN_WIDTH / 2, -VACATION_SIGN_HEIGHT / 2, VACATION_SIGN_WIDTH, VACATION_SIGN_HEIGHT, 4);

    // Pin
    g.lineStyle(0);
    g.beginFill(0xef4444);
    g.drawCircle(-VACATION_SIGN_WIDTH / 2 + 6, -VACATION_SIGN_HEIGHT / 2 + 6, 2);
    g.endFill();
  }, []);

  return (
    <Container>
      <Graphics draw={draw} />
      <Text text="휴가중" style={VACATION_SIGN_TEXT_STYLE} anchor={0.5} />
    </Container>
  );
}

// AlertLight component: flashing red siren on desk
function AlertLight(): JSX.Element {
  const frame = useFrameAnimation(2, ALERT_LIGHT_BLINK_MS);

  const draw = useCallback((g: any) => {
    g.clear();

    const isOn = frame === 0;

    // Light glow when on
    if (isOn) {
      g.beginFill(0xff4040, 0.3);
      g.drawCircle(0, 0, 10);
      g.endFill();
    }

    // Light base
    g.beginFill(0x2a2a2a);
    g.drawRect(-4, 2, 8, 4);
    g.endFill();

    // Light dome
    g.beginFill(isOn ? 0xff4040 : 0x8b2020);
    g.drawCircle(0, 0, 5);
    g.endFill();

    // Highlight
    if (isOn) {
      g.beginFill(0xffffff, 0.5);
      g.drawCircle(-1, -1, 2);
      g.endFill();
    }
  }, [frame]);

  return <Graphics draw={draw} />;
}

// QueueIndicator component: loading dots animation for rate limit
function QueueIndicator(): JSX.Element {
  const frame = useFrameAnimation(3, QUEUE_DOT_BLINK_MS);

  const draw = useCallback((g: any) => {
    g.clear();

    // Hourglass icon
    g.beginFill(0xfbbf24, 0.8);
    // Top half
    g.moveTo(-4, -8);
    g.lineTo(4, -8);
    g.lineTo(0, -3);
    g.closePath();
    // Bottom half
    g.moveTo(-4, 2);
    g.lineTo(4, 2);
    g.lineTo(0, -3);
    g.closePath();
    g.endFill();

    // Loading dots
    for (let i = 0; i < 3; i++) {
      const alpha = i === frame ? 1 : 0.3;
      g.beginFill(0xfbbf24, alpha);
      g.drawCircle(-6 + i * 6, 10, 2);
      g.endFill();
    }
  }, [frame]);

  return <Graphics draw={draw} />;
}

