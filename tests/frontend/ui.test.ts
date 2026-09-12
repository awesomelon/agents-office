// @vitest-environment jsdom
import { createElement } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObserverPanel } from "../../src/components/ui/ObserverPanel";
import { Inbox } from "../../src/components/ui/Inbox";
import { Header } from "../../src/components/ui/Header";
import { useLogStore, useSettingsStore } from "../../src/store";
import { resetObserverActivity } from "../../src/services/observerState";
import { isDesktop } from "../../src/services/tauriCommands";

vi.mock("../../src/services/tauriCommands", () => ({
  isDesktop: vi.fn(() => false),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.mocked(isDesktop).mockReturnValue(false);
  resetObserverActivity();
  useLogStore.setState({
    watcherPath: null,
    watcherActive: false,
    watcherState: "starting",
    watcherMessage: "Connecting",
    connectionError: null,
  });
  useSettingsStore.setState({
    showInbox: true,
    showTimeline: true,
    showOffice: true,
  });
});

describe("observer product flows", () => {
  it("labels browser events as synthetic and runs only after explicit controls", () => {
    vi.useFakeTimers();
    render(createElement(ObserverPanel));
    expect(screen.getByText(/Synthetic events only/)).toBeTruthy();
    act(() => vi.advanceTimersByTime(10000));
    expect(useLogStore.getState().logs).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Next event" }));
    expect(useLogStore.getState().logs).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Resume demo" }));
    act(() => vi.advanceTimersByTime(1400));
    expect(useLogStore.getState().logs).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Pause demo" }));
    act(() => vi.advanceTimersByTime(10000));
    expect(useLogStore.getState().logs).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(useLogStore.getState().logs).toHaveLength(0);
  });
  it("shows actual missing Codex directory and desktop errors with reconnect", () => {
    vi.mocked(isDesktop).mockReturnValue(true);
    useLogStore
      .getState()
      .setWatcherStatus({
        active: false,
        path: "/custom/codex/sessions",
        state: "missing",
        message: "Sessions directory does not exist",
        revision: 1,
      });
    useLogStore.getState().setConnectionError("IPC disconnected");
    render(createElement(ObserverPanel));
    expect(screen.getByText("/custom/codex/sessions")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("IPC disconnected");
    expect(screen.getByText(/local observer is disconnected/)).toBeTruthy();
    const previous = useLogStore.getState().reconnectKey;
    fireEvent.click(screen.getByRole("button", { name: "Reconnect observer" }));
    expect(useLogStore.getState().reconnectKey).toBe(previous + 1);
    expect(screen.queryByText(/Synthetic events only/)).toBeNull();
  });
  it("filters by search/type/session and exposes complete event details", () => {
    useLogStore.getState().addLogsBatch([
      {
        id: "a",
        timestamp: "2026-09-12T01:00:00Z",
        entry_type: "tool_call",
        content: "Patch requested · source code hidden",
        tool_name: "apply_patch",
        agent_id: "session-a",
        session_id: "session-a",
        call_id: "call-full-id",
        agent_type: "developer",
      },
      {
        id: "b",
        timestamp: "2026-09-12T01:00:01Z",
        entry_type: "error",
        content: "Verification failed",
        tool_name: "exec_command",
        agent_id: "session-b",
        session_id: "session-b",
        agent_type: "validator",
      },
    ]);
    render(createElement(Inbox));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search events" }), {
      target: { value: "call-full-id" },
    });
    expect(screen.getByText("apply_patch")).toBeTruthy();
    expect(screen.queryByText("exec_command")).toBeNull();
    expect(screen.getByText("call-full-id")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Event type" }), {
      target: { value: "error" },
    });
    expect(screen.queryByText("apply_patch")).toBeNull();
    expect(screen.getByText("exec_command")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Session" }), {
      target: { value: "session-a" },
    });
    expect(screen.getByText("No matching events")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByText("apply_patch")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear view" }));
    expect(screen.getByText("Ready when Codex is")).toBeTruthy();
  });
  it("exposes view toggles as native accessible controls", () => {
    render(createElement(Header));
    const inbox = screen.getByRole("button", { name: "Event inbox" });
    expect(inbox.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(inbox);
    expect(inbox.getAttribute("aria-expanded")).toBe("false");
    const animation = screen.getByRole("button", { name: "Animated office" });
    fireEvent.click(animation);
    expect(animation.getAttribute("aria-pressed")).toBe("false");
  });
});
