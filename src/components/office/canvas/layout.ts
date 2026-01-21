import { DESK_CONFIGS } from "../../../types";
import {
  BEZIER_CURVE_STRENGTH,
  BOTTOM_WINDOW_BAND_HEIGHT,
  BOTTOM_WINDOW_BAND_MARGIN,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  WALKABLE_BANDS,
  WALKING_SPEED_PX_PER_SEC,
  WALK_X_MAX,
  WALK_X_MIN,
  WALL_HEIGHT,
} from "./constants";
import {
  approximateBezierLength,
  calculateDistance,
  calculateLeanAngle,
  clamp01,
  easeOutCubic,
  generateBezierControlPoint,
  lerp,
  quadraticBezier,
} from "./math";
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

  // Use Bezier curve if control point is available
  if (motion.controlPoint) {
    const pos = quadraticBezier(
      motion.from,
      motion.controlPoint,
      motion.to,
      e
    );
    return {
      x: pos.x,
      y: pos.y,
      alpha: lerp(motion.from.alpha, motion.to.alpha, e),
    };
  }

  return {
    x: lerp(motion.from.x, motion.to.x, e),
    y: lerp(motion.from.y, motion.to.y, e),
    alpha: lerp(motion.from.alpha, motion.to.alpha, e),
  };
}

/**
 * Generate Bezier control point for walking motion.
 */
export function generateWalkingControlPoint(
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number } {
  return generateBezierControlPoint(from, to, BEZIER_CURVE_STRENGTH);
}

/**
 * Calculate walk duration using Bezier curve arc length.
 */
export function calculateBezierWalkDuration(
  from: { x: number; y: number },
  to: { x: number; y: number },
  controlPoint: { x: number; y: number }
): number {
  const arcLength = approximateBezierLength(from, controlPoint, to, 12);
  return Math.max(800, (arcLength / WALKING_SPEED_PX_PER_SEC) * 1000);
}

/**
 * Calculate body lean angle based on current motion.
 */
export function calculateMotionLean(motion: AgentMotion, now: number): number {
  if (motion.phase !== "walking" && motion.phase !== "returning") {
    return 0;
  }

  const t = clamp01((now - motion.startedAt) / motion.durationMs);

  // Get current and next positions to determine direction
  if (motion.controlPoint) {
    const e = easeOutCubic(t);
    const current = quadraticBezier(motion.from, motion.controlPoint, motion.to, e);
    const next = quadraticBezier(motion.from, motion.controlPoint, motion.to, Math.min(1, e + 0.1));
    return calculateLeanAngle(current, next) * 0.5; // Reduce lean intensity
  }

  return calculateLeanAngle(motion.from, motion.to) * 0.3;
}

