import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { calculateOfficeViewport } from "../viewport";

export function useOfficeViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = (width: number, height: number) => {
      setDimensions((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };
    const measure = () => {
      const { width, height } = container.getBoundingClientRect();
      update(width, height);
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(
    () => calculateOfficeViewport(dimensions.width, dimensions.height),
    [dimensions.width, dimensions.height],
  );
  return { containerRef, dimensions, ...geometry };
}
