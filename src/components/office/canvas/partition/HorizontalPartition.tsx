import { Graphics } from "@pixi/react";
import { useCallback } from "react";
import { PARTITION_BORDER, PARTITION_COLOR } from "../constants";

interface HorizontalPartitionProps {
  y: number;
}

// Partition is intentionally narrower than the full canvas to avoid the right wall area.
const PARTITION_LEFT_PX = 10;
const PARTITION_WIDTH_PX = 300;
const PARTITION_HEIGHT_PX = 12;

export function HorizontalPartition({ y }: HorizontalPartitionProps): JSX.Element {
  const draw = useCallback((g: any) => {
    g.clear();

    // Shadow
    g.beginFill(0x000000, 0.12);
    g.drawRect(PARTITION_LEFT_PX + 2, 2, PARTITION_WIDTH_PX, PARTITION_HEIGHT_PX);
    g.endFill();

    // Main bar
    g.beginFill(PARTITION_COLOR, 0.95);
    g.drawRect(PARTITION_LEFT_PX, 0, PARTITION_WIDTH_PX, PARTITION_HEIGHT_PX);
    g.endFill();

    // Border
    g.lineStyle(2, PARTITION_BORDER, 0.8);
    g.drawRect(PARTITION_LEFT_PX, 0, PARTITION_WIDTH_PX, PARTITION_HEIGHT_PX);
    g.lineStyle(0);
  }, []);

  return <Graphics draw={draw} y={y} />;
}

