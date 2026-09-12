import { describe, expect, it, vi } from "vitest";
import { connectObserver } from "../../src/services/observerConnection";
import type { AppEvent, ObserverSnapshot } from "../../src/types";

const snapshot: ObserverSnapshot = {
  revision: 4,
  agents: [],
  logs: [],
  session_id: null,
  watcher: {
    active: true,
    path: "/home/test/.codex/sessions",
    state: "watching",
    message: "Watching",
    revision: 4,
  },
};
const event = (revision: number): AppEvent => ({
  revision,
  type: "WatcherStatus",
  payload: { ...snapshot.watcher, revision },
});
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("observer subscription lifecycle", () => {
  it("subscribes before snapshot, replays newer events in order and deduplicates revisions", async () => {
    let listener!: (event: AppEvent) => void;
    let resolveSnapshot!: (value: ObserverSnapshot) => void;
    const applied: string[] = [];
    const unlisten = vi.fn();
    const close = connectObserver({
      listen: async (handler) => {
        listener = handler;
        applied.push("listen");
        return unlisten;
      },
      snapshot: () => {
        applied.push("snapshot");
        return new Promise((resolve) => {
          resolveSnapshot = resolve;
        });
      },
      hydrate: () => applied.push("hydrate"),
      apply: (incoming) => applied.push(`event${incoming.revision}`),
      onError: vi.fn(),
    });
    await flush();
    listener(event(5));
    listener(event(3));
    listener(event(4));
    listener(event(6));
    resolveSnapshot(snapshot);
    await flush();
    listener(event(6));
    listener(event(7));
    expect(applied).toEqual([
      "listen",
      "snapshot",
      "hydrate",
      "event5",
      "event6",
      "event7",
    ]);
    close();
    close();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("cleans a late-resolving listener after unmount without requesting a snapshot", async () => {
    let resolveListen!: (value: () => void) => void;
    const unlisten = vi.fn();
    const getSnapshot = vi.fn();
    const close = connectObserver({
      listen: () =>
        new Promise((resolve) => {
          resolveListen = resolve;
        }),
      snapshot: getSnapshot,
      hydrate: vi.fn(),
      apply: vi.fn(),
      onError: vi.fn(),
    });
    close();
    resolveListen(unlisten);
    await flush();
    expect(unlisten).toHaveBeenCalledOnce();
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it("reports listener rejection without an unhandled promise", async () => {
    const onError = vi.fn();
    connectObserver({
      listen: async () => {
        throw new Error("Listener unavailable");
      },
      snapshot: vi.fn(),
      hydrate: vi.fn(),
      apply: vi.fn(),
      onError,
    });
    await flush();
    expect(onError).toHaveBeenCalledWith("Listener unavailable");
  });

  it("releases the listener when initial snapshot fails", async () => {
    const unlisten = vi.fn();
    const onError = vi.fn();
    const apply = vi.fn();
    let listener!: (event: AppEvent) => void;
    connectObserver({
      listen: async (handle) => {
        listener = handle;
        return unlisten;
      },
      snapshot: async () => {
        throw "Snapshot failed";
      },
      hydrate: vi.fn(),
      apply,
      onError,
    });
    await flush();
    listener(event(9));
    expect(unlisten).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("Snapshot failed");
    expect(apply).not.toHaveBeenCalled();
  });

  it("does not hydrate a snapshot that resolves after disposal", async () => {
    let resolveSnapshot!: (value: ObserverSnapshot) => void;
    const hydrate = vi.fn();
    const unlisten = vi.fn();
    const close = connectObserver({
      listen: async () => unlisten,
      snapshot: () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve;
        }),
      hydrate,
      apply: vi.fn(),
      onError: vi.fn(),
    });
    await flush();
    close();
    resolveSnapshot(snapshot);
    await flush();
    expect(hydrate).not.toHaveBeenCalled();
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
