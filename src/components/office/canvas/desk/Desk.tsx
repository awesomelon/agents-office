import { Container, Graphics, Text } from "@pixi/react";
import { useCallback } from "react";
import { TextStyle } from "pixi.js";
import type { Graphics as PixiGraphics } from "pixi.js";
import type { AgentStatus, AgentType } from "../../../../types";
import { DESK_VACATION_SIGN_X, DESK_VACATION_SIGN_Y } from "../constants";
import { MonitorScreen } from "./MonitorScreen";
import { VacationSign } from "./VacationSign";
import { AlertLight } from "./AlertLight";
import { QueueIndicator } from "./QueueIndicator";

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
  const draw = useCallback((g: PixiGraphics) => {
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

// =============================================================================
// Desk Drawing Functions
// =============================================================================

function drawDeskBase(g: PixiGraphics): void {
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

function drawMonitorFrame(g: PixiGraphics): void {
  // Back/frame
  g.beginFill(0x2a2a2a);
  g.drawRect(-18, -25, 36, 24);
  g.endFill();

  // Stand
  g.beginFill(0x2a2a2a);
  g.drawRect(-4, -3, 8, 6);
  g.endFill();
}

function drawKeyboard(g: PixiGraphics): void {
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

function drawDeskItems(g: PixiGraphics): void {
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
