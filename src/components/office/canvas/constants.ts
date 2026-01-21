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
export const WALK_X_MAX = 295; // 책상 오른쪽 끝 (240 + 45) + 여백

// Partition (horizontal dividers between desk sections)
export const PARTITION_COLOR = 0xa3e635;
export const PARTITION_BORDER = 0x4d7c0f;

// Right wall configuration
export const RIGHT_WALL_START_X = 500; // 오른쪽 벽 시작 위치
export const RIGHT_WALL_WIDTH = OFFICE_WIDTH - RIGHT_WALL_START_X; // 50px

// Coat hanger (옷걸이/행거)
export const COAT_HANGER_X = 420;
export const COAT_HANGER_Y = 80;
export const COAT_HANGER_WIDTH = 40;
export const COAT_HANGER_HEIGHT = 80;

// Locker (사물함) - 2열 5행 = 10개
export const LOCKER_X = 420;
export const LOCKER_Y = 180;
export const LOCKER_WIDTH = 52; // 전체 너비 (2열 × 24px + 여백)
export const LOCKER_HEIGHT = 130; // 전체 높이 (5행 × 24px + 여백)
export const LOCKER_CELL_SIZE = 24; // 각 사물함 칸 크기
export const LOCKER_COLS = 2; // 열 수
export const LOCKER_ROWS = 5; // 행 수

// =============================================================================
// Eye Blink Animation
// =============================================================================
export const BLINK_DURATION_MS = 150; // How long eyes stay closed
export const BLINK_MIN_INTERVAL_MS = 2000; // Minimum time between blinks
export const BLINK_MAX_INTERVAL_MS = 6000; // Maximum time between blinks

// =============================================================================
// Idle Animations
// =============================================================================
export const IDLE_ANIMATION_MIN_DELAY_MS = 4000;
export const IDLE_ANIMATION_MAX_DELAY_MS = 10000;

/** Duration in ms for each idle animation type */
export const IDLE_ANIMATION_DURATIONS = {
  coffee: 2000,
  stretch: 1500,
  lookAround: 2500,
  penTap: 1800,
  yawn: 1200,
} as const;

/** Probability weights for idle animation selection (should sum to ~1) */
export const IDLE_ANIMATION_WEIGHTS = {
  coffee: 0.25,
  stretch: 0.20,
  lookAround: 0.25,
  penTap: 0.20,
  yawn: 0.10,
} as const;

// =============================================================================
// Bezier Curve Walking
// =============================================================================
export const BEZIER_CURVE_STRENGTH = 0.25; // How curved the walking path is (0 = straight, 1 = very curved)
export const LEAN_MAX_ANGLE = 0.26; // Maximum body lean angle in radians (~15 degrees)

