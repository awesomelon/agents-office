import { Stage, Container, Graphics, Text } from "@pixi/react";
import { useCallback, useState, useEffect, useMemo } from "react";
import { TextStyle } from "pixi.js";
import { useShallow } from "zustand/shallow";
import { useAgentStore, useHudStore, startHudPruning, stopHudPruning, type DocumentTransfer } from "../../store";
import { DESK_CONFIGS, AGENT_COLORS, STATUS_COLORS } from "../../types";
import type { Agent, AgentType, AgentStatus } from "../../types";
import { formatAgentMessage } from "../../utils";

// Canvas dimensions
const OFFICE_WIDTH = 900;
const OFFICE_HEIGHT = 500;

// Floor configuration
const FLOOR_START_Y = 60;
const BRICK_WIDTH = 32;
const BRICK_HEIGHT = 16;

// Wall configuration
const WALL_HEIGHT = 65;

// Animation timing
const ANIMATION_INTERVAL_MS = 250;

// Entry motion
const ENTRY_START_X = OFFICE_WIDTH / 2;
const ENTRY_START_Y = OFFICE_HEIGHT + 60;
const ENTER_DURATION_MS = 700;

// Text limits
const SPEECH_BUBBLE_MAX_CHARS = 45;
const SPEECH_BUBBLE_TRUNCATE_AT = 42;

// Vacation sign
const VACATION_SIGN_WIDTH = 52;
const VACATION_SIGN_HEIGHT = 18;
// Place it on the desk front (below the desktop edge, above the desk label).
const DESK_VACATION_SIGN_X = 0;
const DESK_VACATION_SIGN_Y = 34;

// Document transfer animation
const DOCUMENT_TRANSFER_DURATION_MS = 600;
const DOCUMENT_SIZE = 16;

// Alert light animation
const ALERT_LIGHT_BLINK_MS = 200;

// Queue indicator animation
const QUEUE_DOT_BLINK_MS = 500;

// HUD bar
const HUD_BAR_HEIGHT = 20;

type MotionPhase = "absent" | "entering" | "present";

interface AgentMotion {
  phase: MotionPhase;
  startedAt: number;
  durationMs: number;
  from: { x: number; y: number; alpha: number };
  to: { x: number; y: number; alpha: number };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

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

function OfficeBackground(): JSX.Element {
  const draw = useCallback((g: any) => {
    g.clear();

    // Floor base
    g.beginFill(0x8b6b4a);
    g.drawRect(0, 0, OFFICE_WIDTH, OFFICE_HEIGHT);
    g.endFill();

    // Brick pattern floor
    for (let y = FLOOR_START_Y; y < OFFICE_HEIGHT; y += BRICK_HEIGHT) {
      const offset = Math.floor(y / BRICK_HEIGHT) % 2 === 0 ? 0 : BRICK_WIDTH / 2;
      for (let x = -BRICK_WIDTH / 2 + offset; x < OFFICE_WIDTH + BRICK_WIDTH; x += BRICK_WIDTH) {
        const shade = ((x + y) % 3 === 0) ? 0x7a5c3a : 0x8b6b4a;
        g.beginFill(shade);
        g.drawRect(x, y, BRICK_WIDTH - 1, BRICK_HEIGHT - 1);
        g.endFill();
      }
    }

    // Brick grout lines
    g.lineStyle(1, 0x5a4a3a, 0.3);
    for (let y = FLOOR_START_Y; y < OFFICE_HEIGHT; y += BRICK_HEIGHT) {
      g.moveTo(0, y);
      g.lineTo(OFFICE_WIDTH, y);
    }

    // Wall
    g.lineStyle(0);
    g.beginFill(0x5a4a6a);
    g.drawRect(0, 0, OFFICE_WIDTH, WALL_HEIGHT);
    g.endFill();

    // Wall texture
    g.beginFill(0x6a5a7a, 0.3);
    for (let x = 0; x < OFFICE_WIDTH; x += 8) {
      g.drawRect(x, 0, 4, WALL_HEIGHT);
    }
    g.endFill();

    // Windows (4 windows for wider canvas)
    drawWindows(g, [140, 320, 500, 680]);

    // Decorative plants
    g.lineStyle(0);
    drawPlant(g, 30, OFFICE_HEIGHT - 30);
    drawPlant(g, OFFICE_WIDTH - 30, OFFICE_HEIGHT - 30);
    drawPlant(g, 30, 90);
    drawPlant(g, OFFICE_WIDTH - 30, 90);
  }, []);

  return <Graphics draw={draw} />;
}

function drawWindows(g: any, positions: number[]): void {
  for (const wx of positions) {
    // Window glow
    g.beginFill(0x87ceeb, 0.2);
    g.drawRect(wx - 5, 8, 70, 48);
    g.endFill();

    // Window glass
    g.beginFill(0x87ceeb, 0.6);
    g.drawRect(wx, 12, 60, 40);
    g.endFill();

    // Window frame
    g.lineStyle(3, 0x4a3a3a);
    g.drawRect(wx, 12, 60, 40);

    // Window cross
    g.lineStyle(2, 0x4a3a3a);
    g.moveTo(wx + 30, 12);
    g.lineTo(wx + 30, 52);
    g.moveTo(wx, 32);
    g.lineTo(wx + 60, 32);
  }
}

function drawPlant(g: any, x: number, y: number): void {
  // Pot
  g.beginFill(0x8b4513);
  g.drawRect(x - 8, y - 5, 16, 12);
  g.endFill();

  // Leaves
  g.beginFill(0x228b22);
  g.drawCircle(x - 4, y - 12, 6);
  g.drawCircle(x + 4, y - 12, 6);
  g.drawCircle(x, y - 16, 6);
  g.endFill();
}

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

function Desk({ x, y, label, showVacation, hasError, agentStatus, agentType }: DeskProps): JSX.Element {
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
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (status === "idle") return;

    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 8);
    }, 150);

    return () => clearInterval(interval);
  }, [status]);

  const draw = useCallback((g: any) => {
    g.clear();

    const screenColor = getScreenColor(status);
    g.beginFill(screenColor);
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

function getScreenColor(status: AgentStatus): number {
  switch (status) {
    case "idle": return 0x1a2a3a;
    case "working": return 0x0a2a1a;
    case "thinking": return 0x1a1a3a;
    case "passing": return 0x2a1a3a;
    case "error": return 0x3a1a1a;
    default: return 0x1a2a3a;
  }
}

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

interface AgentSpriteProps {
  agent: Agent;
  x: number;
  y: number;
  alpha: number;
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
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 2);
    }, ALERT_LIGHT_BLINK_MS);
    return () => clearInterval(interval);
  }, []);

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
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 3);
    }, QUEUE_DOT_BLINK_MS);
    return () => clearInterval(interval);
  }, []);

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

// HudDisplay component: top bar showing metrics
interface HudDisplayProps {
  toolCallCount: number;
  avgToolResponseMs: number | null;
  errorCount: number;
  agentSwitchCount: number;
  rateLimitActive: boolean;
}

const HUD_TEXT_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 7,
  fill: 0xe0e0e0,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

const HUD_LIMIT_TEXT_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 7,
  fill: 0xff6060,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

function HudDisplay({ toolCallCount, avgToolResponseMs, errorCount, agentSwitchCount, rateLimitActive }: HudDisplayProps): JSX.Element {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!rateLimitActive) return;
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 2);
    }, 500);
    return () => clearInterval(interval);
  }, [rateLimitActive]);

  const draw = useCallback((g: any) => {
    g.clear();

    // Semi-transparent background bar
    g.beginFill(0x1a1a2e, 0.85);
    g.drawRect(0, 0, OFFICE_WIDTH, HUD_BAR_HEIGHT);
    g.endFill();

    // Bottom border
    g.lineStyle(1, 0x4a4a6a, 0.5);
    g.moveTo(0, HUD_BAR_HEIGHT);
    g.lineTo(OFFICE_WIDTH, HUD_BAR_HEIGHT);
  }, []);

  const avgText = typeof avgToolResponseMs === "number"
    ? (avgToolResponseMs >= 1000 ? `${(avgToolResponseMs / 1000).toFixed(1)}s` : `${avgToolResponseMs}ms`)
    : "--";
  const mainText = `Calls: ${toolCallCount}  Avg: ${avgText}  Err: ${errorCount}  Switch: ${agentSwitchCount}`;
  const showLimitFlash = rateLimitActive && frame === 0;

  return (
    <Container>
      <Graphics draw={draw} />
      <Text text={mainText} style={HUD_TEXT_STYLE} x={10} y={6} />
      {rateLimitActive && (
        <Text
          text="LIMIT"
          style={showLimitFlash ? HUD_LIMIT_TEXT_STYLE : HUD_TEXT_STYLE}
          x={OFFICE_WIDTH - 50}
          y={6}
        />
      )}
    </Container>
  );
}

function AgentSprite({ agent, x, y, alpha }: AgentSpriteProps): JSX.Element {
  const [frame, setFrame] = useState(0);
  const color = AGENT_COLORS[agent.agent_type];
  const statusColor = STATUS_COLORS[agent.status];
  const hairColor = HAIR_COLORS[agent.agent_type];

  useEffect(() => {
    if (agent.status === "idle") return;

    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 4);
    }, ANIMATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [agent.status]);

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

    const bounce = agent.status !== "idle" ? Math.sin(frame * Math.PI / 2) * 3 : 0;
    const isWorking = agent.status === "working" || agent.status === "thinking";

    drawAgentShadow(g);
    drawAgentLegs(g, bounce, isWorking, frame);
    drawAgentBody(g, bounce, color, isWorking, frame);
    drawAgentHead(g, bounce, hairColor);
    drawAgentFace(g, bounce, agent.status, frame);
    drawStatusIndicator(g, bounce, statusColor, agent.status === "error");
  }, [color, statusColor, hairColor, frame, agent.status]);

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

function drawAgentLegs(g: any, bounce: number, isWorking: boolean, frame: number): void {
  const legOffset = isWorking ? Math.sin(frame * Math.PI) * 2 : 0;

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

function drawAgentBody(g: any, bounce: number, color: number, isWorking: boolean, frame: number): void {
  const armSwing = isWorking ? Math.sin(frame * Math.PI) * 3 : 0;

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

function drawAgentFace(g: any, bounce: number, status: string, frame: number): void {
  // Eyes
  g.beginFill(0xffffff);
  g.drawRect(-7, -18 - bounce, 5, 5);
  g.drawRect(2, -18 - bounce, 5, 5);
  g.endFill();

  // Pupils
  const { lookX, lookY } = getPupilOffset(status, frame);
  g.beginFill(0x2a2a3a);
  g.drawRect(-6 + lookX, -17 - bounce + lookY, 3, 3);
  g.drawRect(3 + lookX, -17 - bounce + lookY, 3, 3);
  g.endFill();

  // Mouth
  const mouthStyle = getMouthStyle(status);
  g.beginFill(mouthStyle.color);
  g.drawRect(-3 + mouthStyle.xOffset, -9 - bounce, mouthStyle.width, mouthStyle.height);
  g.endFill();
}

function getPupilOffset(status: string, frame: number): { lookX: number; lookY: number } {
  if (status === "thinking") {
    return { lookX: Math.sin(frame * 0.8) * 2, lookY: -1 };
  }
  if (status === "passing") {
    return { lookX: 2, lookY: 0 };
  }
  return { lookX: 0, lookY: 0 };
}

function getMouthStyle(status: string): { color: number; width: number; height: number; xOffset: number } {
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

interface FlyingDocumentProps {
  transfer: DocumentTransfer;
  now: number;
  stackDepth: number;
  onComplete: (transferId: string) => void;
}

function getAgentPosition(agentId: string): { x: number; y: number } {
  const desk = DESK_CONFIGS.find((d) => d.id === agentId);
  if (!desk) return { x: OFFICE_WIDTH / 2, y: OFFICE_HEIGHT / 2 };
  return { x: desk.position[0], y: desk.position[1] - 55 }; // Agent position above desk
}

const DOCUMENT_ARC_HEIGHT = 60;

interface ToolStamp {
  label: string;
  color: number;
}

function getToolStamp(toolName: string | null | undefined): ToolStamp {
  const tool = toolName?.trim()?.toLowerCase();
  if (!tool) return { label: "???", color: 0x6b7280 };
  if (tool === "read") return { label: "READ", color: 0x3b82f6 };
  if (tool === "glob" || tool === "grep" || tool === "websearch" || tool === "webfetch") return { label: "SRCH", color: 0x38bdf8 };
  if (tool === "write") return { label: "WRIT", color: 0x22c55e };
  if (tool === "edit" || tool === "notebookedit" || tool === "editnotebook") return { label: "EDIT", color: 0x16a34a };
  if (tool === "bash") return { label: "BASH", color: 0xf59e0b };
  if (tool === "todowrite" || tool === "task") return { label: "PLAN", color: 0xec4899 };
  return { label: tool.slice(0, 4).toUpperCase(), color: 0x6b7280 };
}

const STAMP_TEXT_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 5,
  fill: 0xffffff,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

function FlyingDocument({ transfer, now, stackDepth, onComplete }: FlyingDocumentProps): JSX.Element | null {
  const progress = clamp01((now - transfer.startedAt) / DOCUMENT_TRANSFER_DURATION_MS);

  useEffect(() => {
    if (progress >= 1) {
      onComplete(transfer.id);
    }
  }, [progress, onComplete, transfer.id]);

  if (progress >= 1) return null;

  const eased = easeOutCubic(progress);
  const from = getAgentPosition(transfer.fromAgentId);
  const to = getAgentPosition(transfer.toAgentId);

  // Arc trajectory
  const x = lerp(from.x, to.x, eased);
  const baseY = lerp(from.y, to.y, eased);
  const y = baseY - Math.sin(progress * Math.PI) * DOCUMENT_ARC_HEIGHT;

  const rotation = progress * Math.PI * 2 + stackDepth * 0.08;
  const scale = 1 + Math.sin(progress * Math.PI) * 0.3;

  const stackOffsetX = stackDepth * 2;
  const stackOffsetY = stackDepth * 1;
  const stackScale = Math.max(0.7, 1 - stackDepth * 0.05);
  const stackAlpha = Math.max(0.35, 1 - stackDepth * 0.15);

  const stamp = useMemo(() => getToolStamp(transfer.toolName), [transfer.toolName]);

  const draw = useCallback((g: any) => {
    g.clear();

    // Document shadow
    g.beginFill(0x000000, 0.2);
    g.drawRect(-DOCUMENT_SIZE / 2 + 2, -DOCUMENT_SIZE * 0.7 + 2, DOCUMENT_SIZE, DOCUMENT_SIZE * 1.4);
    g.endFill();

    // Document paper
    g.beginFill(0xffffff);
    g.drawRect(-DOCUMENT_SIZE / 2, -DOCUMENT_SIZE * 0.7, DOCUMENT_SIZE, DOCUMENT_SIZE * 1.4);
    g.endFill();

    // Stamp (top-left)
    const stampW = 12;
    const stampH = 7;
    const stampX = -DOCUMENT_SIZE / 2 + 2;
    const stampY = -DOCUMENT_SIZE * 0.7 + 2;
    g.beginFill(stamp.color, 0.95);
    g.drawRoundedRect(stampX, stampY, stampW, stampH, 2);
    g.endFill();
    g.lineStyle(1, 0x0f172a, 0.35);
    g.drawRoundedRect(stampX, stampY, stampW, stampH, 2);
    g.lineStyle(0);

    // Document lines (text)
    g.beginFill(0x4a4a6a, 0.6);
    g.drawRect(-DOCUMENT_SIZE / 2 + 2, -DOCUMENT_SIZE * 0.2, DOCUMENT_SIZE - 4, 2);
    g.drawRect(-DOCUMENT_SIZE / 2 + 2, 0, DOCUMENT_SIZE - 6, 2);
    g.drawRect(-DOCUMENT_SIZE / 2 + 2, DOCUMENT_SIZE * 0.2, DOCUMENT_SIZE - 5, 2);
    g.endFill();

    // Fold corner
    g.beginFill(0xe0e0e0);
    g.moveTo(DOCUMENT_SIZE / 2 - 4, -DOCUMENT_SIZE * 0.7);
    g.lineTo(DOCUMENT_SIZE / 2, -DOCUMENT_SIZE * 0.7 + 4);
    g.lineTo(DOCUMENT_SIZE / 2, -DOCUMENT_SIZE * 0.7);
    g.closePath();
    g.endFill();
  }, [stamp.color]);

  return (
    <Container x={x + stackOffsetX} y={y + stackOffsetY} rotation={rotation} scale={scale * stackScale} alpha={stackAlpha}>
      <Graphics draw={draw} />
      <Text
        text={stamp.label}
        style={STAMP_TEXT_STYLE}
        anchor={0.5}
        x={-DOCUMENT_SIZE / 2 + 2 + 6}
        y={-DOCUMENT_SIZE * 0.7 + 2 + 3.5}
      />
    </Container>
  );
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

// Timeout for speech bubble disappearance (ms)
const SPEECH_BUBBLE_TIMEOUT_MS = 5000;
const SPEECH_BUBBLE_CHECK_INTERVAL_MS = 1000;

export function OfficeCanvas(): JSX.Element {
  const agents = useAgentStore((state) => state.agents);
  const vacationById = useAgentStore((state) => state.vacationById);
  const errorById = useAgentStore((state) => state.errorById);
  const documentTransfers = useAgentStore((state) => state.documentTransfers);
  const removeDocumentTransfer = useAgentStore((state) => state.removeDocumentTransfer);
  const clearExpiredTasks = useAgentStore((state) => state.clearExpiredTasks);
  const hudMetrics = useHudStore(useShallow((state) => state.getMetrics()));
  const [dimensions, setDimensions] = useState({ width: OFFICE_WIDTH, height: OFFICE_HEIGHT });
  const [now, setNow] = useState(() => performance.now());
  const [motionById, setMotionById] = useState<Record<string, AgentMotion>>({});

  // Start HUD pruning on mount
  useEffect(() => {
    startHudPruning();
    return () => stopHudPruning();
  }, []);

  // Drive animations via requestAnimationFrame.
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      setNow(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Clear speech bubbles after timeout
  useEffect(() => {
    const interval = setInterval(() => {
      clearExpiredTasks(SPEECH_BUBBLE_TIMEOUT_MS);
    }, SPEECH_BUBBLE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [clearExpiredTasks]);

  // Start entering transition when agent becomes visible, or set absent when hidden.
  useEffect(() => {
    const ts = now;
    const start = { x: ENTRY_START_X, y: ENTRY_START_Y };

    setMotionById((prev) => {
      const next: Record<string, AgentMotion> = { ...prev };

      for (const agent of Object.values(agents)) {
        const id = agent.id;
        const target = { x: agent.desk_position[0], y: agent.desk_position[1] - 55 };
        const wantsVisible = agent.status !== "idle" || Boolean(vacationById[id]);
        const current = next[id];

        const currentPhase: MotionPhase = current?.phase ?? "absent";
        if (wantsVisible) {
          if (currentPhase === "absent") {
            next[id] = {
              phase: "entering",
              startedAt: ts,
              durationMs: ENTER_DURATION_MS,
              from: { x: start.x, y: start.y, alpha: 0 },
              to: { x: target.x, y: target.y, alpha: 1 },
            };
          }
        } else {
          // Instantly hide when no longer visible (no exit animation)
          if (currentPhase !== "absent") {
            next[id] = {
              phase: "absent",
              startedAt: ts,
              durationMs: 0,
              from: { x: target.x, y: target.y, alpha: 0 },
              to: { x: target.x, y: target.y, alpha: 0 },
            };
          }
        }
      }

      return next;
    });
  }, [agents, now, vacationById]);

  // Finalize entering motion (entering->present).
  useEffect(() => {
    const ts = now;
    setMotionById((prev) => {
      let changed = false;
      const next: Record<string, AgentMotion> = { ...prev };

      for (const [id, motion] of Object.entries(prev)) {
        if (motion.phase !== "entering") continue;

        const progress = (ts - motion.startedAt) / motion.durationMs;
        if (progress < 1) continue;

        changed = true;
        next[id] = { ...motion, phase: "present" };
      }

      return changed ? next : prev;
    });
  }, [now]);

  useEffect(() => {
    function updateDimensions(): void {
      const container = document.querySelector(".office-container");
      if (container) {
        const rect = container.getBoundingClientRect();
        setDimensions({
          width: Math.max(OFFICE_WIDTH, rect.width),
          height: Math.max(OFFICE_HEIGHT, rect.height),
        });
      }
    }

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const scale = Math.min(
    dimensions.width / OFFICE_WIDTH,
    dimensions.height / OFFICE_HEIGHT
  ) * 0.9;

  const offsetX = (dimensions.width - OFFICE_WIDTH * scale) / 2;
  const offsetY = (dimensions.height - OFFICE_HEIGHT * scale) / 2;

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
          <OfficeBackground />
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
            const target = { x: agent.desk_position[0], y: agent.desk_position[1] - 55 };
            const motion = motionById[agent.id];
            const state = motion ? computeMotionState(motion, now) : { x: target.x, y: target.y, alpha: 1 };

            return (
              <AgentSprite
                key={agent.id}
                agent={agent}
                x={state.x}
                y={state.y}
                alpha={state.alpha}
              />
            );
          })}
          {documentTransfers.map((transfer, index) => {
            const stackDepth = documentTransfers.length - 1 - index; // newest = 0
            return (
              <FlyingDocument
                key={transfer.id}
                transfer={transfer}
                now={now}
                stackDepth={stackDepth}
                onComplete={removeDocumentTransfer}
              />
            );
          })}
          {/* HUD overlay on top of wall */}
          <HudDisplay
            toolCallCount={hudMetrics.toolCallCount}
            avgToolResponseMs={hudMetrics.avgToolResponseMs}
            errorCount={hudMetrics.errorCount}
            agentSwitchCount={hudMetrics.agentSwitchCount}
            rateLimitActive={hudMetrics.rateLimitActive}
          />
        </Container>
      </Stage>
    </div>
  );
}

function computeMotionState(motion: AgentMotion, now: number): { x: number; y: number; alpha: number } {
  const t = clamp01((now - motion.startedAt) / motion.durationMs);
  const e = easeOutCubic(t);
  return {
    x: lerp(motion.from.x, motion.to.x, e),
    y: lerp(motion.from.y, motion.to.y, e),
    alpha: lerp(motion.from.alpha, motion.to.alpha, e),
  };
}
