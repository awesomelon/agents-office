import { beforeEach, describe, expect, it } from "vitest";
import { useAgentStore, useLogStore } from "../../src/store";
import { deskForEntry } from "../../src/config/toolMapping";
import { mergeLogs } from "../../src/store/logStore";
import {
  processObservedBatch,
  resetObserverActivity,
} from "../../src/services/observerState";
import type { Agent, LogEntry } from "../../src/types";

const log = (override: Partial<LogEntry> = {}): LogEntry => ({
  id: "event-1",
  timestamp: new Date().toISOString(),
  entry_type: "tool_call",
  content: "Metadata only",
  agent_id: "real-session-uuid",
  session_id: "real-session-uuid",
  tool_name: "exec_command",
  ...override,
});
const agent = (override: Partial<Agent> = {}): Agent => ({
  id: "developer",
  agent_type: "developer",
  status: "working",
  current_task: "Patch requested",
  desk_position: [1, 2],
  ...override,
});

beforeEach(resetObserverActivity);
describe("Codex event identity and role isolation", () => {
  it("uses authoritative classified role for redacted shell events", () => {
    expect(
      deskForEntry(log({ agent_type: "validator", content: "Command hidden" })),
    ).toBe("validator");
  });
  it("never maps session IDs to desks, including IDs that happen to equal a role", () => {
    expect(
      deskForEntry(log({ agent_id: "developer", tool_name: null })),
    ).toBeNull();
    expect(deskForEntry(log({ tool_name: "unknown_future_tool" }))).toBeNull();
    processObservedBatch(
      [log({ agent_type: "developer" })],
      [agent({ id: "real-session-uuid" })],
    );
    expect(useAgentStore.getState().agents).toEqual({});
    expect(useAgentStore.getState().effects[0]?.agentId).toBe("developer");
  });
  it("does not animate transfers between unrelated sessions", () => {
    processObservedBatch(
      [
        log({ agent_type: "explorer" }),
        log({
          id: "event-2",
          session_id: "different-session",
          agent_type: "developer",
        }),
      ],
      [],
    );
    expect(useAgentStore.getState().documentTransfers).toHaveLength(0);
    processObservedBatch([log({ id: "event-3", agent_type: "developer" })], []);
    expect(useAgentStore.getState().documentTransfers).toHaveLength(1);
  });
  it("retains the most recently observed thread identity after a turn finishes", () => {
    processObservedBatch([log()], [agent()]);
    processObservedBatch(
      [
        log({
          id: "event-2",
          session_id: "other",
          entry_type: "task_complete",
          tool_name: null,
        }),
      ],
      [],
    );
    expect(useLogStore.getState().sessionId).toBe("other");
  });
  it("deduplicates recent logs and preserves separate calls sharing a timestamp", () => {
    const first = log();
    const second = log({ id: "event-2", call_id: "other" });
    expect(mergeLogs([first], [first, second], 500)).toEqual([second, first]);
    processObservedBatch([first, first], [agent()]);
    expect(useLogStore.getState().logs).toHaveLength(1);
  });
  it("clears all visual artifacts when replay is reset", () => {
    processObservedBatch([log({ agent_type: "developer" })], [agent()]);
    expect(useAgentStore.getState().effects.length).toBeGreaterThan(0);
    resetObserverActivity();
    expect(useAgentStore.getState().effects).toEqual([]);
    expect(useAgentStore.getState().agents).toEqual({});
    expect(useLogStore.getState().logs).toEqual([]);
  });
});
