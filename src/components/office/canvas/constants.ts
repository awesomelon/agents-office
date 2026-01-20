// Shared constants for OfficeCanvas and its subcomponents.
// Keep values identical to the original `OfficeCanvas.tsx` to avoid visual/behavior regressions.
export const OFFICE_WIDTH = 550;
export const OFFICE_HEIGHT = 700;

// Top band / entrance configuration
export const WALL_HEIGHT = 70;
export const ENTRANCE_WIDTH = 156;
export const ENTRANCE_HEIGHT = 48;
export const ENTRANCE_TOP_Y = 10;
export const ENTRANCE_PADDING = 6;

export const SUNFLOWER_FRAME_GAP = 14;

// Wall (beige) palette
export const WALL_BEIGE_BASE = 0xe7d8bf;
export const WALL_BEIGE_STRIPE = 0xd8c7ab;
export const WALL_BEIGE_TRIM = 0xc8b597;
export const WALL_BEIGE_SHADOW = 0xb8a68a;

// Floor configuration (square tiles)
export const FLOOR_START_Y = WALL_HEIGHT;
export const TILE_SIZE = 24;
export const TILE_GAP = 1; // grout gap between tiles
export const TILE_GROUT_COLOR = 0xe5e7eb;
export const TILE_BASE_COLOR = 0xf9fafb;
export const TILE_VARIATION_DELTA = 10; // per-channel delta
export const TILE_BORDER_COLOR = 0xd1d5db;
export const TILE_SCRATCH_COLOR = 0x94a3b8;
export const TILE_SCRATCH_ALPHA = 0.35;
export const TILE_SCRATCH_DENSITY = 0.13; // chance per tile

// Bottom windows band (bottom-of-scene)
export const BOTTOM_WINDOW_BAND_HEIGHT = 78;
export const BOTTOM_WINDOW_BAND_MARGIN = 10;

// Animation timing
export const ANIMATION_INTERVAL_MS = 250;

// Entry motion
export const ENTRY_START_X = OFFICE_WIDTH / 2;
export const ENTRY_START_Y = -60;
export const ENTER_DURATION_MS = 700;

// Text limits
export const SPEECH_BUBBLE_MAX_CHARS = 45;
export const SPEECH_BUBBLE_TRUNCATE_AT = 42;

// Speech bubble auto-hide
export const SPEECH_BUBBLE_TIMEOUT_MS = 5000;
export const SPEECH_BUBBLE_CHECK_INTERVAL_MS = 1000;

// Vacation sign
export const VACATION_SIGN_WIDTH = 52;
export const VACATION_SIGN_HEIGHT = 18;
// Place it on the desk front (below the desktop edge, above the desk label).
export const DESK_VACATION_SIGN_X = 0;
export const DESK_VACATION_SIGN_Y = 34;

// Document transfer animation
export const DOCUMENT_TRANSFER_DURATION_MS = 600;
export const DOCUMENT_SIZE = 16;
export const DOCUMENT_ARC_HEIGHT = 60;

// Alert light animation
export const ALERT_LIGHT_BLINK_MS = 200;

// Queue indicator animation
export const QUEUE_DOT_BLINK_MS = 500;

// HUD bar
export const HUD_BAR_HEIGHT = 20;
export const SHOW_HUD = false;

// Walking motion
export const WALKING_SPEED_PX_PER_SEC = 35;
export const WALKING_PAUSE_MIN_MS = 2000;
export const WALKING_PAUSE_MAX_MS = 4000;
export const WALKING_ANIMATION_INTERVAL_MS = 180;

// Mood timing thresholds (ms)
export const MOOD_FOCUSED_THRESHOLD_MS = 2000;
export const MOOD_STRESSED_THRESHOLD_MS = 5000;

// Walkable areas (same band only - 파티션 관통 방지)
export const WALKABLE_BANDS = [
  { minY: 85, maxY: 115 }, // 파티션1 아래 ~ Section A 위
  { minY: 175, maxY: 280 }, // Section A ~ Section B 사이
  { minY: 360, maxY: 410 }, // Section B ~ 파티션2 사이
  { minY: 440, maxY: 490 }, // 파티션2 아래 ~ Section C 위
  { minY: 565, maxY: 670 }, // Section C 아래 ~ 바닥
] as const;
export const WALK_X_MIN = 30;
export const WALK_X_MAX = 520; // 캔버스 550 기준

// Partition
export const PARTITION_COLOR = 0xa3e635; // lime-ish
export const PARTITION_BORDER = 0x4d7c0f;

