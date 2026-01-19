import { Stage, Container, Graphics, Text } from "@pixi/react";
import { useCallback, useState, useEffect, useMemo } from "react";
import { TextStyle } from "pixi.js";
import { useAgentStore } from "../../store";
import { DESK_CONFIGS, AGENT_COLORS, STATUS_COLORS } from "../../types";
import type { Agent, AgentType } from "../../types";
import { formatAgentMessage } from "../../utils";

// Canvas dimensions
const OFFICE_WIDTH = 700;
const OFFICE_HEIGHT = 500;

// Floor configuration
const FLOOR_START_Y = 60;
const BRICK_WIDTH = 32;
const BRICK_HEIGHT = 16;

// Wall configuration
const WALL_HEIGHT = 65;

// Animation timing
const ANIMATION_INTERVAL_MS = 250;

// Text limits
const SPEECH_BUBBLE_MAX_CHARS = 45;
const SPEECH_BUBBLE_TRUNCATE_AT = 42;

// Hair colors by agent type
const HAIR_COLORS: Record<AgentType, number> = {
  researcher: 0x4a3728, // Brown
  coder: 0x2a2a3a, // Dark
  reviewer: 0x8b6914, // Blonde
  artist: 0x8b2252, // Reddish
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

    // Windows
    drawWindows(g, [290, 410]);

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

function Desk({ x, y, label }: DeskProps): JSX.Element {
  const draw = useCallback((g: any) => {
    g.clear();
    drawDeskBase(g);
    drawMonitor(g);
    drawKeyboard(g);
    drawDeskItems(g);
  }, []);

  return (
    <Container x={x} y={y}>
      <Graphics draw={draw} />
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

function drawMonitor(g: any): void {
  // Back
  g.beginFill(0x2a2a2a);
  g.drawRect(-18, -25, 36, 24);
  g.endFill();

  // Screen
  g.beginFill(0x1a3a4a);
  g.drawRect(-16, -23, 32, 18);
  g.endFill();

  // Screen glow
  g.beginFill(0x2a5a7a, 0.5);
  g.drawRect(-14, -21, 28, 14);
  g.endFill();

  // Stand
  g.beginFill(0x2a2a2a);
  g.drawRect(-4, -3, 8, 6);
  g.endFill();
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
}

function AgentSprite({ agent }: AgentSpriteProps): JSX.Element {
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
    <Container x={agent.desk_position[0]} y={agent.desk_position[1] - 55}>
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

export function OfficeCanvas(): JSX.Element {
  const agents = useAgentStore((state) => state.agents);
  const [dimensions, setDimensions] = useState({ width: OFFICE_WIDTH, height: OFFICE_HEIGHT });

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

  return (
    <div className="office-container w-full h-full bg-inbox-bg">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        options={{ backgroundColor: 0x1a1a2e, antialias: true }}
      >
        <Container x={offsetX} y={offsetY} scale={scale}>
          <OfficeBackground />
          {DESK_CONFIGS.map((desk) => (
            <Desk
              key={desk.id}
              x={desk.position[0]}
              y={desk.position[1]}
              label={desk.label}
            />
          ))}
          {Object.values(agents).map((agent) => (
            <AgentSprite key={agent.id} agent={agent} />
          ))}
        </Container>
      </Stage>
    </div>
  );
}
