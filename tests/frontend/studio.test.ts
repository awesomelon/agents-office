// @vitest-environment jsdom
import { createElement } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfficeStudio } from "../../src/components/office/OfficeStudio";
import { useAgentStore, useLogStore, useSettingsStore } from "../../src/store";
import { resetObserverActivity } from "../../src/services/observerState";

vi.mock("../../src/services/tauriCommands", () => ({ isDesktop: () => false }));
vi.mock("../../src/components/office/OfficeCanvas", () => ({
  OfficeCanvas: () => createElement("div", null, "Pixel renderer mounted"),
}));

let motionReduced = false;
beforeEach(() => {
  motionReduced = false;
  vi.stubGlobal("matchMedia", () => ({
    matches: motionReduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  resetObserverActivity();
  useSettingsStore.setState({ officeView: "studio", officeMotion: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function event(
  id: string,
  role: "developer" | "validator" | "liaison",
  content: string,
) {
  useLogStore
    .getState()
    .addLog({
      id,
      timestamp: "2026-09-12T00:00:00Z",
      entry_type: role === "validator" ? "error" : "message",
      content,
      agent_type: role,
      agent_id: "session-actual-id",
      session_id: "session-actual-id",
      tool_name: null,
    });
}

describe("studio activity exploration", () => {
  it("follows messages and errors, preserves a manual selection, and resumes following", () => {
    event("first", "developer", "Patch completed");
    useAgentStore.getState().setLastActiveAgent("developer");
    render(createElement(OfficeStudio));
    act(() => event("second", "validator", "Verification failed"));
    expect(screen.getByRole("heading", { name: /Validator/ })).toBeTruthy();
    expect(screen.getByText("Verification failed")).toBeTruthy();
    const directory = within(
      screen.getByRole("group", { name: "Activity roles" }),
    );
    fireEvent.click(directory.getByRole("button", { name: /Developer/ }));
    act(() => event("third", "liaison", "Update delivered"));
    expect(screen.getByRole("heading", { name: /Developer/ })).toBeTruthy();
    expect(screen.getByText("Patch completed")).toBeTruthy();
    expect(screen.queryByText("Update delivered")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Follow activity" }));
    expect(screen.getByRole("heading", { name: /Liaison/ })).toBeTruthy();
  });

  it("uses an active snapshot role when no role events or prior calls exist", () => {
    useAgentStore
      .getState()
      .updateAgent({
        id: "architect",
        agent_type: "architect",
        status: "thinking",
        desk_position: [0, 0],
        current_task: null,
      });
    render(createElement(OfficeStudio));
    expect(screen.getByRole("heading", { name: /Architect/ })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Architect: Thinking" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("keeps all eight roles keyboard-selectable when the illustration fails", async () => {
    const user = userEvent.setup();
    const { container } = render(createElement(OfficeStudio));
    fireEvent.error(container.querySelector("img")!);
    expect(
      screen.getByText("The studio illustration could not load."),
    ).toBeTruthy();
    const directory = within(
      screen.getByRole("group", { name: "Activity roles" }),
    );
    expect(directory.getAllByRole("button")).toHaveLength(8);
    const connector = directory.getByRole("button", { name: /Connector/ });
    connector.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: /Connector/ })).toBeTruthy();
  });

  it("switches between studio and the lazy pixel renderer without losing activity", async () => {
    event("persist", "developer", "Existing activity");
    render(createElement(OfficeStudio));
    fireEvent.click(screen.getByRole("button", { name: "Pixel view" }));
    expect(await screen.findByText("Pixel renderer mounted")).toBeTruthy();
    expect(screen.getByText("Existing activity")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Studio view" }));
    expect(screen.queryByText("Pixel renderer mounted")).toBeNull();
    expect(screen.getByText("Existing activity")).toBeTruthy();
  });

  it("disables motion for the system preference while retaining activity controls", () => {
    motionReduced = true;
    const { container } = render(createElement(OfficeStudio));
    expect(
      (
        screen.getByRole("button", {
          name: "Reduced motion",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      container.querySelector(".office-studio")?.getAttribute("data-motion"),
    ).toBe("off");
    expect(
      within(
        screen.getByRole("group", { name: "Activity roles" }),
      ).getAllByRole("button"),
    ).toHaveLength(8);
  });

  it("can pause motion without pausing incoming observations", () => {
    const { container } = render(createElement(OfficeStudio));
    fireEvent.click(screen.getByRole("button", { name: "Motion on" }));
    act(() => event("paused", "validator", "An observed failure"));
    expect(
      container.querySelector(".office-studio")?.getAttribute("data-motion"),
    ).toBe("off");
    expect(screen.getByText("An observed failure")).toBeTruthy();
  });
});
