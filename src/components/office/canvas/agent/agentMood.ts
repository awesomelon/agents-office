/**
 * Agent mood computation utilities.
 * Extracted from AgentSprite.tsx for better testability.
 */
import type { AgentMood } from "../types";
import {
  MOOD_FOCUSED_THRESHOLD_MS,
  MOOD_STRESSED_THRESHOLD_MS,
} from "../constants";

/**
 * Compute agent mood based on various state factors.
 * Priority order: blocked > stressed > focused > neutral
 */
export function computeAgentMood(
  agentId: string,
  errorById: Record<string, boolean>,
  vacationById: Record<string, boolean>,
  lastToolCallAtById: Record<string, number>,
  lastErrorAtById: Record<string, number>,
  now: number
): AgentMood {
  // Priority 1: Blocked (rate limit)
  if (vacationById[agentId]) return "blocked";

  // Priority 2: Stressed (recent error)
  if (errorById[agentId]) return "stressed";
  const lastError = lastErrorAtById[agentId];
  if (lastError && now - lastError < MOOD_STRESSED_THRESHOLD_MS) return "stressed";

  // Priority 3: Focused (recent tool_call)
  const lastToolCall = lastToolCallAtById[agentId];
  if (lastToolCall && now - lastToolCall < MOOD_FOCUSED_THRESHOLD_MS) return "focused";

  return "neutral";
}
