import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { OFFICE_HEIGHT, OFFICE_WIDTH } from "../constants";
import type { ViewportRect } from "../types";

export function useOfficeViewport(): {
  dimensions: { width: number; height: number };
  scale: number;
  offsetX: number;
  offsetY: number;
  viewport: ViewportRect;
} {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  // 초기 크기 동기 측정 (ResizeObserver보다 먼저 실행)
  useLayoutEffect(() => {
    const container = document.querySelector(".office-container");
    if (container) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    }
  }, []);

  useEffect(() => {
    const container = document.querySelector(".office-container");
    if (!container) return;

    function updateDimensions(entry: ResizeObserverEntry): void {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    }

    observerRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateDimensions(entry);
      }
    });

    observerRef.current.observe(container);

    return () => {
      observerRef.current?.disconnect();
    };
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

