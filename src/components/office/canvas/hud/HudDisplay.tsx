import { Container, Graphics, Text } from "@pixi/react";
import { useCallback, useEffect, useState } from "react";
import { TextStyle } from "pixi.js";
import { HUD_BAR_HEIGHT, OFFICE_WIDTH } from "../constants";

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

export function HudDisplay({ toolCallCount, avgToolResponseMs, errorCount, agentSwitchCount, rateLimitActive }: HudDisplayProps): JSX.Element {
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

