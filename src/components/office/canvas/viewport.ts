import { OFFICE_HEIGHT, OFFICE_WIDTH } from "./constants";
import type { ViewportRect } from "./types";

/** Keep geometry finite while a container is mounting or temporarily collapsed. */
export function calculateOfficeViewport(
  width: number,
  height: number,
): {
  scale: number;
  offsetX: number;
  offsetY: number;
  viewport: ViewportRect;
} {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      viewport: { x: 0, y: 0, width: OFFICE_WIDTH, height: OFFICE_HEIGHT },
    };
  }

  const scale = Math.min(width / OFFICE_WIDTH, height / OFFICE_HEIGHT) * 0.9;
  const offsetX = (width - OFFICE_WIDTH * scale) / 2;
  const offsetY = (height - OFFICE_HEIGHT * scale) / 2;
  return {
    scale,
    offsetX,
    offsetY,
    viewport: {
      x: -offsetX / scale,
      y: -offsetY / scale,
      width: width / scale,
      height: height / scale,
    },
  };
}
