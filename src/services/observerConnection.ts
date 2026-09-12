import type { AppEvent, ObserverSnapshot } from "../types";

type Unlisten = () => void;
interface ConnectionOptions {
  listen: (handle: (event: AppEvent) => void) => Promise<Unlisten>;
  snapshot: () => Promise<ObserverSnapshot>;
  hydrate: (snapshot: ObserverSnapshot) => void;
  apply: (event: AppEvent) => void;
  onError: (message: string) => void;
}

/** Subscribe first, then hydrate atomically and replay only events beyond the snapshot. */
export function connectObserver(options: ConnectionOptions): Unlisten {
  let disposed = false;
  let ready = false;
  let revision = -1;
  let queued: AppEvent[] = [];
  let unlisten: Unlisten | undefined;
  const apply = (event: AppEvent) => {
    if (disposed || event.revision <= revision) return;
    options.apply(event);
    revision = event.revision;
  };
  const close = () => {
    disposed = true;
    queued = [];
    const cleanup = unlisten;
    unlisten = undefined;
    if (cleanup) {
      try {
        cleanup();
      } catch {
        /* The webview may already be destroyed. */
      }
    }
  };
  void (async () => {
    try {
      const cleanup = await options.listen((event) => {
        if (disposed) return;
        if (ready) apply(event);
        else if (queued.length < 2000) queued.push(event);
        else {
          options.onError(
            "Observer startup received too many events. Reconnect to refresh its state.",
          );
          close();
        }
      });
      if (disposed) {
        cleanup();
        return;
      }
      unlisten = cleanup;
      const snapshot = await options.snapshot();
      if (disposed) return;
      options.hydrate(snapshot);
      revision = snapshot.revision;
      queued.sort((a, b) => a.revision - b.revision).forEach(apply);
      queued = [];
      ready = true;
    } catch (error) {
      if (!disposed)
        options.onError(error instanceof Error ? error.message : String(error));
      close();
    }
  })();
  return close;
}
