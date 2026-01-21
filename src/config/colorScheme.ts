/**
 * Centralized Color Scheme
 *
 * Single source of truth for all color definitions in the application.
 * Organized by domain for easy maintenance and potential theming.
 */
import type { AgentType, AgentStatus, LogEntryType } from "../types";

// =============================================================================
// Agent Colors (by type)
// =============================================================================

/** Primary color for each agent type (workflow-based) */
export const AGENT_COLORS: Record<AgentType, number> = {
  explorer: 0x3b82f6, // blue
  analyzer: 0x06b6d4, // cyan
  architect: 0xf472b6, // pink
  developer: 0x22c55e, // green
  operator: 0xfbbf24, // yellow
  validator: 0xf97316, // orange
  connector: 0x8b5cf6, // purple
  liaison: 0xec4899, // pink
};

/** Hair colors for pixel-art agent sprites (workflow-based) */
export const HAIR_COLORS: Record<AgentType, number> = {
  explorer: 0x4a3728, // Brown
  analyzer: 0x2a4a6a, // Dark blue
  architect: 0x8b2252, // Reddish
  developer: 0x2a5a2a, // Dark green
  operator: 0x8b6914, // Blonde
  validator: 0x8b4514, // Auburn
  connector: 0x5a2a6a, // Purple
  liaison: 0x6a2a5a, // Magenta
};

// =============================================================================
// Status Colors
// =============================================================================

/** Color for each agent status indicator */
export const STATUS_COLORS: Record<AgentStatus, number> = {
  idle: 0x6b7280, // gray
  working: 0x22c55e, // green
  thinking: 0x3b82f6, // blue
  passing: 0xa855f7, // purple
  error: 0xef4444, // red
};

/** Monitor screen background colors by status */
export const SCREEN_COLORS: Record<AgentStatus, number> = {
  idle: 0x1a2a3a,
  working: 0x0a2a1a,
  thinking: 0x1a1a3a,
  passing: 0x2a1a3a,
  error: 0x3a1a1a,
};

// =============================================================================
// Tool Colors (for effects and stamps)
// =============================================================================

export const TOOL_COLORS = {
  explore: 0x3b82f6, // blue - Explorer
  analyze: 0x06b6d4, // cyan - Analyzer
  architect: 0xf472b6, // pink - Architect
  develop: 0x22c55e, // green - Developer
  operate: 0xfbbf24, // yellow - Operator
  validate: 0xf97316, // orange - Validator
  connect: 0x8b5cf6, // purple - Connector
  liaison: 0xec4899, // pink - Liaison
  other: 0x6b7280, // gray
  error: 0xef4444, // red
} as const;

// =============================================================================
// Timeline Colors (CSS hex strings for React components)
// =============================================================================

export const TIMELINE_COLORS: Record<LogEntryType, string> = {
  tool_call: "#3b82f6", // blue
  tool_result: "#22c55e", // green
  error: "#ef4444", // red
  todo_update: "#a855f7", // purple
  message: "#6b7280", // gray
  session_start: "#facc15", // yellow
  session_end: "#facc15", // yellow
};

// =============================================================================
// Wall & Environment Colors
// =============================================================================

export const WALL_COLORS = {
  base: 0xe7d8bf, // beige base
  stripe: 0xd8c7ab, // stripe pattern
  trim: 0xc8b597, // trim/molding
  shadow: 0xb8a68a, // shadow areas
} as const;

export const FLOOR_COLORS = {
  tile: 0xf9fafb, // base tile
  grout: 0xe5e7eb, // grout between tiles
  border: 0xd1d5db, // tile border
  scratch: 0x94a3b8, // scratch marks
} as const;

// =============================================================================
// UI Element Colors
// =============================================================================

export const PARTITION_COLORS = {
  fill: 0xa3e635, // lime green
  border: 0x4d7c0f, // dark green border
} as const;

export const FURNITURE_COLORS = {
  desk: {
    surface: 0x8b5a2b, // wood brown
    highlight: 0xa0693e, // light brown
    edge: 0x654321, // dark brown
    legs: 0x654321, // dark brown
  },
  monitor: {
    frame: 0x2a2a2a, // dark gray
  },
  keyboard: {
    base: 0x3a3a3a, // dark gray
    keys: 0x4a4a4a, // slightly lighter
  },
  mug: {
    outer: 0xd4a574, // tan
    inner: 0xb8956a, // darker tan
  },
  notebook: {
    paper: 0xf5f5dc, // beige/cream
    lines: 0x87ceeb, // sky blue
  },
} as const;

// =============================================================================
// Skin & Body Colors
// =============================================================================

export const BODY_COLORS = {
  skin: 0xffd5b4, // peach skin tone
  pants: 0x3a3a5a, // dark blue-gray
  shoes: 0x2a2a3a, // darker
} as const;
