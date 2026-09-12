import { useLogStore, useSettingsStore } from "../../store";
import { isDesktop } from "../../services/tauriCommands";

export function Header() {
  const state = useLogStore();
  const settings = useSettingsStore();
  const desktop = isDesktop();
  const status = !desktop
    ? "Browser demo"
    : state.connectionError
      ? "Disconnected"
      : {
          starting: "Connecting",
          watching: "Watching locally",
          missing: "Waiting for Codex",
          error: "Observer issue",
          stopped: "Observer stopped",
        }[state.watcherState];
  return (
    <header className="app-header">
      <a className="skip-link" href="#main-content">
        Skip to activity
      </a>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          C
        </span>
        <div>
          <h1>Codex Office</h1>
          <p>A studio for your Codex activity.</p>
        </div>
      </div>
      <div className="header-actions" aria-label="Office views">
        <span
          className={`status-pill ${desktop && state.watcherActive && !state.connectionError ? "is-live" : ""}`}
        >
          <span aria-hidden="true" />
          {status}
        </span>
        <button
          type="button"
          className="quiet-button"
          onClick={settings.toggleTimeline}
          aria-pressed={settings.showTimeline}
          aria-controls="activity-timeline"
        >
          Timeline
        </button>
        <button
          type="button"
          className="quiet-button"
          onClick={settings.toggleOffice}
          aria-pressed={settings.showOffice}
          aria-controls="office-visual"
        >
          Animated office
        </button>
        <button
          type="button"
          className="quiet-button"
          onClick={settings.toggleInbox}
          aria-expanded={settings.showInbox}
          aria-controls="event-inbox"
        >
          Event inbox
        </button>
      </div>
    </header>
  );
}
