import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stopHudPruning, useHudStore } from "../../src/store/hudStore";
import type { LogEntry } from "../../src/types";

const NOW = Date.parse("2026-09-12T12:00:00.000Z");

function event(
  entry_type: LogEntry["entry_type"],
  offset: number,
  overrides: Partial<LogEntry> = {},
): LogEntry {
  return {
    entry_type,
    timestamp: new Date(NOW + offset).toISOString(),
    session_id: "session-a",
    call_id: "call-a",
    agent_id: "developer",
    tool_name: "exec_command",
    content: "tool event",
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  useHudStore.getState().reset();
});

afterEach(() => {
  stopHudPruning();
  vi.useRealTimers();
});

describe("Codex HUD metrics", () => {
  it("correlates concurrent sessions and reversed result delivery by session and call ID", () => {
    useHudStore
      .getState()
      .recordEventsBatch(
        [
          event("tool_call", -5000),
          event("tool_call", -3000, { session_id: "session-b" }),
          event("tool_result", -2000, { session_id: "session-b" }),
        ],
        1,
      );
    expect(useHudStore.getState().getMetrics().avgToolResponseMs).toBe(1000);
    useHudStore.getState().recordEventsBatch([event("tool_result", -1000)], 0);
    expect(useHudStore.getState().getMetrics()).toMatchObject({
      toolCallCount: 2,
      avgToolResponseMs: 2500,
      agentSwitchCount: 1,
    });
    expect(useHudStore.getState().pendingToolCalls.size).toBe(0);
  });

  it("uses original timestamps even if the result appears before its call in the same batch", () => {
    useHudStore
      .getState()
      .recordEventsBatch(
        [event("tool_result", -1000), event("tool_call", -4250)],
        0,
      );
    expect(useHudStore.getState().getMetrics().avgToolResponseMs).toBe(3250);
  });

  it("can correlate separately delivered result and call batches", () => {
    useHudStore.getState().recordEventsBatch([event("tool_result", -1000)], 0);
    expect(useHudStore.getState().getMetrics().avgToolResponseMs).toBeNull();
    useHudStore.getState().recordEventsBatch([event("tool_call", -4250)], 0);
    expect(useHudStore.getState().getMetrics().avgToolResponseMs).toBe(3250);
  });

  it("does not invent live counts or response times when replaying old history", () => {
    useHudStore
      .getState()
      .recordEventsBatch(
        [
          event("tool_call", -120000),
          event("tool_result", -90000),
          event("error", -80000),
        ],
        3,
      );
    expect(useHudStore.getState().getMetrics()).toEqual({
      toolCallCount: 0,
      avgToolResponseMs: null,
      errorCount: 0,
      agentSwitchCount: 0,
      rateLimitActive: false,
    });
  });

  it("counts long-running tools completed within the last minute after pruning", () => {
    useHudStore.getState().recordEventsBatch([event("tool_call", -120000)], 0);
    useHudStore.getState().pruneOldData();
    useHudStore.getState().recordEventsBatch([event("tool_result", -5000)], 0);
    expect(useHudStore.getState().getMetrics()).toMatchObject({
      toolCallCount: 0,
      avgToolResponseMs: 115000,
    });
  });

  it.each(["session_end", "turn_aborted"] as const)(
    "only clears pending tools for the session with %s",
    (entryType) => {
      useHudStore
        .getState()
        .recordEventsBatch(
          [
            event("tool_call", -5000),
            event("tool_call", -4000, { session_id: "session-b" }),
            event(entryType, -3000),
            event("tool_result", -1000, { session_id: "session-b" }),
          ],
          0,
        );
      expect(useHudStore.getState().getMetrics().avgToolResponseMs).toBe(3000);
      expect(useHudStore.getState().pendingToolCalls.size).toBe(0);
    },
  );

  it("never matches uncorrelated tools or substitutes the receive time for invalid timestamps", () => {
    useHudStore
      .getState()
      .recordEventsBatch(
        [
          event("tool_call", -4000, { call_id: undefined }),
          event("tool_result", -1000, { call_id: undefined }),
          event("tool_call", -4000, { session_id: undefined }),
          event("tool_result", -1000, { session_id: undefined }),
          event("tool_call", -4000, { timestamp: "invalid" }),
          event("tool_result", -1000),
        ],
        0,
      );
    expect(useHudStore.getState().getMetrics().avgToolResponseMs).toBeNull();
  });

  it("rejects a negative response duration instead of reporting zero", () => {
    useHudStore
      .getState()
      .recordEventsBatch(
        [event("tool_call", -1000), event("tool_result", -2000)],
        0,
      );
    expect(useHudStore.getState().getMetrics().avgToolResponseMs).toBeNull();
  });

  it("does not count the same transport event twice", () => {
    const entries = [
      event("tool_call", -4000, { id: "1" }),
      event("tool_result", -1000, { id: "2" }),
    ];
    useHudStore.getState().recordEventsBatch(entries, 1);
    useHudStore.getState().recordEventsBatch(entries, 1);
    expect(useHudStore.getState().getMetrics()).toMatchObject({
      toolCallCount: 1,
      avgToolResponseMs: 3000,
      agentSwitchCount: 1,
    });
    expect(useHudStore.getState().recentToolResponses).toHaveLength(1);
  });

  it("bounds retained data and expires metrics without waiting for the pruning timer", () => {
    useHudStore.getState().recordEventsBatch(
      Array.from({ length: 5000 }, (_, i) =>
        event("tool_call", -5000 + i, { call_id: `call-${i}`, id: `${i}` }),
      ),
      0,
    );
    expect(useHudStore.getState().recentEvents.length).toBeLessThanOrEqual(
      2000,
    );
    expect(useHudStore.getState().pendingToolCalls.size).toBeLessThanOrEqual(
      200,
    );
    expect(useHudStore.getState().seenEvents.size).toBeLessThanOrEqual(4000);
    vi.setSystemTime(NOW + 61000);
    expect(useHudStore.getState().getMetrics().toolCallCount).toBe(0);
    vi.setSystemTime(NOW + 16 * 60000);
    useHudStore.getState().pruneOldData();
    expect(useHudStore.getState().pendingToolCalls.size).toBe(0);
    expect(useHudStore.getState().seenEvents.size).toBe(0);
  });

  it("reset removes timing correlation and rate limit state between demo and live mode", () => {
    useHudStore.getState().recordEventsBatch([event("tool_call", -4000)], 2);
    useHudStore.getState().setRateLimitActive(true);
    useHudStore.getState().reset();
    useHudStore.getState().recordEventsBatch([event("tool_result", -1000)], 0);
    expect(useHudStore.getState().getMetrics()).toEqual({
      toolCallCount: 0,
      avgToolResponseMs: null,
      errorCount: 0,
      agentSwitchCount: 0,
      rateLimitActive: false,
    });
  });
});
