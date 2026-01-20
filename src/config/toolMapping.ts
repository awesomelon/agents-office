/**
 * Unified Tool Configuration
 *
 * Single source of truth for tool-to-agent mapping and visual effects.
 * This file must be kept in sync with src-tauri/src/watcher/log_parser.rs
 *
 * @see CLAUDE.md Agent-Tool Mapping section for detailed documentation
 */
import type { EffectKind } from "../store";
import { TOOL_COLORS } from "../types";

// =============================================================================
// Types
// =============================================================================

export interface ToolConfig {
  agentId: string;
  effect: { kind: EffectKind; color: number };
}

// =============================================================================
// Tool Configuration
// =============================================================================

/**
 * Tool-to-agent mapping with associated visual effects.
 *
 * Mapping logic (must match Rust's determine_agent_type):
 * - Read → Reader (파란색)
 * - Glob/Grep/WebSearch/WebFetch → Searcher (하늘색)
 * - Write → Writer (초록색)
 * - Edit/NotebookEdit → Editor (진초록)
 * - Bash (일반) → Runner (노란색)
 * - Bash (git/test/npm/pnpm/yarn/cargo) → Tester (주황색) - handled specially
 * - TodoWrite/Task → Planner (분홍색)
 * - AskUserQuestion/Error → Support (보라색)
 */
export const TOOL_CONFIG: Record<string, ToolConfig> = {
  // Reader tools
  read: { agentId: "reader", effect: { kind: "typeParticles", color: TOOL_COLORS.read } },

  // Searcher tools
  glob: { agentId: "searcher", effect: { kind: "searchPulse", color: TOOL_COLORS.search } },
  grep: { agentId: "searcher", effect: { kind: "searchPulse", color: TOOL_COLORS.search } },
  websearch: { agentId: "searcher", effect: { kind: "searchPulse", color: TOOL_COLORS.search } },
  webfetch: { agentId: "searcher", effect: { kind: "searchPulse", color: TOOL_COLORS.search } },

  // Writer tools
  write: { agentId: "writer", effect: { kind: "typeParticles", color: TOOL_COLORS.write } },

  // Editor tools
  edit: { agentId: "editor", effect: { kind: "typeParticles", color: TOOL_COLORS.edit } },
  notebookedit: { agentId: "editor", effect: { kind: "typeParticles", color: TOOL_COLORS.edit } },
  editnotebook: { agentId: "editor", effect: { kind: "typeParticles", color: TOOL_COLORS.edit } },

  // Planner tools
  todowrite: { agentId: "planner", effect: { kind: "typeParticles", color: TOOL_COLORS.plan } },
  task: { agentId: "planner", effect: { kind: "typeParticles", color: TOOL_COLORS.plan } },

  // Support tools
  askuserquestion: { agentId: "support", effect: { kind: "typeParticles", color: TOOL_COLORS.support } },

  // Runner tools (Bash without tester keywords)
  bash: { agentId: "runner", effect: { kind: "runSpark", color: TOOL_COLORS.run } },
} as const;

/** Default effect for unknown tools */
export const DEFAULT_EFFECT: { kind: EffectKind; color: number } = {
  kind: "typeParticles",
  color: TOOL_COLORS.other,
};

/** Keywords that change Bash from Runner to Tester */
export const TESTER_KEYWORDS = ["git", "test", "npm", "pnpm", "yarn", "cargo"] as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get tool configuration by tool name.
 * Returns null for unknown tools.
 */
export function getToolConfig(toolName: string | null | undefined): ToolConfig | null {
  const tool = toolName?.trim()?.toLowerCase();
  if (!tool) return null;
  return TOOL_CONFIG[tool] ?? null;
}

/**
 * Get visual effect configuration for a tool.
 * Returns default effect for unknown tools.
 */
export function getEffectForTool(toolName: string | null | undefined): { kind: EffectKind; color: number } {
  const config = getToolConfig(toolName);
  return config?.effect ?? DEFAULT_EFFECT;
}

/**
 * Infer agent ID from tool name and content.
 * Handles special cases like Bash (Runner vs Tester).
 */
export function inferAgentIdFromTool(toolName: string | null | undefined, content: string): string | null {
  const tool = toolName?.trim()?.toLowerCase();
  if (!tool) return null;

  // Bash: context-dependent (Runner vs Tester)
  if (tool === "bash") {
    const lowerContent = content.toLowerCase();
    const isTesterCommand = TESTER_KEYWORDS.some((keyword) => lowerContent.includes(keyword));
    return isTesterCommand ? "tester" : "runner";
  }

  // Use standard config lookup
  const config = TOOL_CONFIG[tool];
  return config?.agentId ?? "editor"; // Default to editor for unknown tools
}

// =============================================================================
// Rate Limit Detection
// =============================================================================

/** Pattern for detecting rate limit messages */
const LIMIT_REACHED_PATTERN = /limit\s*reached|hit\s+your\s+limit|rate[_\s]*limit|429/i;

/**
 * Check if a message indicates rate limit has been reached.
 * Uses fast-path substring check before regex.
 */
export function isLimitReachedMessage(content: string): boolean {
  const lower = content.toLowerCase();
  // Fast path: quick substring check before regex
  if (!lower.includes("limit") && !lower.includes("429")) {
    return false;
  }
  return LIMIT_REACHED_PATTERN.test(content);
}

/**
 * Check if entry type represents tool activity.
 */
export function isToolActivity(entryType: string): boolean {
  return entryType === "tool_call" || entryType === "tool_result";
}
