// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStudioMaintenance } from "../../src/components/office/useStudioMaintenance";
import { useAgentStore } from "../../src/store";
import type { DocumentTransfer, VisualEffect } from "../../src/store";

let visibility: DocumentVisibilityState;

function transfer(id: string, ageMs: number): DocumentTransfer {
  return {
    id,
    fromAgentId: "developer",
    toAgentId: "validator",
    toolName: "exec_command",
    startedAt: performance.now() - ageMs,
  };
}

function effect(id: string, ageMs: number): VisualEffect {
  return {
    id,
    agentId: "developer",
    kind: "typeParticles",
    color: 0xffffff,
    seed: 1,
    startedAt: performance.now() - ageMs,
    durationMs: 800,
  };
}

function setVisibility(next: DocumentVisibilityState): void {
  visibility = next;
  act(() => document.dispatchEvent(new Event("visibilitychange")));
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "Date",
      "performance",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
    ],
  });
  vi.setSystemTime(new Date("2026-09-12T12:00:00.000Z"));
  vi.advanceTimersByTime(10000);
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility,
  );
  useAgentStore.getState().initializeAgents();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("studio maintenance", () => {
  it("immediately expires only stale visual details and preserves activity with reduced motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    useAgentStore.setState({
      agents: {
        developer: {
          id: "developer",
          agent_type: "developer",
          status: "working",
          current_task: "Expired task",
          desk_position: [60, 320],
        },
        validator: {
          id: "validator",
          agent_type: "validator",
          status: "thinking",
          current_task: "Recent task",
          desk_position: [240, 320],
        },
      },
      lastTaskUpdateById: {
        developer: Date.now() - 6000,
        validator: Date.now() - 100,
      },
      errorById: { developer: true },
      documentTransfers: [
        transfer("stale", 3001),
        transfer("recent", 2999),
        transfer("future", -500),
      ],
      effects: [
        effect("stale", 801),
        effect("recent", 799),
        effect("future", -500),
      ],
    });

    renderHook(useStudioMaintenance);

    const state = useAgentStore.getState();
    expect(state.agents.developer).toMatchObject({
      status: "working",
      current_task: null,
    });
    expect(state.agents.validator).toMatchObject({
      status: "thinking",
      current_task: "Recent task",
    });
    expect(state.errorById.developer).toBe(true);
    expect(state.documentTransfers.map(({ id }) => id)).toEqual([
      "recent",
      "future",
    ]);
    expect(state.effects.map(({ id }) => id)).toEqual(["recent", "future"]);
  });

  it("checks new store entries every second without requiring a component rerender", () => {
    renderHook(useStudioMaintenance);
    useAgentStore.setState({ documentTransfers: [transfer("new", 0)] });

    act(() => vi.advanceTimersByTime(2999));
    expect(useAgentStore.getState().documentTransfers).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(useAgentStore.getState().documentTransfers).toHaveLength(0);
  });

  it("does no background cleanup, then immediately catches up when the tab becomes visible", () => {
    visibility = "hidden";
    useAgentStore.setState({
      documentTransfers: [transfer("old", 5000)],
      effects: [effect("old", 1000)],
    });
    renderHook(useStudioMaintenance);
    act(() => vi.advanceTimersByTime(5000));
    expect(useAgentStore.getState().documentTransfers).toHaveLength(1);
    expect(useAgentStore.getState().effects).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);

    setVisibility("visible");
    expect(useAgentStore.getState().documentTransfers).toHaveLength(0);
    expect(useAgentStore.getState().effects).toHaveLength(0);

    useAgentStore.setState({
      documentTransfers: [transfer("while-hidden", 0)],
    });
    setVisibility("hidden");
    act(() => vi.advanceTimersByTime(5000));
    expect(useAgentStore.getState().documentTransfers).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    setVisibility("visible");
    expect(useAgentStore.getState().documentTransfers).toHaveLength(0);
  });

  it("removes its timer and visibility listener on unmount", () => {
    const { unmount } = renderHook(useStudioMaintenance);
    unmount();
    useAgentStore.setState({
      documentTransfers: [transfer("after-unmount", 5000)],
    });
    setVisibility("hidden");
    setVisibility("visible");
    act(() => vi.advanceTimersByTime(5000));
    expect(useAgentStore.getState().documentTransfers).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
