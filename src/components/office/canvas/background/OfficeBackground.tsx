import { Graphics } from "@pixi/react";
import { useCallback } from "react";
import type { ViewportRect } from "../types";
import {
  BOTTOM_WINDOW_BAND_HEIGHT,
  BOTTOM_WINDOW_BAND_MARGIN,
  COAT_HANGER_HEIGHT,
  COAT_HANGER_WIDTH,
  COAT_HANGER_X,
  COAT_HANGER_Y,
  ENTRANCE_HEIGHT,
  ENTRANCE_PADDING,
  ENTRANCE_TOP_Y,
  ENTRANCE_WIDTH,
  FLOOR_START_Y,
  LOCKER_CELL_SIZE,
  LOCKER_COLS,
  LOCKER_HEIGHT,
  LOCKER_ROWS,
  LOCKER_WIDTH,
  LOCKER_X,
  LOCKER_Y,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  RIGHT_WALL_START_X,
  RIGHT_WALL_WIDTH,
  SUNFLOWER_FRAME_GAP,
  TILE_BASE_COLOR,
  TILE_BORDER_COLOR,
  TILE_GAP,
  TILE_GROUT_COLOR,
  TILE_SCRATCH_ALPHA,
  TILE_SCRATCH_COLOR,
  TILE_SCRATCH_DENSITY,
  TILE_SIZE,
  TILE_VARIATION_DELTA,
  WALL_BEIGE_BASE,
  WALL_BEIGE_SHADOW,
  WALL_BEIGE_STRIPE,
  WALL_BEIGE_TRIM,
  WALL_HEIGHT,
} from "../constants";
import { adjustColor, hash2dInt, rand01FromHash } from "../math";
import { shouldDrawBottomBand, shouldDrawTopBand } from "../layout";

export function OfficeBackground({ viewport }: { viewport: ViewportRect }): JSX.Element {
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
  // Draw right wall (always visible when viewport overlaps)
  drawRightWall(g, viewport);
  drawCoatHanger(g);
  drawLocker(g);
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
  g.drawRect(offsetX, bandY, RIGHT_WALL_START_X, BOTTOM_WINDOW_BAND_HEIGHT);
  g.endFill();

  // Single large window panel
  const gutter = 18;
  const panelX = offsetX + gutter;
  const panelW = RIGHT_WALL_START_X - gutter * 2; // 오른쪽 벽 전까지
  const panelH = 44;
  const panelY = bandY + Math.floor((BOTTOM_WINDOW_BAND_HEIGHT - panelH) / 2);

  // Glow
  g.beginFill(0x60a5fa, 0.12);
  g.drawRect(panelX - 4, panelY - 4, panelW + 8, panelH + 8);
  g.endFill();

  // Glass
  g.beginFill(0x93c5fd, 0.28);
  g.drawRect(panelX, panelY, panelW, panelH);
  g.endFill();

  // Reflection stripes (distributed across the window)
  g.beginFill(0xffffff, 0.10);
  g.drawRect(panelX + 10, panelY + 6, 4, panelH - 12);
  g.drawRect(panelX + 22, panelY + 10, 3, panelH - 20);
  g.drawRect(panelX + panelW * 0.4, panelY + 8, 4, panelH - 16);
  g.drawRect(panelX + panelW * 0.7, panelY + 6, 3, panelH - 12);
  g.endFill();

  // Frame
  g.lineStyle(2, 0x334155, 0.7);
  g.drawRect(panelX, panelY, panelW, panelH);

  // Central mullion (수직 분할선)
  g.lineStyle(1, 0x334155, 0.5);
  g.moveTo(panelX + Math.floor(panelW / 2), panelY);
  g.lineTo(panelX + Math.floor(panelW / 2), panelY + panelH);

  g.lineStyle(0);
}

function drawRightWall(g: any, viewport: ViewportRect): void {
  const wallX = RIGHT_WALL_START_X;
  const wallY = WALL_HEIGHT; // 상단 벽 아래부터 시작
  const wallHeight = OFFICE_HEIGHT - wallY;

  // Check if viewport overlaps with right wall
  if (viewport.x + viewport.width < wallX) return;

  // Main wall fill (beige)
  g.beginFill(WALL_BEIGE_BASE);
  g.drawRect(wallX, wallY, RIGHT_WALL_WIDTH, wallHeight);
  g.endFill();

  // Texture stripes (vertical)
  g.beginFill(WALL_BEIGE_STRIPE, 0.35);
  for (let x = wallX; x < OFFICE_WIDTH; x += 12) {
    g.drawRect(x, wallY, 4, wallHeight);
  }
  g.endFill();

  // Left edge trim (wall border)
  g.lineStyle(3, WALL_BEIGE_TRIM, 1);
  g.moveTo(wallX, wallY);
  g.lineTo(wallX, OFFICE_HEIGHT);
  g.lineStyle(0);

  // Shadow on left edge
  g.beginFill(WALL_BEIGE_SHADOW, 0.4);
  g.drawRect(wallX, wallY, 8, wallHeight);
  g.endFill();

  // Connect to top wall
  g.beginFill(WALL_BEIGE_BASE);
  g.drawRect(wallX, 0, RIGHT_WALL_WIDTH, WALL_HEIGHT);
  g.endFill();
  g.beginFill(WALL_BEIGE_STRIPE, 0.35);
  for (let x = wallX; x < OFFICE_WIDTH; x += 12) {
    g.drawRect(x, 0, 4, WALL_HEIGHT);
  }
  g.endFill();
}

function drawCoatHanger(g: any): void {
  const x = COAT_HANGER_X;
  const y = COAT_HANGER_Y;
  const w = COAT_HANGER_WIDTH;
  const h = COAT_HANGER_HEIGHT;

  // Shadow
  g.beginFill(0x000000, 0.15);
  g.drawRect(x + 3, y + 3, w, h);
  g.endFill();

  // Back panel (wood)
  g.beginFill(0x8b5a2b, 0.95);
  g.drawRect(x, y, w, 12);
  g.endFill();

  // Wood grain on back panel
  g.beginFill(0x6b4423, 0.5);
  g.drawRect(x + 4, y + 2, 20, 2);
  g.drawRect(x + 30, y + 5, 18, 2);
  g.drawRect(x + 8, y + 8, 25, 2);
  g.endFill();

  // Hooks (3개)
  const hookColor = 0xc0c0c0; // silver
  const hookHighlight = 0xe8e8e8;
  const hookShadow = 0x808080;
  const hookSpacing = 18;
  const hookStartX = x + 12;

  for (let i = 0; i < 3; i++) {
    const hx = hookStartX + i * hookSpacing;
    const hy = y + 12;

    // Hook stem
    g.beginFill(hookColor);
    g.drawRect(hx, hy, 4, 16);
    g.endFill();

    // Hook curve (simplified pixel art)
    g.beginFill(hookColor);
    g.drawRect(hx - 4, hy + 16, 12, 4);
    g.drawRect(hx - 4, hy + 20, 4, 8);
    g.endFill();

    // Highlight
    g.beginFill(hookHighlight, 0.6);
    g.drawRect(hx, hy, 1, 16);
    g.endFill();

    // Shadow
    g.beginFill(hookShadow, 0.4);
    g.drawRect(hx + 3, hy, 1, 16);
    g.endFill();
  }

  // Hanging coat (on middle hook) - pixel art style
  const coatX = hookStartX + hookSpacing - 8;
  const coatY = y + 36;

  // Coat body (dark blue)
  g.beginFill(0x1e3a5f);
  g.drawRect(coatX, coatY, 20, 50);
  g.endFill();

  // Coat collar
  g.beginFill(0x2d4a6f);
  g.drawRect(coatX + 2, coatY, 16, 8);
  g.endFill();

  // Coat highlight
  g.beginFill(0x3d5a7f, 0.5);
  g.drawRect(coatX + 2, coatY + 10, 4, 30);
  g.endFill();

  // Coat buttons
  g.beginFill(0xd4af37);
  g.drawRect(coatX + 9, coatY + 16, 3, 3);
  g.drawRect(coatX + 9, coatY + 26, 3, 3);
  g.drawRect(coatX + 9, coatY + 36, 3, 3);
  g.endFill();

  // Hanging bag (on right hook)
  const bagX = hookStartX + hookSpacing * 2 - 6;
  const bagY = y + 32;

  // Bag strap
  g.beginFill(0x8b4513);
  g.drawRect(bagX + 6, bagY - 4, 3, 10);
  g.endFill();

  // Bag body
  g.beginFill(0xa0522d);
  g.drawRect(bagX, bagY + 6, 16, 24);
  g.endFill();

  // Bag flap
  g.beginFill(0x8b4513);
  g.drawRect(bagX, bagY + 6, 16, 8);
  g.endFill();

  // Bag buckle
  g.beginFill(0xd4af37);
  g.drawRect(bagX + 6, bagY + 12, 4, 3);
  g.endFill();
}

function drawLocker(g: any): void {
  const x = LOCKER_X;
  const y = LOCKER_Y;
  const w = LOCKER_WIDTH;
  const h = LOCKER_HEIGHT;
  const cellSize = LOCKER_CELL_SIZE;
  const cols = LOCKER_COLS;
  const rows = LOCKER_ROWS;

  // Shadow
  g.beginFill(0x000000, 0.18);
  g.drawRect(x + 3, y + 3, w, h);
  g.endFill();

  // Main locker body (metal gray frame)
  g.beginFill(0x4b5563);
  g.drawRect(x, y, w, h);
  g.endFill();

  // Draw each locker cell (2열 5행 = 10개)
  const cellPadding = 2;
  const innerCellSize = cellSize - cellPadding;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = x + 2 + col * cellSize;
      const cellY = y + 2 + row * cellSize;
      const cellNum = row * cols + col + 1; // 1~10

      // Cell background (lighter gray door)
      g.beginFill(0x9ca3af);
      g.drawRect(cellX, cellY, innerCellSize, innerCellSize);
      g.endFill();

      // Cell border
      g.lineStyle(1, 0x374151, 0.8);
      g.drawRect(cellX, cellY, innerCellSize, innerCellSize);
      g.lineStyle(0);

      // Vent slots (2 horizontal lines at top)
      g.beginFill(0x374151, 0.7);
      g.drawRect(cellX + 4, cellY + 3, innerCellSize - 8, 2);
      g.drawRect(cellX + 4, cellY + 6, innerCellSize - 8, 2);
      g.endFill();

      // Handle (small vertical bar on right side)
      g.beginFill(0x374151);
      g.drawRect(cellX + innerCellSize - 5, cellY + 10, 3, 6);
      g.endFill();
      // Handle highlight
      g.beginFill(0x6b7280, 0.6);
      g.drawRect(cellX + innerCellSize - 5, cellY + 10, 1, 6);
      g.endFill();

      // Number (1~10) - simple pixel text
      drawLockerNumber(g, cellX + 3, cellY + innerCellSize - 7, cellNum);
    }
  }

  // Top edge highlight
  g.beginFill(0xd1d5db, 0.5);
  g.drawRect(x, y, w, 2);
  g.endFill();
}

// 사물함 번호 그리기 (1~10 픽셀 텍스트)
function drawLockerNumber(g: any, x: number, y: number, num: number): void {
  const color = 0x1f2937;

  // 숫자별 픽셀 패턴 (5x5 그리드, 스케일 0.6)
  const patterns: Record<number, number[][]> = {
    1: [[0,1],[1,1],[0,1],[0,1],[0,1]],
    2: [[1,1],[0,1],[1,1],[1,0],[1,1]],
    3: [[1,1],[0,1],[1,1],[0,1],[1,1]],
    4: [[1,1],[1,1],[1,1],[0,1],[0,1]],
    5: [[1,1],[1,0],[1,1],[0,1],[1,1]],
    6: [[1,1],[1,0],[1,1],[1,1],[1,1]],
    7: [[1,1],[0,1],[0,1],[0,1],[0,1]],
    8: [[1,1],[1,1],[1,1],[1,1],[1,1]],
    9: [[1,1],[1,1],[1,1],[0,1],[1,1]],
    0: [[1,1],[1,1],[1,1],[1,1],[1,1]],
  };

  g.beginFill(color, 0.8);

  if (num < 10) {
    // 한 자리 숫자
    const pattern = patterns[num];
    for (let py = 0; py < pattern.length; py++) {
      for (let px = 0; px < pattern[py].length; px++) {
        if (pattern[py][px]) {
          g.drawRect(x + px * 2 + 4, y + py, 2, 1);
        }
      }
    }
  } else {
    // 10 (두 자리)
    const p1 = patterns[1];
    const p0 = patterns[0];
    // "1"
    for (let py = 0; py < p1.length; py++) {
      for (let px = 0; px < p1[py].length; px++) {
        if (p1[py][px]) {
          g.drawRect(x + px * 2, y + py, 2, 1);
        }
      }
    }
    // "0"
    for (let py = 0; py < p0.length; py++) {
      for (let px = 0; px < p0[py].length; px++) {
        if (p0[py][px]) {
          g.drawRect(x + px * 2 + 6, y + py, 2, 1);
        }
      }
    }
  }

  g.endFill();
}

