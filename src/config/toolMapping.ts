/**
 * Unified Tool Configuration
 *
 * Single source of truth for tool-to-agent mapping and visual effects.
 * This file must be kept in sync with src-tauri/src/watcher/log_parser.rs
 *
 * @see CLAUDE.md Agent-Tool Mapping section for detailed documentation
 */
import type { EffectKind } from "../store";
import { TOOL_COLORS } from "./colorScheme";

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
 * Tool-to-agent mapping with associated visual effects (workflow-based).
 *
 * Mapping logic (must match Rust's determine_agent_type):
 * - Read/Glob → Explorer (파란색) - 파일 탐색
 * - Grep/WebSearch → Analyzer (cyan) - 내용 분석
 * - TodoWrite/Task → Architect (분홍색) - 계획 수립
 * - Write/Edit/NotebookEdit → Developer (초록색) - 코드 작성
 * - Bash (일반) → Operator (노란색) - 명령 실행
 * - Bash (test/git/jest/vitest/pytest) → Validator (주황색) - 테스트/검증
 * - WebFetch/MCP/Skill → Connector (보라색) - 외부 연동
 * - AskUserQuestion/Error → Liaison (핑크) - 사용자 소통
 */
export const TOOL_CONFIG: Record<string, ToolConfig> = {
  // Explorer tools - 파일 탐색
  read: { agentId: "explorer", effect: { kind: "searchPulse", color: TOOL_COLORS.explore } },
  glob: { agentId: "explorer", effect: { kind: "searchPulse", color: TOOL_COLORS.explore } },

  // Analyzer tools - 내용 분석
  grep: { agentId: "analyzer", effect: { kind: "searchPulse", color: TOOL_COLORS.analyze } },
  websearch: { agentId: "analyzer", effect: { kind: "searchPulse", color: TOOL_COLORS.analyze } },

  // Architect tools - 계획 수립
  todowrite: { agentId: "architect", effect: { kind: "typeParticles", color: TOOL_COLORS.architect } },
  task: { agentId: "architect", effect: { kind: "typeParticles", color: TOOL_COLORS.architect } },

  // Developer tools - 코드 작성
  write: { agentId: "developer", effect: { kind: "typeParticles", color: TOOL_COLORS.develop } },
  edit: { agentId: "developer", effect: { kind: "typeParticles", color: TOOL_COLORS.develop } },
  notebookedit: { agentId: "developer", effect: { kind: "typeParticles", color: TOOL_COLORS.develop } },

  // Operator tools - 명령 실행 (Bash without validator keywords)
  bash: { agentId: "operator", effect: { kind: "runSpark", color: TOOL_COLORS.operate } },

  // Connector tools - 외부 연동
  webfetch: { agentId: "connector", effect: { kind: "searchPulse", color: TOOL_COLORS.connect } },
  skill: { agentId: "connector", effect: { kind: "typeParticles", color: TOOL_COLORS.connect } },

  // Liaison tools - 사용자 소통
  askuserquestion: { agentId: "liaison", effect: { kind: "typeParticles", color: TOOL_COLORS.liaison } },
} as const;

/** Default effect for unknown tools */
export const DEFAULT_EFFECT: { kind: EffectKind; color: number } = {
  kind: "typeParticles",
  color: TOOL_COLORS.other,
};

/** Keywords that change Bash from Operator to Validator */
export const VALIDATOR_KEYWORDS = ["test", "git", "jest", "vitest", "pytest"] as const;

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
 * Handles special cases like Bash (Operator vs Validator) and MCP tools.
 */
export function inferAgentIdFromTool(toolName: string | null | undefined, content: string): string | null {
  const tool = toolName?.trim()?.toLowerCase();
  if (!tool) return null;

  // Bash: context-dependent (Operator vs Validator)
  if (tool === "bash") {
    const lowerContent = content.toLowerCase();
    const isValidatorCommand = VALIDATOR_KEYWORDS.some((keyword) => lowerContent.includes(keyword));
    return isValidatorCommand ? "validator" : "operator";
  }

  // MCP tools: route to Connector
  if (tool.startsWith("mcp__")) {
    return "connector";
  }

  // Use standard config lookup
  const config = TOOL_CONFIG[tool];
  return config?.agentId ?? "developer"; // Default to developer for unknown tools
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
