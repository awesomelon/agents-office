import { Graphics } from "@pixi/react";
import { useCallback } from "react";
import type { Graphics as PixiGraphics } from "pixi.js";
import { ALERT_LIGHT_BLINK_MS } from "../constants";
import { useFrameAnimation } from "../hooks/useFrameAnimation";

/**
 * AlertLight component: flashing red siren on desk for error state.
 */
export function AlertLight(): JSX.Element {
  const frame = useFrameAnimation(2, ALERT_LIGHT_BLINK_MS);

  const draw = useCallback((g: PixiGraphics) => {
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
