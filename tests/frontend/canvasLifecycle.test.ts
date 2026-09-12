// @vitest-environment jsdom
import { createElement } from "react";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlyingDocument } from "../../src/components/office/canvas/document/FlyingDocument";
import { DOCUMENT_TRANSFER_DURATION_MS } from "../../src/components/office/canvas/constants";

// Run the real React lifecycle without requiring a GPU in unit tests.
vi.mock("@pixi/react", () => ({
  Container: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  Graphics: () => null,
  Text: ({ text }: { text: string }) => createElement("span", null, text),
}));
afterEach(cleanup);

const transfer = {
  id: "transfer-1",
  fromAgentId: "developer",
  toAgentId: "validator",
  startedAt: 0,
  toolName: "exec_command",
};

describe("document transfer lifecycle", () => {
  it("finishes a transfer without changing React hook order", () => {
    const onComplete = vi.fn();
    const props = {
      transfer,
      now: 0,
      stackDepth: 0,
      onComplete,
      reducedMotion: false,
    };
    const { rerender } = render(createElement(FlyingDocument, props));
    // A shell validation command keeps the role inferred by the observer.
    expect(screen.getByText("TEST")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
    rerender(
      createElement(FlyingDocument, {
        ...props,
        now: DOCUMENT_TRANSFER_DURATION_MS,
      }),
    );
    expect(screen.queryByText("TEST")).toBeNull();
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(transfer.id);
  });

  it("completes an in-flight transfer when reduced motion is enabled", () => {
    const onComplete = vi.fn();
    const props = {
      transfer,
      now: 100,
      stackDepth: 0,
      onComplete,
      reducedMotion: false,
    };
    const { rerender } = render(createElement(FlyingDocument, props));
    rerender(createElement(FlyingDocument, { ...props, reducedMotion: true }));
    expect(screen.queryByText("TEST")).toBeNull();
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(transfer.id);
  });
});
