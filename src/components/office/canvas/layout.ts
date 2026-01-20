import { DESK_CONFIGS } from "../../../types";
import {
  BOTTOM_WINDOW_BAND_HEIGHT,
  BOTTOM_WINDOW_BAND_MARGIN,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  WALL_HEIGHT,
  WALKABLE_BANDS,
  WALK_X_MAX,
  WALK_X_MIN,
  WALKING_SPEED_PX_PER_SEC,
} from "./constants";
import { clamp01, easeOutCubic, lerp, calculateDistance } from "./math";
import type { AgentMotion, ViewportRect } from "./types";

export function getAgentPosition(agentId: string): { x: number; y: number } {
  const desk = DESK_CONFIGS.find((d) => d.id === agentId);
  if (!desk) return { x: OFFICE_WIDTH / 2, y: OFFICE_HEIGHT / 2 };
  return { x: desk.position[0], y: desk.position[1] - 55 }; // Agent position above desk
}

export function shouldDrawBottomBand(viewport: ViewportRect): boolean {
  // Avoid doing extra work when the viewport doesn't include the band area.
  const bandY = OFFICE_HEIGHT - BOTTOM_WINDOW_BAND_MARGIN - BOTTOM_WINDOW_BAND_HEIGHT;
  return viewport.y + viewport.height >= bandY && viewport.y <= bandY + BOTTOM_WINDOW_BAND_HEIGHT;
}

export function shouldDrawTopBand(viewport: ViewportRect): boolean {
  return viewport.y <= WALL_HEIGHT;
}

// Walking utility functions
export function findCurrentBand(y: number): (typeof WALKABLE_BANDS)[number] | null {
  return WALKABLE_BANDS.find((b) => y >= b.minY && y <= b.maxY) ?? null;
}

export function generateWaypointInBand(band: (typeof WALKABLE_BANDS)[number]): { x: number; y: number } {
  const x = WALK_X_MIN + Math.random() * (WALK_X_MAX - WALK_X_MIN);
  const y = band.minY + Math.random() * (band.maxY - band.minY);
  return { x, y };
}

export function calculateWalkDuration(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const dist = calculateDistance(from, to);
  return Math.max(800, (dist / WALKING_SPEED_PX_PER_SEC) * 1000);
}

export function calculateReturnDuration(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const dist = calculateDistance(from, to);
  const RETURN_SPEED_PX_PER_SEC = 60;
  const MIN_DURATION_MS = 300;
  const MAX_DURATION_MS = 800;
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, (dist / RETURN_SPEED_PX_PER_SEC) * 1000));
}

export function computeMotionState(motion: AgentMotion, now: number): { x: number; y: number; alpha: number } {
  const t = clamp01((now - motion.startedAt) / motion.durationMs);
  const e = easeOutCubic(t);
  return {
    x: lerp(motion.from.x, motion.to.x, e),
    y: lerp(motion.from.y, motion.to.y, e),
    alpha: lerp(motion.from.alpha, motion.to.alpha, e),
  };
}

