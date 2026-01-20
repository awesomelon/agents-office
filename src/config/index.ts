/**
 * Configuration module exports
 */
export {
  // Tool configuration
  TOOL_CONFIG,
  DEFAULT_EFFECT,
  TESTER_KEYWORDS,
  getToolConfig,
  getEffectForTool,
  inferAgentIdFromTool,
  // Rate limit utilities
  isLimitReachedMessage,
  isToolActivity,
  // Types
  type ToolConfig,
} from "./toolMapping";

export {
  // Agent colors
  AGENT_COLORS,
  HAIR_COLORS,
  // Status colors
  STATUS_COLORS,
  SCREEN_COLORS,
  // Tool colors
  TOOL_COLORS,
  // Timeline colors
  TIMELINE_COLORS,
  // Environment colors
  WALL_COLORS,
  FLOOR_COLORS,
  // UI element colors
  PARTITION_COLORS,
  FURNITURE_COLORS,
  // Body colors
  BODY_COLORS,
} from "./colorScheme";
