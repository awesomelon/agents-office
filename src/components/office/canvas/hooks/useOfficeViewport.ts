import { useEffect, useMemo, useState } from "react";
import { OFFICE_HEIGHT, OFFICE_WIDTH } from "../constants";
import type { ViewportRect } from "../types";

export function useOfficeViewport(): {
  dimensions: { width: number; height: number };
  scale: number;
  offsetX: number;
  offsetY: number;
  viewport: ViewportRect;
} {
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

  const viewport = useMemo<ViewportRect>(() => {
    // Convert stage pixels -> local (unscaled) coordinates of the office Container.
    return {
      x: -offsetX / scale,
      y: -offsetY / scale,
      width: dimensions.width / scale,
      height: dimensions.height / scale,
    };
  }, [dimensions.height, dimensions.width, offsetX, offsetY, scale]);

  return { dimensions, scale, offsetX, offsetY, viewport };
}

