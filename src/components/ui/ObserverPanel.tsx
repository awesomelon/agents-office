import { useLogStore } from "../../store";
import { isDesktop } from "../../services/tauriCommands";
import { useDemo } from "../../hooks/useDemo";

export function ObserverPanel() {
  const state = useLogStore();
  const demo = useDemo();
  if (!isDesktop())
    return (
      <section
        className="observer-panel demo-panel"
        aria-label="Browser demo controls"
      >
        <div>
          <span className="eyebrow">INTERACTIVE PREVIEW</span>
          <h2>A tiny office. A clear view of Codex.</h2>
          <p>
            Synthetic events only. The desktop app observes local Codex session
            logs; this browser cannot read them.
          </p>
        </div>
        <div className="demo-controls">
          <div className="button-row">
            <button
              className="primary-button"
              onClick={demo.toggle}
              disabled={demo.step === demo.total}
            >
              {demo.playing
                ? "Pause demo"
                : demo.step
                  ? "Resume demo"
                  : "Play demo"}
            </button>
            <button
              onClick={demo.next}
              disabled={demo.playing || demo.step === demo.total}
            >
              Next event
            </button>
            <button onClick={demo.reset} disabled={!demo.step && !demo.playing}>
              Reset
            </button>
          </div>
          <span className="muted" role="status">
            {demo.step === demo.total
              ? "Demo complete. Reset to replay."
              : `${demo.step} of ${demo.total} demo events`}
          </span>
        </div>
      </section>
    );
  const needsSetup = state.watcherState === "missing";
  const title = state.connectionError
    ? "The local observer is disconnected."
    : {
        starting: "Connecting to the local observer…",
        watching: "Observing Codex on this computer.",
        missing: "Start a Codex session to bring the office to life.",
        error: "The local observer needs attention.",
        stopped: "The local observer is stopped.",
      }[state.watcherState];
  return (
    <section
      className={`observer-panel ${state.connectionError || state.watcherState === "error" ? "observer-error" : ""}`}
      aria-label="Local observer status"
    >
      <div>
        <span className="eyebrow">LOCAL · READ ONLY</span>
        <h2>{title}</h2>
        <p role="status">{state.watcherMessage}</p>
        {state.connectionError && (
          <p className="error-text" role="alert">
            Could not connect: {state.connectionError}
          </p>
        )}
        {state.watcherPath && (
          <p className="watch-path">
            <span>Sessions directory</span>
            <code>{state.watcherPath}</code>
          </p>
        )}
        {(needsSetup || !state.logs.length) && (
          <p className="setup-hint">
            Open Codex CLI or the Codex app, then start a new turn. This
            observer follows new events after launch. A custom CODEX_HOME is
            supported; restart this app after changing it.
          </p>
        )}
      </div>
      {state.connectionError && (
        <button onClick={state.reconnect}>Reconnect observer</button>
      )}
    </section>
  );
}
