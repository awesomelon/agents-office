// Math & deterministic helpers used by canvas renderers.

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
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

