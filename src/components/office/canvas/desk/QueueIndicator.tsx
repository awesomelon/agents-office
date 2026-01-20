import { Graphics } from "@pixi/react";
import { useCallback } from "react";
import type { Graphics as PixiGraphics } from "pixi.js";
import { QUEUE_DOT_BLINK_MS } from "../constants";
import { useFrameAnimation } from "../hooks/useFrameAnimation";

/**
 * QueueIndicator component: loading dots animation for rate limit state.
 */
export function QueueIndicator(): JSX.Element {
  const frame = useFrameAnimation(3, QUEUE_DOT_BLINK_MS);

  const draw = useCallback((g: PixiGraphics) => {
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
