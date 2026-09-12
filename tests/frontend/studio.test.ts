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
import { StudioAvatar } from "../../src/components/office/StudioAvatar";
import { STUDIO_AGENTS } from "../../src/components/office/studioAgents";
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
  useLogStore.getState().addLog({
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
  it("shows the eight distinct characters and selects a role from its scene character", async () => {
    const user = userEvent.setup();
    const { container } = render(createElement(OfficeStudio));
    const characters = container.querySelectorAll(".studio-character");
    expect(characters).toHaveLength(8);
    const sources = [...characters].map((character) =>
      character.querySelector("img")?.getAttribute("src"),
    );
    expect(new Set(sources).size).toBe(8);
    const target = screen.getByRole("button", { name: "Connector: Idle" });
    target.focus();
    await user.keyboard("{Enter}");
    act(() => event("later", "developer", "An incoming edit"));
    expect(target.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: /Connector/ })).toBeTruthy();
    expect(
      container.querySelector(".studio-detail-header img")?.getAttribute("src"),
    ).toBe(STUDIO_AGENTS.connector.source);
    const directory = screen.getByRole("group", { name: "Activity roles" });
    expect(directory.querySelectorAll("img")).toHaveLength(8);
  });

  it("updates the same character through observed work, error, rate limit and recovery", () => {
    const { container } = render(createElement(OfficeStudio));
    const character = container.querySelector('[data-role="developer"]')!;
    const image = character.querySelector("img");
    act(() =>
      useAgentStore.getState().updateAgent({
        id: "developer",
        agent_type: "developer",
        status: "working",
        desk_position: [0, 0],
        current_task: "Synthetic edit",
      }),
    );
    expect(character.getAttribute("data-state")).toBe("working");
    act(() => useAgentStore.getState().setAgentError("developer", true));
    expect(character.getAttribute("data-state")).toBe("error");
    expect(
      character.querySelector(".studio-character-badge")?.textContent,
    ).toBe("!");
    act(() => useAgentStore.getState().setAgentVacation("developer", true));
    expect(character.getAttribute("data-state")).toBe("limited");
    expect(
      screen.getByRole("button", { name: "Developer: Rate limited" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /Developer Rate limited/ }),
    ).toBeTruthy();
    act(() => {
      useAgentStore.getState().setAgentError("developer", false);
      useAgentStore.getState().setAgentVacation("developer", false);
      useAgentStore.getState().setAgentStatus("developer", "idle");
    });
    expect(character.getAttribute("data-state")).toBe("idle");
    expect(character.querySelector("img")).toBe(image);
  });

  it("keeps a character selectable after its asset fails", () => {
    const { container } = render(createElement(OfficeStudio));
    fireEvent.error(container.querySelector('[data-role="explorer"] img')!);
    fireEvent.click(screen.getByRole("button", { name: "Explorer: Idle" }));
    expect(screen.getByRole("heading", { name: /Explorer/ })).toBeTruthy();
    expect(
      container.querySelector('[data-role="explorer"] .studio-avatar-fallback')
        ?.textContent,
    ).toBe("EX");
  });

  it("tries the next portrait when a previously selected role's asset failed", () => {
    const { container, rerender } = render(
      createElement(StudioAvatar, { role: "developer", portrait: true }),
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    rerender(
      createElement(StudioAvatar, { role: "validator", portrait: true }),
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      STUDIO_AGENTS.validator.source,
    );
  });

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
    useAgentStore.getState().updateAgent({
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
