import { Graphics } from "@pixi/react";
import { useCallback } from "react";
import type { VisualEffect } from "../../../../store";
import { easeOutCubic, clamp01 } from "../math";
import { getAgentPosition } from "../layout";

interface EffectsLayerProps {
  effects: VisualEffect[];
  now: number;
}

export function EffectsLayer({ effects, now }: EffectsLayerProps): JSX.Element {
  const draw = useCallback((g: import("pixi.js").Graphics) => {
    g.clear();

    for (const effect of effects) {
      const progress = (now - effect.startedAt) / effect.durationMs;
      if (progress < 0 || progress >= 1) continue;

      const { x, y } = getAgentPosition(effect.agentId);

      switch (effect.kind) {
        case "searchPulse":
          drawSearchPulse(g, x, y, progress, effect.color);
          break;
        case "typeParticles":
          drawTypeParticles(g, x, y, progress, effect.color, effect.seed);
          break;
        case "runSpark":
          drawRunSpark(g, x, y, progress, effect.color, effect.seed);
          break;
        case "errorBurst":
          drawErrorBurst(g, x, y, progress, effect.color, effect.seed);
          break;
      }
    }
  }, [effects, now]);

  return <Graphics draw={draw} />;
}

// searchPulse: expanding concentric rings
function drawSearchPulse(g: import("pixi.js").Graphics, x: number, y: number, progress: number, color: number): void {
  const maxRadius = 28;
  const rings = 2;
  const baseAlpha = 0.6 * (1 - progress);

  for (let i = 0; i < rings; i++) {
    const offset = i * 0.15;
    const ringProgress = clamp01(progress * 1.3 - offset);
    if (ringProgress <= 0) continue;

    const radius = ringProgress * maxRadius;
    const alpha = baseAlpha * (1 - ringProgress * 0.7);

    g.lineStyle(2, color, alpha);
    g.drawCircle(x, y - 20, radius);
    g.lineStyle(0);
  }
}

// typeParticles: floating particles rising upward
function drawTypeParticles(g: import("pixi.js").Graphics, x: number, y: number, progress: number, color: number, seed: number): void {
  const particleCount = 6;
  const spread = 20;
  const riseHeight = 30;
  const alpha = 0.7 * (1 - progress);

  for (let i = 0; i < particleCount; i++) {
    const hash = (seed * 31 + i * 17) >>> 0;
    const offsetX = ((hash % 100) / 100 - 0.5) * spread * 2;
    const offsetY = (((hash >> 8) % 100) / 100) * 0.3;

    const px = x + offsetX;
    const py = y - 20 - progress * riseHeight * (1 + offsetY);
    const size = 2 + ((hash >> 16) % 2);

    g.beginFill(color, alpha * (1 - progress * 0.5));
    g.drawRect(px - size / 2, py - size / 2, size, size);
    g.endFill();
  }
}

// runSpark: spark flash effect
function drawRunSpark(g: import("pixi.js").Graphics, x: number, y: number, progress: number, color: number, seed: number): void {
  const sparkCount = 8;
  const maxLength = 12;
  const alpha = 0.9 * (1 - progress);

  for (let i = 0; i < sparkCount; i++) {
    const angle = (i / sparkCount) * Math.PI * 2 + (seed % 100) * 0.01;
    const length = maxLength * (0.5 + 0.5 * Math.sin(progress * Math.PI));
    const startDist = 4 + progress * 8;

    const sx = x + Math.cos(angle) * startDist;
    const sy = y - 20 + Math.sin(angle) * startDist;
    const ex = x + Math.cos(angle) * (startDist + length);
    const ey = y - 20 + Math.sin(angle) * (startDist + length);

    g.lineStyle(2, color, alpha);
    g.moveTo(sx, sy);
    g.lineTo(ex, ey);
    g.lineStyle(0);
  }

  // Center glow
  const glowRadius = 6 * (1 - progress * 0.5);
  g.beginFill(color, alpha * 0.5);
  g.drawCircle(x, y - 20, glowRadius);
  g.endFill();
}

// errorBurst: explosive burst pattern
function drawErrorBurst(g: import("pixi.js").Graphics, x: number, y: number, progress: number, color: number, seed: number): void {
  const burstCount = 10;
  const maxDist = 24;
  const alpha = 0.8 * (1 - progress);
  const easeProgress = easeOutCubic(progress);

  for (let i = 0; i < burstCount; i++) {
    const hash = (seed * 23 + i * 37) >>> 0;
    const angle = (i / burstCount) * Math.PI * 2 + ((hash % 50) / 50 - 0.5) * 0.5;
    const dist = maxDist * easeProgress;
    const size = 3 - progress * 1.5;

    const px = x + Math.cos(angle) * dist;
    const py = y - 20 + Math.sin(angle) * dist;

    g.beginFill(color, alpha);
    g.drawRect(px - size / 2, py - size / 2, size, size);
    g.endFill();
  }

  // Inner flash
  if (progress < 0.3) {
    const flashAlpha = 0.6 * (1 - progress / 0.3);
    g.beginFill(0xffffff, flashAlpha);
    g.drawCircle(x, y - 20, 8 * (1 - progress / 0.3));
    g.endFill();
  }
}

