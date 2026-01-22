// Math & deterministic helpers used by canvas renderers.

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Gentle deceleration (softer than cubic)
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// Smooth acceleration and deceleration
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Slight overshoot at end (bouncy arrival)
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Smooth start/stop (natural for walking)
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clampByte(v: number): number {
  return Math.max(0, Math.min(255, v));
}

export function adjustColor(color: number, delta: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const rr = clampByte(r + delta);
  const gg = clampByte(g + delta);
  const bb = clampByte(b + delta);
  return (rr << 16) | (gg << 8) | bb;
}

export function hash2dInt(x: number, y: number): number {
  // Deterministic integer hash (no RNG) for stable tile scratches/variation.
  let h = x * 374761393 + y * 668265263; // large primes
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return h >>> 0;
}

export function rand01FromHash(h: number): number {
  return (h >>> 0) / 0xffffffff;
}

export function calculateDistance(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
}

// =============================================================================
// Bezier Curve Utilities
// =============================================================================

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Quadratic Bezier curve interpolation.
 * P(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
 */
export function quadraticBezier(p0: Point2D, p1: Point2D, p2: Point2D, t: number): Point2D {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x,
    y: mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y,
  };
}

/**
 * Generate a control point for natural curved walking path.
 * The control point is offset perpendicular to the line from start to end.
 */
export function generateBezierControlPoint(
  from: Point2D,
  to: Point2D,
  curveStrength = 0.3
): Point2D {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  // Perpendicular vector (rotated 90 degrees)
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Normalize and scale
  const perpX = (-dy / dist) * dist * curveStrength;
  const perpY = (dx / dist) * dist * curveStrength;

  // Randomly choose left or right curve (deterministic based on positions)
  const hash = hash2dInt(Math.floor(from.x), Math.floor(from.y));
  const sign = (hash % 2 === 0) ? 1 : -1;

  return {
    x: midX + perpX * sign,
    y: midY + perpY * sign,
  };
}

/**
 * Approximate arc length of quadratic Bezier curve using sampling.
 */
export function approximateBezierLength(p0: Point2D, p1: Point2D, p2: Point2D, samples = 10): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const curr = quadraticBezier(p0, p1, p2, t);
    length += calculateDistance(prev, curr);
    prev = curr;
  }
  return length;
}

/**
 * Calculate body lean angle based on movement direction.
 * Returns angle in radians (positive = leaning right, negative = leaning left).
 */
export function calculateLeanAngle(from: Point2D, to: Point2D, maxAngle = 0.26): number {
  const dx = to.x - from.x;
  const speed = Math.abs(dx);
  const maxSpeed = 100;
  const normalizedSpeed = Math.min(speed / maxSpeed, 1);
  const sign = dx > 0 ? 1 : -1;
  return sign * normalizedSpeed * maxAngle;
}

