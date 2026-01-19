import { Stage, Container, Graphics, Text } from "@pixi/react";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { TextStyle } from "pixi.js";
import { useShallow } from "zustand/shallow";
import { useAgentStore, useHudStore, startHudPruning, stopHudPruning, type DocumentTransfer } from "../../store";
import { DESK_CONFIGS, AGENT_COLORS, STATUS_COLORS } from "../../types";
import type { Agent, AgentType, AgentStatus } from "../../types";
import { formatAgentMessage } from "../../utils";

// Canvas dimensions
const OFFICE_WIDTH = 550;
const OFFICE_HEIGHT = 700;

type ViewportRect = { x: number; y: number; width: number; height: number };

// Top band / entrance configuration
const WALL_HEIGHT = 70;
const ENTRANCE_WIDTH = 156;
const ENTRANCE_HEIGHT = 48;
const ENTRANCE_TOP_Y = 10;
const ENTRANCE_PADDING = 6;

const SUNFLOWER_FRAME_GAP = 14;

// Wall (beige) palette
const WALL_BEIGE_BASE = 0xe7d8bf;
const WALL_BEIGE_STRIPE = 0xd8c7ab;
const WALL_BEIGE_TRIM = 0xc8b597;
const WALL_BEIGE_SHADOW = 0xb8a68a;

// Floor configuration (square tiles)
const FLOOR_START_Y = WALL_HEIGHT;
const TILE_SIZE = 24;
const TILE_GAP = 1; // grout gap between tiles
const TILE_GROUT_COLOR = 0xe5e7eb;
const TILE_BASE_COLOR = 0xf9fafb;
const TILE_VARIATION_DELTA = 10; // per-channel delta
const TILE_BORDER_COLOR = 0xd1d5db;
const TILE_SCRATCH_COLOR = 0x94a3b8;
const TILE_SCRATCH_ALPHA = 0.35;
const TILE_SCRATCH_DENSITY = 0.13; // chance per tile

// Bottom windows band (bottom-of-scene)
const BOTTOM_WINDOW_BAND_HEIGHT = 78;
const BOTTOM_WINDOW_BAND_MARGIN = 10;

// Animation timing
const ANIMATION_INTERVAL_MS = 250;

// Entry motion
const ENTRY_START_X = OFFICE_WIDTH / 2;
const ENTRY_START_Y = -60;
const ENTER_DURATION_MS = 700;

// Text limits
const SPEECH_BUBBLE_MAX_CHARS = 45;
const SPEECH_BUBBLE_TRUNCATE_AT = 42;

// Vacation sign
const VACATION_SIGN_WIDTH = 52;
const VACATION_SIGN_HEIGHT = 18;
// Place it on the desk front (below the desktop edge, above the desk label).
const DESK_VACATION_SIGN_X = 0;
const DESK_VACATION_SIGN_Y = 34;

// Document transfer animation
const DOCUMENT_TRANSFER_DURATION_MS = 600;
const DOCUMENT_SIZE = 16;

// Alert light animation
const ALERT_LIGHT_BLINK_MS = 200;

// Queue indicator animation
const QUEUE_DOT_BLINK_MS = 500;

// HUD bar
const HUD_BAR_HEIGHT = 20;
const SHOW_HUD = false;

// Walking motion
const WALKING_SPEED_PX_PER_SEC = 35;
const WALKING_PAUSE_MIN_MS = 2000;
const WALKING_PAUSE_MAX_MS = 4000;
const WALKING_ANIMATION_INTERVAL_MS = 180;

// Walkable areas (same band only - 파티션 관통 방지)
const WALKABLE_BANDS = [
  { minY: 85, maxY: 115 },   // 파티션1 아래 ~ Section A 위
  { minY: 175, maxY: 280 },  // Section A ~ Section B 사이
  { minY: 360, maxY: 410 },  // Section B ~ 파티션2 사이
  { minY: 440, maxY: 490 },  // 파티션2 아래 ~ Section C 위
  { minY: 565, maxY: 670 },  // Section C 아래 ~ 바닥
];
const WALK_X_MIN = 30;
const WALK_X_MAX = 520; // 캔버스 550 기준

type MotionPhase = "absent" | "entering" | "present" | "walking" | "returning";

interface AgentMotion {
  phase: MotionPhase;
  startedAt: number;
  durationMs: number;
  from: { x: number; y: number; alpha: number };
  to: { x: number; y: number; alpha: number };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, v));
}

// Walking utility functions
function findCurrentBand(y: number): typeof WALKABLE_BANDS[0] | null {
  return WALKABLE_BANDS.find(b => y >= b.minY && y <= b.maxY) ?? null;
}

function generateWaypointInBand(band: typeof WALKABLE_BANDS[0]): { x: number; y: number } {
  const x = WALK_X_MIN + Math.random() * (WALK_X_MAX - WALK_X_MIN);
  const y = band.minY + Math.random() * (band.maxY - band.minY);
  return { x, y };
}

function calculateDistance(from: {x: number; y: number}, to: {x: number; y: number}): number {
  return Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
}

function calculateWalkDuration(from: {x: number; y: number}, to: {x: number; y: number}): number {
  const dist = calculateDistance(from, to);
  return Math.max(800, (dist / WALKING_SPEED_PX_PER_SEC) * 1000);
}

function calculateReturnDuration(from: {x: number; y: number}, to: {x: number; y: number}): number {
  const dist = calculateDistance(from, to);
  const RETURN_SPEED_PX_PER_SEC = 60;
  const MIN_DURATION_MS = 300;
  const MAX_DURATION_MS = 800;
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, (dist / RETURN_SPEED_PX_PER_SEC) * 1000));
}

function adjustColor(color: number, delta: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const rr = clampByte(r + delta);
  const gg = clampByte(g + delta);
  const bb = clampByte(b + delta);
  return (rr << 16) | (gg << 8) | bb;
}

function hash2dInt(x: number, y: number): number {
  // Deterministic integer hash (no RNG) for stable tile scratches/variation.
  let h = x * 374761393 + y * 668265263; // large primes
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return h >>> 0;
}

function rand01FromHash(h: number): number {
  return (h >>> 0) / 0xffffffff;
}

function shouldDrawBottomBand(viewport: ViewportRect): boolean {
  // Avoid doing extra work when the viewport doesn't include the band area.
  const bandY = OFFICE_HEIGHT - BOTTOM_WINDOW_BAND_MARGIN - BOTTOM_WINDOW_BAND_HEIGHT;
  return viewport.y + viewport.height >= bandY && viewport.y <= bandY + BOTTOM_WINDOW_BAND_HEIGHT;
}

function shouldDrawTopBand(viewport: ViewportRect): boolean {
  return viewport.y <= WALL_HEIGHT;
}

// Hair colors by agent type
const HAIR_COLORS: Record<AgentType, number> = {
  reader: 0x4a3728, // Brown
  searcher: 0x2a4a6a, // Dark blue
  writer: 0x2a5a2a, // Dark green
  editor: 0x2a2a3a, // Dark
  runner: 0x8b6914, // Blonde
  tester: 0x8b4514, // Auburn
  planner: 0x8b2252, // Reddish
  support: 0x5a2a6a, // Purple
};

function OfficeBackground({ viewport }: { viewport: ViewportRect }): JSX.Element {
  const draw = useCallback((g: any) => {
    g.clear();

    const viewX = viewport.x;
    const viewY = viewport.y;
    const viewW = viewport.width;
    const viewH = viewport.height;
    const viewRight = viewX + viewW;
    const viewBottom = viewY + viewH;

    // Clamp drawing to the office bounds to avoid tiling artifacts on wide viewports.
    const clipLeft = Math.max(0, viewX);
    const clipTop = Math.max(0, viewY);
    const clipRight = Math.min(OFFICE_WIDTH, viewRight);
    const clipBottom = Math.min(OFFICE_HEIGHT, viewBottom);
    if (clipRight <= clipLeft || clipBottom <= clipTop) return;

    // Base background (grout tone)
    g.lineStyle(0);
    g.beginFill(TILE_GROUT_COLOR);
    g.drawRect(clipLeft, clipTop, clipRight - clipLeft, clipBottom - clipTop);
    g.endFill();

    // Top band (wall / entrance area)
    if (shouldDrawTopBand(viewport)) {
      const topBandTop = clipTop;
      const topBandBottom = Math.min(WALL_HEIGHT, clipBottom);
      if (topBandBottom > topBandTop) {
        g.beginFill(WALL_BEIGE_BASE);
        g.drawRect(clipLeft, topBandTop, clipRight - clipLeft, topBandBottom - topBandTop);
        g.endFill();

        // Subtle texture stripes
        g.beginFill(WALL_BEIGE_STRIPE, 0.35);
        const stripeStart = Math.floor(clipLeft / 12) * 12;
        for (let x = stripeStart; x < clipRight; x += 12) {
          g.drawRect(x, topBandTop, 4, topBandBottom - topBandTop);
        }
        g.endFill();

        // Wall base trim
        g.lineStyle(2, WALL_BEIGE_TRIM, 1);
        g.moveTo(clipLeft, topBandBottom);
        g.lineTo(clipRight, topBandBottom);
        g.lineStyle(0);
      }
    }

    // Floor tiles (below top band)
    const floorStartY = Math.max(FLOOR_START_Y, clipTop);
    if (clipBottom > floorStartY) {
      const tileStartX = Math.floor(clipLeft / TILE_SIZE);
      const tileEndX = Math.floor((clipRight - 1) / TILE_SIZE);
      const tileStartY = Math.floor(floorStartY / TILE_SIZE);
      const tileEndY = Math.floor((clipBottom - 1) / TILE_SIZE);

      for (let ty = tileStartY; ty <= tileEndY; ty++) {
        const y = ty * TILE_SIZE;
        if (y + TILE_SIZE < floorStartY) continue;
        for (let tx = tileStartX; tx <= tileEndX; tx++) {
          const x = tx * TILE_SIZE;

          const h = hash2dInt(tx, ty);
          const r1 = rand01FromHash(h);
          const r2 = rand01FromHash(hash2dInt(tx + 17, ty - 29));

          const delta = Math.round((r1 - 0.5) * 2 * TILE_VARIATION_DELTA);
          const tileColor = adjustColor(TILE_BASE_COLOR, delta);

          g.beginFill(tileColor);
          g.drawRect(x, y, TILE_SIZE - TILE_GAP, TILE_SIZE - TILE_GAP);
          g.endFill();

          // Border hint (very subtle)
          if ((tx + ty) % 7 === 0) {
            g.beginFill(TILE_BORDER_COLOR, 0.25);
            g.drawRect(x, y + TILE_SIZE - 2, TILE_SIZE - TILE_GAP, 1);
            g.drawRect(x + TILE_SIZE - 2, y, 1, TILE_SIZE - TILE_GAP);
            g.endFill();
          }

          // Scratches (deterministic)
          if (r2 < TILE_SCRATCH_DENSITY) {
            const r3 = rand01FromHash(hash2dInt(tx - 7, ty + 11));
            const r4 = rand01FromHash(hash2dInt(tx + 31, ty + 3));
            const sx = x + 3 + Math.floor(r3 * (TILE_SIZE - 10));
            const sy = y + 3 + Math.floor(r4 * (TILE_SIZE - 10));
            const len = 4 + Math.floor(r1 * 6);

            g.beginFill(TILE_SCRATCH_COLOR, TILE_SCRATCH_ALPHA);
            if (r1 < 0.5) {
              // Horizontal scratch
              g.drawRect(sx, sy, len, 1);
              if (r3 < 0.35) g.drawRect(sx + 1, sy + 2, Math.max(2, len - 2), 1);
            } else {
              // Vertical scratch
              g.drawRect(sx, sy, 1, len);
              if (r3 < 0.35) g.drawRect(sx + 2, sy + 1, 1, Math.max(2, len - 2));
            }
            g.endFill();
          }
        }
      }
    }

    // Entrance + bottom windows (repeat per OFFICE_WIDTH segment)
    // Bottom band can be skipped when viewport doesn't intersect it.
    drawRepeatedDecorations(g, viewport);
  }, [viewport]);

  return <Graphics draw={draw} />;
}

function drawRepeatedDecorations(g: any, viewport: ViewportRect): void {
  // Draw once within the office bounds; wide viewports are handled by clamping in OfficeBackground.
  const ox = 0;
  if (shouldDrawTopBand(viewport)) {
    drawSunflowerFrame(g, ox);
    drawEntrance(g, ox);
  }
  if (shouldDrawBottomBand(viewport)) {
    drawBottomWindowsBand(g, ox);
  }
}

function drawEntrance(g: any, offsetX: number): void {
  const entranceX = offsetX + OFFICE_WIDTH / 2 - ENTRANCE_WIDTH / 2;
  const entranceY = ENTRANCE_TOP_Y;
  const doorBottomY = entranceY + ENTRANCE_HEIGHT;

  // Wall trim line across with door gap:
  // ----------------------|  유리문  |----------------------
  const trimY = doorBottomY + 2;
  g.lineStyle(2, WALL_BEIGE_TRIM, 1);
  g.moveTo(offsetX, trimY);
  g.lineTo(entranceX - 6, trimY);
  g.moveTo(entranceX + ENTRANCE_WIDTH + 6, trimY);
  g.lineTo(offsetX + OFFICE_WIDTH, trimY);
  g.lineStyle(0);

  // Door outer frame shadow
  g.beginFill(WALL_BEIGE_SHADOW, 0.55);
  g.drawRect(entranceX - 2, entranceY - 2, ENTRANCE_WIDTH + 4, ENTRANCE_HEIGHT + 4);
  g.endFill();

  // Metal frame
  g.beginFill(0x64748b, 0.9);
  g.drawRect(entranceX, entranceY, ENTRANCE_WIDTH, ENTRANCE_HEIGHT);
  g.endFill();

  // Glass pane (inset)
  const glassInset = 4;
  const glassX = entranceX + glassInset;
  const glassY = entranceY + glassInset;
  const glassW = ENTRANCE_WIDTH - glassInset * 2;
  const glassH = ENTRANCE_HEIGHT - glassInset * 2;

  g.beginFill(0x93c5fd, 0.22);
  g.drawRect(glassX, glassY, glassW, glassH);
  g.endFill();

  // Glass reflections
  g.beginFill(0xffffff, 0.10);
  g.drawRect(glassX + 6, glassY + 4, 3, glassH - 8);
  g.drawRect(glassX + 14, glassY + 8, 2, glassH - 16);
  g.endFill();

  // Center mullion (two panels)
  g.beginFill(0x334155, 0.7);
  g.drawRect(entranceX + Math.floor(ENTRANCE_WIDTH / 2) - 1, entranceY + 2, 2, ENTRANCE_HEIGHT - 4);
  g.endFill();

  // Door handle (right)
  g.beginFill(0xe2e8f0, 0.9);
  g.drawRect(entranceX + ENTRANCE_WIDTH - 12, entranceY + Math.floor(ENTRANCE_HEIGHT / 2) - 6, 3, 12);
  g.drawRect(entranceX + ENTRANCE_WIDTH - 16, entranceY + Math.floor(ENTRANCE_HEIGHT / 2) - 2, 7, 2);
  g.endFill();

  // Threshold
  g.beginFill(0x111827, 0.22);
  g.drawRect(entranceX - ENTRANCE_PADDING, doorBottomY + 4, ENTRANCE_WIDTH + ENTRANCE_PADDING * 2, 5);
  g.endFill();
}

function drawSunflowerFrame(g: any, offsetX: number): void {
  // Place on the wall (left of the door)
  // Must remain within the top wall band (WALL_HEIGHT=70). y=18 => frameH should be <= 52.
  const frameW = 72;
  const frameH = 44;
  const doorLeft = offsetX + OFFICE_WIDTH / 2 - ENTRANCE_WIDTH / 2;
  const x = doorLeft - SUNFLOWER_FRAME_GAP - frameW;
  const y = 18;

  // Shadow
  g.beginFill(0x000000, 0.12);
  g.drawRect(x + 2, y + 2, frameW, frameH);
  g.endFill();

  // Frame
  g.beginFill(0x7c4a1a, 0.95);
  g.drawRect(x, y, frameW, frameH);
  g.endFill();

  // Inner matte
  g.beginFill(0xf8fafc, 0.85);
  g.drawRect(x + 3, y + 3, frameW - 6, frameH - 6);
  g.endFill();

  // Pixel art canvas inside the matte (no external asset)
  const matteX = x + 3;
  const matteY = y + 3;
  const matteW = frameW - 6;
  const matteH = frameH - 6;

  const PIXEL_SIZE = 2;
  const ART_PADDING = 4;

  const artX = matteX + ART_PADDING;
  const artY = matteY + ART_PADDING;
  const artW = matteW - ART_PADDING * 2;
  const artH = matteH - ART_PADDING * 2;

  const cols = Math.max(1, Math.floor(artW / PIXEL_SIZE));
  const rows = Math.max(1, Math.floor(artH / PIXEL_SIZE));

  const fitW = cols * PIXEL_SIZE;
  const fitH = rows * PIXEL_SIZE;

  // Palette (pixel art)
  const PAL_BG = 0xeef2ff;
  const PAL_OUTLINE = 0x1f2937;
  const PAL_PETAL = 0xfbbf24;
  const PAL_PETAL_DARK = 0xf59e0b;
  const PAL_CENTER = 0x7c2d12;
  const PAL_CENTER_HI = 0x9a3412;
  const PAL_STEM = 0x22c55e;
  const PAL_LEAF = 0x16a34a;

  // Background
  g.beginFill(PAL_BG, 1);
  g.drawRect(artX, artY, fitW, fitH);
  g.endFill();

  // Subtle inner border to read like a tiny canvas
  g.beginFill(PAL_OUTLINE, 0.25);
  g.drawRect(artX, artY, fitW, 1);
  g.drawRect(artX, artY + fitH - 1, fitW, 1);
  g.drawRect(artX, artY, 1, fitH);
  g.drawRect(artX + fitW - 1, artY, 1, fitH);
  g.endFill();

  const pixelsByColor: Record<number, Array<{ px: number; py: number }>> = {};

  function setPixel(px: number, py: number, color: number): void {
    if (px < 0 || py < 0 || px >= cols || py >= rows) return;
    (pixelsByColor[color] ||= []).push({ px, py });
  }

  function stampSunflower(cx: number, cy: number, stemBottom: number, variant: 0 | 1): void {
    // Outline around the center for crisp pixel look
    const outline = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ] as const;
    for (const [dx, dy] of outline) setPixel(cx + dx, cy + dy, PAL_OUTLINE);

    // Petals (simple 8-direction + extras)
    const petals = [
      [0, -3],
      [0, -2],
      [0, 2],
      [0, 3],
      [-3, 0],
      [-2, 0],
      [2, 0],
      [3, 0],
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
      [-1, -3],
      [1, -3],
    ] as const;
    for (let i = 0; i < petals.length; i++) {
      const [dx, dy] = petals[i];
      const useDark = (variant === 1 && i % 3 === 0) || (variant === 0 && i % 5 === 0);
      setPixel(cx + dx, cy + dy, useDark ? PAL_PETAL_DARK : PAL_PETAL);
    }

    // Center (2x2) + highlight
    setPixel(cx, cy, PAL_CENTER);
    setPixel(cx + 1, cy, PAL_CENTER);
    setPixel(cx, cy + 1, PAL_CENTER);
    setPixel(cx + 1, cy + 1, PAL_CENTER);
    setPixel(cx + 1, cy, PAL_CENTER_HI);

    // Stem
    const stemStart = cy + 3;
    const bottom = Math.min(rows - 2, Math.max(stemStart, stemBottom));
    for (let y1 = stemStart; y1 <= bottom; y1++) {
      setPixel(cx, y1, PAL_STEM);
    }

    // Leaves (one or two)
    const leafY = Math.min(rows - 3, stemStart + 2);
    if (variant === 0) {
      setPixel(cx - 1, leafY, PAL_LEAF);
      setPixel(cx - 2, leafY + 1, PAL_LEAF);
      setPixel(cx - 1, leafY + 1, PAL_LEAF);
    } else {
      setPixel(cx + 1, leafY, PAL_LEAF);
      setPixel(cx + 2, leafY + 1, PAL_LEAF);
      setPixel(cx + 1, leafY + 1, PAL_LEAF);
      setPixel(cx - 1, leafY + 2, PAL_LEAF);
    }
  }

  // Ground hint (tiny darker band at the bottom)
  for (let px = 1; px < cols - 1; px++) {
    if (px % 3 === 0) setPixel(px, rows - 2, 0xcbd5e1);
  }

  // Three sunflowers in the frame (2~4 requested; choose 3 for balanced composition)
  stampSunflower(Math.floor(cols * 0.28), Math.floor(rows * 0.34), rows - 3, 0);
  stampSunflower(Math.floor(cols * 0.52), Math.floor(rows * 0.28), rows - 4, 1);
  stampSunflower(Math.floor(cols * 0.76), Math.floor(rows * 0.38), rows - 3, 0);

  // Flush pixels by color to reduce beginFill calls
  for (const [colorKey, points] of Object.entries(pixelsByColor)) {
    const color = Number(colorKey);
    g.beginFill(color, 1);
    for (const { px, py } of points) {
      g.drawRect(artX + px * PIXEL_SIZE, artY + py * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }
    g.endFill();
  }
}

function drawBottomWindowsBand(g: any, offsetX: number): void {
  const bandY = OFFICE_HEIGHT - BOTTOM_WINDOW_BAND_MARGIN - BOTTOM_WINDOW_BAND_HEIGHT;

  // Band backdrop (slightly darker)
  g.lineStyle(0);
  g.beginFill(0x0f172a, 0.12);
  g.drawRect(offsetX, bandY, OFFICE_WIDTH, BOTTOM_WINDOW_BAND_HEIGHT);
  g.endFill();

  // Window panels
  const windowCount = 4;
  const gutter = 18;
  const panelW = Math.floor((OFFICE_WIDTH - gutter * (windowCount + 1)) / windowCount);
  const panelH = 44;
  const panelY = bandY + Math.floor((BOTTOM_WINDOW_BAND_HEIGHT - panelH) / 2);

  for (let i = 0; i < windowCount; i++) {
    const x = offsetX + gutter + i * (panelW + gutter);

    // Glow
    g.beginFill(0x60a5fa, 0.12);
    g.drawRect(x - 4, panelY - 4, panelW + 8, panelH + 8);
    g.endFill();

    // Glass
    g.beginFill(0x93c5fd, 0.28);
    g.drawRect(x, panelY, panelW, panelH);
    g.endFill();

    // Reflection stripes
    g.beginFill(0xffffff, 0.10);
    g.drawRect(x + 6, panelY + 6, 4, panelH - 12);
    g.drawRect(x + 16, panelY + 10, 3, panelH - 20);
    g.endFill();

    // Frame
    g.lineStyle(2, 0x334155, 0.7);
    g.drawRect(x, panelY, panelW, panelH);
    g.lineStyle(1, 0x334155, 0.5);
    g.moveTo(x + Math.floor(panelW / 2), panelY);
    g.lineTo(x + Math.floor(panelW / 2), panelY + panelH);
  }

  g.lineStyle(0);
}

interface DeskProps {
  x: number;
  y: number;
  label: string;
  showVacation: boolean;
  hasError: boolean;
  agentStatus: AgentStatus;
  agentType: AgentType;
}

const DESK_LABEL_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 7,
  fill: 0xe0d0c0,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

function Desk({ x, y, label, showVacation, hasError, agentStatus, agentType }: DeskProps): JSX.Element {
  const draw = useCallback((g: any) => {
    g.clear();
    drawDeskBase(g);
    drawMonitorFrame(g);
    drawKeyboard(g);
    drawDeskItems(g);
  }, []);

  return (
    <Container x={x} y={y}>
      <Graphics draw={draw} />
      <MonitorScreen status={agentStatus} agentType={agentType} />
      {hasError && (
        <Container x={25} y={-28}>
          <AlertLight />
        </Container>
      )}
      {showVacation && (
        <Container x={DESK_VACATION_SIGN_X} y={DESK_VACATION_SIGN_Y}>
          <VacationSign />
          <Container x={0} y={22}>
            <QueueIndicator />
          </Container>
        </Container>
      )}
      <Text text={label} style={DESK_LABEL_STYLE} anchor={0.5} y={45} />
    </Container>
  );
}

function drawDeskBase(g: any): void {
  // Shadow
  g.beginFill(0x000000, 0.2);
  g.drawRect(-42, 28, 84, 8);
  g.endFill();

  // Legs
  g.beginFill(0x654321);
  g.drawRect(-38, 20, 6, 15);
  g.drawRect(32, 20, 6, 15);
  g.endFill();

  // Surface
  g.beginFill(0x8b5a2b);
  g.drawRect(-45, -5, 90, 30);
  g.endFill();

  // Surface highlight
  g.beginFill(0xa0693e);
  g.drawRect(-43, -3, 86, 8);
  g.endFill();

  // Edge
  g.beginFill(0x654321);
  g.drawRect(-45, 23, 90, 4);
  g.endFill();
}

const PARTITION_COLOR = 0xa3e635; // lime-ish
const PARTITION_BORDER = 0x4d7c0f;

interface HorizontalPartitionProps {
  y: number;
}

function HorizontalPartition({ y }: HorizontalPartitionProps): JSX.Element {
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

function drawMonitorFrame(g: any): void {
  // Back/frame
  g.beginFill(0x2a2a2a);
  g.drawRect(-18, -25, 36, 24);
  g.endFill();

  // Stand
  g.beginFill(0x2a2a2a);
  g.drawRect(-4, -3, 8, 6);
  g.endFill();
}

interface MonitorScreenProps {
  status: AgentStatus;
  agentType: AgentType;
}

function MonitorScreen({ status, agentType }: MonitorScreenProps): JSX.Element {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (status === "idle") return;

    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 8);
    }, 150);

    return () => clearInterval(interval);
  }, [status]);

  const draw = useCallback((g: any) => {
    g.clear();

    const screenColor = getScreenColor(status);
    g.beginFill(screenColor);
    g.drawRect(-16, -23, 32, 18);
    g.endFill();

    switch (status) {
      case "idle":
        drawIdleScreen(g);
        break;
      case "working":
        drawWorkingScreen(g, agentType, frame);
        break;
      case "thinking":
        drawThinkingScreen(g, frame);
        break;
      case "passing":
        drawPassingScreen(g, frame);
        break;
      case "error":
        drawErrorScreen(g, frame);
        break;
    }
  }, [status, agentType, frame]);

  return <Graphics draw={draw} />;
}

function getScreenColor(status: AgentStatus): number {
  switch (status) {
    case "idle": return 0x1a2a3a;
    case "working": return 0x0a2a1a;
    case "thinking": return 0x1a1a3a;
    case "passing": return 0x2a1a3a;
    case "error": return 0x3a1a1a;
  }
}

function drawIdleScreen(g: any): void {
  // Dim screen with scanlines
  g.beginFill(0x2a3a4a, 0.3);
  for (let y = -22; y < -5; y += 2) {
    g.drawRect(-15, y, 30, 1);
  }
  g.endFill();
}

function drawWorkingScreen(g: any, agentType: AgentType, frame: number): void {
  // Code lines scrolling animation
  const lineColor = AGENT_COLORS[agentType];

  for (let i = 0; i < 5; i++) {
    const yOffset = ((i + frame) % 5) * 3;
    const width = 8 + ((i * 7 + frame) % 12);
    const xOffset = (i % 2) * 4;

    g.beginFill(lineColor, 0.7);
    g.drawRect(-14 + xOffset, -21 + yOffset, width, 2);
    g.endFill();
  }

  // Cursor blink
  if (frame % 2 === 0) {
    g.beginFill(0xffffff, 0.8);
    g.drawRect(10, -9, 2, 3);
    g.endFill();
  }
}

function drawThinkingScreen(g: any, frame: number): void {
  // Loading dots animation
  const dotCount = 3;
  const activeIndex = frame % dotCount;

  for (let i = 0; i < dotCount; i++) {
    const alpha = i === activeIndex ? 1 : 0.3;
    g.beginFill(0x6090ff, alpha);
    g.drawCircle(-6 + i * 6, -14, 2);
    g.endFill();
  }

  // Brain/gear icon
  g.beginFill(0x8090ff, 0.6);
  g.drawCircle(0, -14, 4);
  g.beginFill(0x4060ff, 0.4);
  g.drawCircle(0, -14, 2);
  g.endFill();
}

function drawPassingScreen(g: any, frame: number): void {
  // Arrow animation moving right
  const arrowX = -10 + (frame % 4) * 5;

  g.beginFill(0xa060ff, 0.8);
  // Arrow body
  g.drawRect(arrowX, -15, 8, 4);
  // Arrow head
  g.moveTo(arrowX + 8, -17);
  g.lineTo(arrowX + 12, -13);
  g.lineTo(arrowX + 8, -9);
  g.closePath();
  g.endFill();

  // Transfer icon
  g.beginFill(0xffffff, 0.5);
  g.drawRect(-12, -10, 6, 4);
  g.drawRect(6, -10, 6, 4);
  g.endFill();
}

function drawErrorScreen(g: any, frame: number): void {
  // Flashing warning
  const flash = frame % 2 === 0;

  if (flash) {
    g.beginFill(0xff4040, 0.3);
    g.drawRect(-15, -22, 30, 16);
    g.endFill();
  }

  // Error X mark
  g.lineStyle(2, 0xff6060, 0.9);
  g.moveTo(-6, -18);
  g.lineTo(6, -10);
  g.moveTo(6, -18);
  g.lineTo(-6, -10);
}

function drawKeyboard(g: any): void {
  g.beginFill(0x3a3a3a);
  g.drawRect(-14, 8, 28, 10);
  g.endFill();

  // Keys
  g.beginFill(0x4a4a4a);
  for (let kx = -12; kx < 12; kx += 4) {
    g.drawRect(kx, 10, 3, 3);
    g.drawRect(kx, 14, 3, 2);
  }
  g.endFill();
}

function drawDeskItems(g: any): void {
  // Mug
  g.beginFill(0xd4a574);
  g.drawRect(25, 2, 12, 14);
  g.endFill();
  g.beginFill(0xb8956a);
  g.drawRect(27, 4, 8, 10);
  g.endFill();

  // Notebook
  g.beginFill(0xf5f5dc);
  g.drawRect(-38, 6, 16, 12);
  g.endFill();
  g.lineStyle(1, 0x87ceeb);
  g.moveTo(-36, 10);
  g.lineTo(-24, 10);
  g.moveTo(-36, 13);
  g.lineTo(-26, 13);
}

interface AgentSpriteProps {
  agent: Agent;
  x: number;
  y: number;
  alpha: number;
  motion?: AgentMotion;
}

const VACATION_SIGN_TEXT_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 6,
  fill: 0xfff7ed,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

function VacationSign(): JSX.Element {
  const draw = useCallback((g: any) => {
    g.clear();

    // Sign shadow
    g.beginFill(0x000000, 0.2);
    g.drawRoundedRect(-VACATION_SIGN_WIDTH / 2 + 1, -VACATION_SIGN_HEIGHT / 2 + 1, VACATION_SIGN_WIDTH, VACATION_SIGN_HEIGHT, 4);
    g.endFill();

    // Sign base
    g.beginFill(0x8b5a2b);
    g.drawRoundedRect(-VACATION_SIGN_WIDTH / 2, -VACATION_SIGN_HEIGHT / 2, VACATION_SIGN_WIDTH, VACATION_SIGN_HEIGHT, 4);
    g.endFill();

    // Border
    g.lineStyle(1, 0x654321, 0.8);
    g.drawRoundedRect(-VACATION_SIGN_WIDTH / 2, -VACATION_SIGN_HEIGHT / 2, VACATION_SIGN_WIDTH, VACATION_SIGN_HEIGHT, 4);

    // Pin
    g.lineStyle(0);
    g.beginFill(0xef4444);
    g.drawCircle(-VACATION_SIGN_WIDTH / 2 + 6, -VACATION_SIGN_HEIGHT / 2 + 6, 2);
    g.endFill();
  }, []);

  return (
    <Container>
      <Graphics draw={draw} />
      <Text text="휴가중" style={VACATION_SIGN_TEXT_STYLE} anchor={0.5} />
    </Container>
  );
}

// AlertLight component: flashing red siren on desk
function AlertLight(): JSX.Element {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 2);
    }, ALERT_LIGHT_BLINK_MS);
    return () => clearInterval(interval);
  }, []);

  const draw = useCallback((g: any) => {
    g.clear();

    const isOn = frame === 0;

    // Light glow when on
    if (isOn) {
      g.beginFill(0xff4040, 0.3);
      g.drawCircle(0, 0, 10);
      g.endFill();
    }

    // Light base
    g.beginFill(0x2a2a2a);
    g.drawRect(-4, 2, 8, 4);
    g.endFill();

    // Light dome
    g.beginFill(isOn ? 0xff4040 : 0x8b2020);
    g.drawCircle(0, 0, 5);
    g.endFill();

    // Highlight
    if (isOn) {
      g.beginFill(0xffffff, 0.5);
      g.drawCircle(-1, -1, 2);
      g.endFill();
    }
  }, [frame]);

  return <Graphics draw={draw} />;
}

// QueueIndicator component: loading dots animation for rate limit
function QueueIndicator(): JSX.Element {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 3);
    }, QUEUE_DOT_BLINK_MS);
    return () => clearInterval(interval);
  }, []);

  const draw = useCallback((g: any) => {
    g.clear();

    // Hourglass icon
    g.beginFill(0xfbbf24, 0.8);
    // Top half
    g.moveTo(-4, -8);
    g.lineTo(4, -8);
    g.lineTo(0, -3);
    g.closePath();
    // Bottom half
    g.moveTo(-4, 2);
    g.lineTo(4, 2);
    g.lineTo(0, -3);
    g.closePath();
    g.endFill();

    // Loading dots
    for (let i = 0; i < 3; i++) {
      const alpha = i === frame ? 1 : 0.3;
      g.beginFill(0xfbbf24, alpha);
      g.drawCircle(-6 + i * 6, 10, 2);
      g.endFill();
    }
  }, [frame]);

  return <Graphics draw={draw} />;
}

// HudDisplay component: top bar showing metrics
interface HudDisplayProps {
  toolCallCount: number;
  avgToolResponseMs: number | null;
  errorCount: number;
  agentSwitchCount: number;
  rateLimitActive: boolean;
}

const HUD_TEXT_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 7,
  fill: 0xe0e0e0,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

const HUD_LIMIT_TEXT_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 7,
  fill: 0xff6060,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

function HudDisplay({ toolCallCount, avgToolResponseMs, errorCount, agentSwitchCount, rateLimitActive }: HudDisplayProps): JSX.Element {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!rateLimitActive) return;
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 2);
    }, 500);
    return () => clearInterval(interval);
  }, [rateLimitActive]);

  const draw = useCallback((g: any) => {
    g.clear();

    // Semi-transparent background bar
    g.beginFill(0x1a1a2e, 0.85);
    g.drawRect(0, 0, OFFICE_WIDTH, HUD_BAR_HEIGHT);
    g.endFill();

    // Bottom border
    g.lineStyle(1, 0x4a4a6a, 0.5);
    g.moveTo(0, HUD_BAR_HEIGHT);
    g.lineTo(OFFICE_WIDTH, HUD_BAR_HEIGHT);
  }, []);

  const avgText = typeof avgToolResponseMs === "number"
    ? (avgToolResponseMs >= 1000 ? `${(avgToolResponseMs / 1000).toFixed(1)}s` : `${avgToolResponseMs}ms`)
    : "--";
  const mainText = `Calls: ${toolCallCount}  Avg: ${avgText}  Err: ${errorCount}  Switch: ${agentSwitchCount}`;
  const showLimitFlash = rateLimitActive && frame === 0;

  return (
    <Container>
      <Graphics draw={draw} />
      <Text text={mainText} style={HUD_TEXT_STYLE} x={10} y={6} />
      {rateLimitActive && (
        <Text
          text="LIMIT"
          style={showLimitFlash ? HUD_LIMIT_TEXT_STYLE : HUD_TEXT_STYLE}
          x={OFFICE_WIDTH - 50}
          y={6}
        />
      )}
    </Container>
  );
}

function AgentSprite({ agent, x, y, alpha, motion }: AgentSpriteProps): JSX.Element {
  const [frame, setFrame] = useState(0);
  const [walkFrame, setWalkFrame] = useState(0);
  const color = AGENT_COLORS[agent.agent_type];
  const statusColor = STATUS_COLORS[agent.status];
  const hairColor = HAIR_COLORS[agent.agent_type];

  // Walking state
  const isWalking = motion?.phase === "walking" || motion?.phase === "returning";
  const walkDirection = isWalking && motion ? (motion.to.x < motion.from.x ? -1 : 1) : 1;

  useEffect(() => {
    if (agent.status === "idle" && !isWalking) return;

    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 4);
    }, ANIMATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [agent.status, isWalking]);

  // Faster walking animation
  useEffect(() => {
    if (!isWalking) return;

    const interval = setInterval(() => {
      setWalkFrame((f) => (f + 1) % 4);
    }, WALKING_ANIMATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isWalking]);

  const message = useMemo(() => {
    if (agent.status === "idle") return "";
    return formatAgentMessage({
      status: agent.status,
      agentType: agent.agent_type,
      rawTask: agent.current_task,
    });
  }, [agent.status, agent.agent_type, agent.current_task]);

  const draw = useCallback((g: any) => {
    g.clear();

    const effectiveFrame = isWalking ? walkFrame : frame;
    const bounce = (agent.status !== "idle" || isWalking) ? Math.sin(effectiveFrame * Math.PI / 2) * 3 : 0;
    const isWorking = agent.status === "working" || agent.status === "thinking";

    drawAgentShadow(g);
    drawAgentLegs(g, bounce, isWorking || isWalking, effectiveFrame, isWalking);
    drawAgentBody(g, bounce, color, isWorking || isWalking, effectiveFrame, isWalking);
    drawAgentHead(g, bounce, hairColor);
    drawAgentFace(g, bounce, agent.status, effectiveFrame, walkDirection, isWalking);
    drawStatusIndicator(g, bounce, statusColor, agent.status === "error");
  }, [color, statusColor, hairColor, frame, walkFrame, agent.status, isWalking, walkDirection]);

  const showBubble = agent.status !== "idle" && message;

  return (
    <Container x={x} y={y} alpha={alpha}>
      <Graphics draw={draw} />
      {showBubble && <SpeechBubble text={message} />}
    </Container>
  );
}

// Agent drawing helper functions
function drawAgentShadow(g: any): void {
  g.beginFill(0x000000, 0.25);
  g.drawEllipse(0, 28, 14, 5);
  g.endFill();
}

function drawAgentLegs(g: any, bounce: number, isWorking: boolean, frame: number, isWalking: boolean = false): void {
  // Walking uses larger leg movement
  const legOffset = isWalking
    ? Math.sin(frame * Math.PI) * 4
    : (isWorking ? Math.sin(frame * Math.PI) * 2 : 0);

  // Legs
  g.beginFill(0x3a3a5a);
  g.drawRect(-8, 15 - bounce, 6, 14);
  g.drawRect(2, 15 - bounce + legOffset, 6, 14 - legOffset);
  g.endFill();

  // Shoes
  g.beginFill(0x2a2a3a);
  g.drawRect(-9, 26 - bounce, 8, 4);
  g.drawRect(1, 26 - bounce + legOffset, 8, 4 - legOffset / 2);
  g.endFill();
}

function drawAgentBody(g: any, bounce: number, color: number, isWorking: boolean, frame: number, isWalking: boolean = false): void {
  // Walking uses larger arm swing
  const armSwing = isWalking
    ? Math.sin(frame * Math.PI) * 5
    : (isWorking ? Math.sin(frame * Math.PI) * 3 : 0);

  // Torso
  g.beginFill(color);
  g.drawRect(-10, -5 - bounce, 20, 22);
  g.endFill();

  // Body shading
  g.beginFill(0x000000, 0.15);
  g.drawRect(5, -3 - bounce, 5, 18);
  g.endFill();

  // Collar
  g.beginFill(0xffffff, 0.3);
  g.drawRect(-4, -5 - bounce, 8, 4);
  g.endFill();

  // Arms
  g.beginFill(color);
  g.drawRect(-14, -2 - bounce, 5, 16 + armSwing);
  g.drawRect(9, -2 - bounce + armSwing, 5, 16 - armSwing);
  g.endFill();

  // Hands
  g.beginFill(0xffd5b4);
  g.drawRect(-14, 12 - bounce + armSwing, 5, 5);
  g.drawRect(9, 12 - bounce, 5, 5);
  g.endFill();
}

function drawAgentHead(g: any, bounce: number, hairColor: number): void {
  // Head
  g.beginFill(0xffd5b4);
  g.drawRect(-10, -25 - bounce, 20, 22);
  g.endFill();

  // Hair
  g.beginFill(hairColor);
  g.drawRect(-11, -28 - bounce, 22, 8);
  g.drawRect(-10, -26 - bounce, 20, 3);
  g.drawRect(-11, -22 - bounce, 3, 6);
  g.drawRect(8, -22 - bounce, 3, 6);
  g.endFill();
}

function drawAgentFace(g: any, bounce: number, status: string, frame: number, direction: number = 1, isWalking: boolean = false): void {
  // Eyes
  g.beginFill(0xffffff);
  g.drawRect(-7, -18 - bounce, 5, 5);
  g.drawRect(2, -18 - bounce, 5, 5);
  g.endFill();

  // Pupils - look in walking direction when walking
  const { lookX, lookY } = isWalking
    ? { lookX: direction * 1.5, lookY: 0 }
    : getPupilOffset(status, frame);
  g.beginFill(0x2a2a3a);
  g.drawRect(-6 + lookX, -17 - bounce + lookY, 3, 3);
  g.drawRect(3 + lookX, -17 - bounce + lookY, 3, 3);
  g.endFill();

  // Mouth
  const mouthStyle = getMouthStyle(status);
  g.beginFill(mouthStyle.color);
  g.drawRect(-3 + mouthStyle.xOffset, -9 - bounce, mouthStyle.width, mouthStyle.height);
  g.endFill();
}

function getPupilOffset(status: string, frame: number): { lookX: number; lookY: number } {
  if (status === "thinking") {
    return { lookX: Math.sin(frame * 0.8) * 2, lookY: -1 };
  }
  if (status === "passing") {
    return { lookX: 2, lookY: 0 };
  }
  return { lookX: 0, lookY: 0 };
}

function getMouthStyle(status: string): { color: number; width: number; height: number; xOffset: number } {
  if (status === "error") {
    return { color: 0x8b4513, width: 6, height: 2, xOffset: 0 };
  }
  if (status === "working") {
    return { color: 0xd4956a, width: 4, height: 1, xOffset: 1 };
  }
  return { color: 0xd4956a, width: 4, height: 2, xOffset: 1 };
}

function drawStatusIndicator(g: any, bounce: number, statusColor: number, isError: boolean): void {
  // Status dot
  g.beginFill(statusColor);
  g.drawCircle(14, -22 - bounce, 5);
  g.endFill();

  // Highlight
  g.beginFill(0xffffff, 0.4);
  g.drawCircle(13, -23 - bounce, 2);
  g.endFill();

  // Error badge
  if (isError) {
    g.beginFill(0xef4444);
    g.drawRect(-4, -38 - bounce, 8, 10);
    g.endFill();
    g.beginFill(0xffffff);
    g.drawRect(-1, -36 - bounce, 2, 5);
    g.drawRect(-1, -30 - bounce, 2, 2);
    g.endFill();
  }
}

interface FlyingDocumentProps {
  transfer: DocumentTransfer;
  now: number;
  stackDepth: number;
  onComplete: (transferId: string) => void;
}

function getAgentPosition(agentId: string): { x: number; y: number } {
  const desk = DESK_CONFIGS.find((d) => d.id === agentId);
  if (!desk) return { x: OFFICE_WIDTH / 2, y: OFFICE_HEIGHT / 2 };
  return { x: desk.position[0], y: desk.position[1] - 55 }; // Agent position above desk
}

const DOCUMENT_ARC_HEIGHT = 60;

interface ToolStamp {
  label: string;
  color: number;
}

function getToolStamp(toolName: string | null | undefined): ToolStamp {
  const tool = toolName?.trim()?.toLowerCase();
  if (!tool) return { label: "???", color: 0x6b7280 };
  if (tool === "read") return { label: "READ", color: 0x3b82f6 };
  if (tool === "glob" || tool === "grep" || tool === "websearch" || tool === "webfetch") return { label: "SRCH", color: 0x38bdf8 };
  if (tool === "write") return { label: "WRIT", color: 0x22c55e };
  if (tool === "edit" || tool === "notebookedit" || tool === "editnotebook") return { label: "EDIT", color: 0x16a34a };
  if (tool === "bash") return { label: "BASH", color: 0xf59e0b };
  if (tool === "todowrite" || tool === "task") return { label: "PLAN", color: 0xec4899 };
  return { label: tool.slice(0, 4).toUpperCase(), color: 0x6b7280 };
}

const STAMP_TEXT_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 5,
  fill: 0xffffff,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowBlur: 0,
  dropShadowDistance: 1,
});

function FlyingDocument({ transfer, now, stackDepth, onComplete }: FlyingDocumentProps): JSX.Element | null {
  const progress = clamp01((now - transfer.startedAt) / DOCUMENT_TRANSFER_DURATION_MS);

  useEffect(() => {
    if (progress >= 1) {
      onComplete(transfer.id);
    }
  }, [progress, onComplete, transfer.id]);

  if (progress >= 1) return null;

  const eased = easeOutCubic(progress);
  const from = getAgentPosition(transfer.fromAgentId);
  const to = getAgentPosition(transfer.toAgentId);

  // Arc trajectory
  const x = lerp(from.x, to.x, eased);
  const baseY = lerp(from.y, to.y, eased);
  const y = baseY - Math.sin(progress * Math.PI) * DOCUMENT_ARC_HEIGHT;

  const rotation = progress * Math.PI * 2 + stackDepth * 0.08;
  const scale = 1 + Math.sin(progress * Math.PI) * 0.3;

  const stackOffsetX = stackDepth * 2;
  const stackOffsetY = stackDepth * 1;
  const stackScale = Math.max(0.7, 1 - stackDepth * 0.05);
  const stackAlpha = Math.max(0.35, 1 - stackDepth * 0.15);

  const stamp = useMemo(() => getToolStamp(transfer.toolName), [transfer.toolName]);

  const draw = useCallback((g: any) => {
    g.clear();

    // Document shadow
    g.beginFill(0x000000, 0.2);
    g.drawRect(-DOCUMENT_SIZE / 2 + 2, -DOCUMENT_SIZE * 0.7 + 2, DOCUMENT_SIZE, DOCUMENT_SIZE * 1.4);
    g.endFill();

    // Document paper
    g.beginFill(0xffffff);
    g.drawRect(-DOCUMENT_SIZE / 2, -DOCUMENT_SIZE * 0.7, DOCUMENT_SIZE, DOCUMENT_SIZE * 1.4);
    g.endFill();

    // Stamp (top-left)
    const stampW = 12;
    const stampH = 7;
    const stampX = -DOCUMENT_SIZE / 2 + 2;
    const stampY = -DOCUMENT_SIZE * 0.7 + 2;
    g.beginFill(stamp.color, 0.95);
    g.drawRoundedRect(stampX, stampY, stampW, stampH, 2);
    g.endFill();
    g.lineStyle(1, 0x0f172a, 0.35);
    g.drawRoundedRect(stampX, stampY, stampW, stampH, 2);
    g.lineStyle(0);

    // Document lines (text)
    g.beginFill(0x4a4a6a, 0.6);
    g.drawRect(-DOCUMENT_SIZE / 2 + 2, -DOCUMENT_SIZE * 0.2, DOCUMENT_SIZE - 4, 2);
    g.drawRect(-DOCUMENT_SIZE / 2 + 2, 0, DOCUMENT_SIZE - 6, 2);
    g.drawRect(-DOCUMENT_SIZE / 2 + 2, DOCUMENT_SIZE * 0.2, DOCUMENT_SIZE - 5, 2);
    g.endFill();

    // Fold corner
    g.beginFill(0xe0e0e0);
    g.moveTo(DOCUMENT_SIZE / 2 - 4, -DOCUMENT_SIZE * 0.7);
    g.lineTo(DOCUMENT_SIZE / 2, -DOCUMENT_SIZE * 0.7 + 4);
    g.lineTo(DOCUMENT_SIZE / 2, -DOCUMENT_SIZE * 0.7);
    g.closePath();
    g.endFill();
  }, [stamp.color]);

  return (
    <Container x={x + stackOffsetX} y={y + stackOffsetY} rotation={rotation} scale={scale * stackScale} alpha={stackAlpha}>
      <Graphics draw={draw} />
      <Text
        text={stamp.label}
        style={STAMP_TEXT_STYLE}
        anchor={0.5}
        x={-DOCUMENT_SIZE / 2 + 2 + 6}
        y={-DOCUMENT_SIZE * 0.7 + 2 + 3.5}
      />
    </Container>
  );
}

interface SpeechBubbleProps {
  text: string;
}

function SpeechBubble({ text }: SpeechBubbleProps): JSX.Element {
  const displayText = text.length > SPEECH_BUBBLE_MAX_CHARS
    ? text.slice(0, SPEECH_BUBBLE_TRUNCATE_AT) + "..."
    : text;

  const bubbleWidth = Math.max(80, Math.min(160, displayText.length * 5 + 20));
  const halfWidth = bubbleWidth / 2;

  const draw = useCallback((g: any) => {
    g.clear();

    // Shadow
    g.beginFill(0x000000, 0.15);
    g.drawRoundedRect(-halfWidth + 2, -48, bubbleWidth, 32, 8);
    g.endFill();

    // Background
    g.beginFill(0xffffff);
    g.drawRoundedRect(-halfWidth, -50, bubbleWidth, 32, 8);
    g.endFill();

    // Border
    g.lineStyle(1.5, 0x4a4a6a, 0.5);
    g.drawRoundedRect(-halfWidth, -50, bubbleWidth, 32, 8);

    // Tail
    g.lineStyle(0);
    g.beginFill(0xffffff);
    g.moveTo(-6, -18);
    g.lineTo(6, -18);
    g.lineTo(0, -8);
    g.closePath();
    g.endFill();

    g.lineStyle(1.5, 0x4a4a6a, 0.5);
    g.moveTo(-6, -18);
    g.lineTo(0, -8);
    g.lineTo(6, -18);
  }, [bubbleWidth, halfWidth]);

  const textStyle = useMemo(() => new TextStyle({
    fontFamily: '"Press Start 2P", monospace',
    fontSize: 6,
    fill: 0x2d2d4a,
    wordWrap: true,
    wordWrapWidth: bubbleWidth - 16,
    align: "center",
    lineHeight: 10,
  }), [bubbleWidth]);

  return (
    <Container>
      <Graphics draw={draw} />
      <Text text={displayText} style={textStyle} anchor={0.5} y={-34} />
    </Container>
  );
}

// Timeout for speech bubble disappearance (ms)
const SPEECH_BUBBLE_TIMEOUT_MS = 5000;
const SPEECH_BUBBLE_CHECK_INTERVAL_MS = 1000;

export function OfficeCanvas(): JSX.Element {
  // Consolidated Zustand selectors using useShallow to reduce re-renders
  const { agents, vacationById, errorById, documentTransfers } = useAgentStore(
    useShallow((state) => ({
      agents: state.agents,
      vacationById: state.vacationById,
      errorById: state.errorById,
      documentTransfers: state.documentTransfers,
    }))
  );
  const removeDocumentTransfer = useAgentStore((state) => state.removeDocumentTransfer);
  const clearExpiredTasks = useAgentStore((state) => state.clearExpiredTasks);
  const hudMetrics = useHudStore(useShallow((state) => state.getMetrics()));
  const [dimensions, setDimensions] = useState({ width: OFFICE_WIDTH, height: OFFICE_HEIGHT });
  const [motionById, setMotionById] = useState<Record<string, AgentMotion>>({});

  // Use ref for `now` to avoid triggering re-renders on every RAF tick
  const nowRef = useRef(performance.now());
  const [, forceUpdate] = useState(0);

  // Start HUD pruning on mount
  useEffect(() => {
    startHudPruning();
    return () => stopHudPruning();
  }, []);

  // Drive animations via requestAnimationFrame - only update when animations active
  useEffect(() => {
    let raf = 0;
    let lastUpdateTime = performance.now();

    const tick = (t: number) => {
      nowRef.current = t;

      // Check if any animations are active
      const hasActiveDocTransfers = documentTransfers.length > 0;
      const hasEnteringMotions = Object.values(motionById).some((m) => m.phase === "entering");
      const hasWalkingMotions = Object.values(motionById).some(
        (m) => m.phase === "walking" || m.phase === "returning"
      );
      const needsUpdate = hasActiveDocTransfers || hasEnteringMotions || hasWalkingMotions;

      // Only trigger re-render when animations are active (throttled to ~30fps)
      if (needsUpdate && t - lastUpdateTime > 33) {
        lastUpdateTime = t;
        forceUpdate((n) => n + 1);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [documentTransfers.length, motionById]);

  // Clear speech bubbles after timeout
  useEffect(() => {
    const interval = setInterval(() => {
      clearExpiredTasks(SPEECH_BUBBLE_TIMEOUT_MS);
    }, SPEECH_BUBBLE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [clearExpiredTasks]);

  // Start entering transition when agent becomes visible, or set absent when hidden.
  // Also handle walking/returning transitions.
  useEffect(() => {
    const ts = nowRef.current;
    const start = { x: ENTRY_START_X, y: ENTRY_START_Y };

    setMotionById((prev) => {
      const next: Record<string, AgentMotion> = { ...prev };

      for (const agent of Object.values(agents)) {
        const id = agent.id;
        const target = getAgentPosition(id); // DESK_CONFIGS 사용
        const wantsVisible = agent.status !== "idle" || Boolean(vacationById[id]);
        const current = next[id];

        const currentPhase: MotionPhase = current?.phase ?? "absent";
        const isCurrentlyWalking = currentPhase === "walking" || currentPhase === "returning";

        if (wantsVisible) {
          // idle → working 전환
          if (isCurrentlyWalking) {
            // walking 중이면 returning으로 전환 (책상으로 복귀)
            const pos = computeMotionState(current!, ts);
            next[id] = {
              phase: "returning",
              startedAt: ts,
              durationMs: calculateReturnDuration(pos, target),
              from: { x: pos.x, y: pos.y, alpha: 1 },
              to: { x: target.x, y: target.y, alpha: 1 },
            };
          } else if (currentPhase === "absent") {
            // 첫 등장: entering
            next[id] = {
              phase: "entering",
              startedAt: ts,
              durationMs: ENTER_DURATION_MS,
              from: { x: start.x, y: start.y, alpha: 0 },
              to: { x: target.x, y: target.y, alpha: 1 },
            };
          }
        } else {
          // working → idle 전환: present면 walking 시작
          if (currentPhase === "present") {
            const startPos = { x: target.x, y: target.y };
            const band = findCurrentBand(startPos.y) ?? WALKABLE_BANDS[1]; // fallback
            const waypoint = generateWaypointInBand(band);
            next[id] = {
              phase: "walking",
              startedAt: ts,
              durationMs: calculateWalkDuration(startPos, waypoint),
              from: { ...startPos, alpha: 1 },
              to: { ...waypoint, alpha: 1 },
            };
          }
          // absent 상태면 그대로 유지 (처음 idle은 walking 안 함)
        }
      }

      return next;
    });
  }, [agents, vacationById]);

  // Finalize motion transitions (entering->present, walking->next waypoint, returning->present)
  useEffect(() => {
    const ts = nowRef.current;
    setMotionById((prev) => {
      let changed = false;
      const next: Record<string, AgentMotion> = { ...prev };

      for (const [id, motion] of Object.entries(prev)) {
        const progress = (ts - motion.startedAt) / motion.durationMs;
        if (progress < 1) continue;

        if (motion.phase === "entering") {
          changed = true;
          next[id] = { ...motion, phase: "present" };
        } else if (motion.phase === "returning") {
          changed = true;
          next[id] = { ...motion, phase: "present" };
        } else if (motion.phase === "walking") {
          // walking 완료: 같은 band 내 새 웨이포인트로 이동
          const band = findCurrentBand(motion.to.y) ?? WALKABLE_BANDS[1];
          const waypoint = generateWaypointInBand(band);
          const pause = WALKING_PAUSE_MIN_MS + Math.random() * (WALKING_PAUSE_MAX_MS - WALKING_PAUSE_MIN_MS);

          next[id] = {
            phase: "walking",
            startedAt: ts + pause, // 잠시 멈춤 후 이동
            durationMs: calculateWalkDuration(motion.to, waypoint),
            from: { ...motion.to },
            to: { ...waypoint, alpha: 1 },
          };
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  });

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

  const visibleAgents = useMemo(() => {
    return Object.values(agents).filter((agent) => {
      const phase = motionById[agent.id]?.phase ?? "absent";
      if (phase !== "absent") return true;
      // Avoid popping an idle agent instantly at full alpha; wait for motion to start.
      return Boolean(vacationById[agent.id]) && Boolean(motionById[agent.id]);
    });
  }, [agents, motionById, vacationById]);

  return (
    <div className="office-container w-full h-full bg-inbox-bg">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        options={{ backgroundColor: 0x1a1a2e, antialias: true }}
      >
        <Container x={offsetX} y={offsetY} scale={scale}>
          <OfficeBackground viewport={viewport} />
          <HorizontalPartition y={70} />
          <HorizontalPartition y={420} />
          {DESK_CONFIGS.map((desk) => {
            const agent = agents[desk.id];
            const agentStatus: AgentStatus = agent?.status ?? "idle";
            return (
              <Desk
                key={desk.id}
                x={desk.position[0]}
                y={desk.position[1]}
                label={desk.label}
                showVacation={Boolean(vacationById[desk.id])}
                hasError={Boolean(errorById[desk.id])}
                agentStatus={agentStatus}
                agentType={desk.agentType}
              />
            );
          })}
          {visibleAgents.map((agent) => {
            const target = getAgentPosition(agent.id); // DESK_CONFIGS 사용
            const motion = motionById[agent.id];
            const state = motion ? computeMotionState(motion, nowRef.current) : { x: target.x, y: target.y, alpha: 1 };

            return (
              <AgentSprite
                key={agent.id}
                agent={agent}
                x={state.x}
                y={state.y}
                alpha={state.alpha}
                motion={motion}
              />
            );
          })}
          {documentTransfers.map((transfer, index) => {
            const stackDepth = documentTransfers.length - 1 - index; // newest = 0
            return (
              <FlyingDocument
                key={transfer.id}
                transfer={transfer}
                now={nowRef.current}
                stackDepth={stackDepth}
                onComplete={removeDocumentTransfer}
              />
            );
          })}
          {/* HUD overlay on top of wall */}
          {SHOW_HUD && (
            <HudDisplay
              toolCallCount={hudMetrics.toolCallCount}
              avgToolResponseMs={hudMetrics.avgToolResponseMs}
              errorCount={hudMetrics.errorCount}
              agentSwitchCount={hudMetrics.agentSwitchCount}
              rateLimitActive={hudMetrics.rateLimitActive}
            />
          )}
        </Container>
      </Stage>
    </div>
  );
}

function computeMotionState(motion: AgentMotion, now: number): { x: number; y: number; alpha: number } {
  const t = clamp01((now - motion.startedAt) / motion.durationMs);
  const e = easeOutCubic(t);
  return {
    x: lerp(motion.from.x, motion.to.x, e),
    y: lerp(motion.from.y, motion.to.y, e),
    alpha: lerp(motion.from.alpha, motion.to.alpha, e),
  };
}
