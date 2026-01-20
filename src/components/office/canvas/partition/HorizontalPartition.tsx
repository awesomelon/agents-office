import { Graphics } from "@pixi/react";
import { useCallback } from "react";
import { OFFICE_WIDTH, PARTITION_BORDER, PARTITION_COLOR } from "../constants";

interface HorizontalPartitionProps {
  y: number;
}

export function HorizontalPartition({ y }: HorizontalPartitionProps): JSX.Element {
  const draw = useCallback((g: any) => {
    g.clear();
    const LEFT = 10;
    const HEIGHT = 12;
    const WIDTH = OFFICE_WIDTH - LEFT * 2;

    // Shadow
    g.beginFill(0x000000, 0.12);
    g.drawRect(LEFT + 2, 2, WIDTH, HEIGHT);
    g.endFill();

    // Main bar
    g.beginFill(PARTITION_COLOR, 0.95);
    g.drawRect(LEFT, 0, WIDTH, HEIGHT);
    g.endFill();

    // Border
    g.lineStyle(2, PARTITION_BORDER, 0.8);
    g.drawRect(LEFT, 0, WIDTH, HEIGHT);
    g.lineStyle(0);
  }, []);

  return <Graphics draw={draw} y={y} />;
}

