import { Container, Graphics, Text } from "@pixi/react";
import { useCallback } from "react";
import { TextStyle } from "pixi.js";
import type { Graphics as PixiGraphics } from "pixi.js";
import { VACATION_SIGN_WIDTH, VACATION_SIGN_HEIGHT } from "../constants";

const VACATION_SIGN_TEXT_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 6,
  fill: 0xfff7ed,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

export function VacationSign(): JSX.Element {
  const draw = useCallback((g: PixiGraphics) => {
    g.clear();

    const halfWidth = VACATION_SIGN_WIDTH / 2;
    const halfHeight = VACATION_SIGN_HEIGHT / 2;

    // Sign shadow
    g.beginFill(0x000000, 0.2);
    g.drawRoundedRect(-halfWidth + 1, -halfHeight + 1, VACATION_SIGN_WIDTH, VACATION_SIGN_HEIGHT, 4);
    g.endFill();

    // Sign base
    g.beginFill(0x8b5a2b);
    g.drawRoundedRect(-halfWidth, -halfHeight, VACATION_SIGN_WIDTH, VACATION_SIGN_HEIGHT, 4);
    g.endFill();

    // Border
    g.lineStyle(1, 0x654321, 0.8);
    g.drawRoundedRect(-halfWidth, -halfHeight, VACATION_SIGN_WIDTH, VACATION_SIGN_HEIGHT, 4);

    // Pin
    g.lineStyle(0);
    g.beginFill(0xef4444);
    g.drawCircle(-halfWidth + 6, -halfHeight + 6, 2);
    g.endFill();
  }, []);

  return (
    <Container>
      <Graphics draw={draw} />
      <Text text="휴가중" style={VACATION_SIGN_TEXT_STYLE} anchor={0.5} />
    </Container>
  );
}
