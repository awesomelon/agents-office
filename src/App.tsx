import { useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { OfficeStudio } from "./components/office/OfficeStudio";
import { Inbox } from "./components/ui/Inbox";
import { Header } from "./components/ui/Header";
import { Timeline } from "./components/ui/Timeline";
import { ObserverPanel } from "./components/ui/ObserverPanel";
import { useTauriEvents } from "./hooks/useTauriEvents";
import {
  startHudPruning,
  stopHudPruning,
  useAgentStore,
  useHudStore,
  useSettingsStore,
} from "./store";
import { DESK_CONFIGS } from "./types";

function ActivityRoles() {
  const agents = useAgentStore((state) => state.agents);
  return (
    <ul className="role-list" aria-label="Illustrative activity roles">
      {DESK_CONFIGS.map((desk) => (
        <li key={desk.id}>
          <span
            className={`role-dot role-${agents[desk.id]?.status ?? "idle"}`}
            aria-hidden="true"
          />
          <span>{desk.label}</span>
          <span className="role-status">
            {agents[desk.id]?.status ?? "idle"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Metrics() {
  const metrics = useHudStore(useShallow((state) => state.getMetrics()));
  return (
    <div
      className="metrics"
      aria-label="Observed activity in the last 60 seconds"
    >
      <span>
        <strong>{metrics.toolCallCount}</strong> tool calls
      </span>
      <span>
        <strong>{metrics.errorCount}</strong> errors
      </span>
      <span title="Matched by session and call ID, using timestamps in the session log">
        <strong>
          {metrics.avgToolResponseMs === null
            ? "—"
            : `${(metrics.avgToolResponseMs / 1000).toFixed(1)}s`}
        </strong>{" "}
        mean tool response
      </span>
      <span className="metric-window">Last 60 seconds</span>
    </div>
  );
}

function App() {
  useTauriEvents();
  useEffect(() => {
    startHudPruning();
    return stopHudPruning;
  }, []);
  const showOffice = useSettingsStore((state) => state.showOffice);
  const showInbox = useSettingsStore((state) => state.showInbox);
  return (
    <div className="app-shell">
      <Header />
      <ObserverPanel />
      <Timeline />
      <main
        id="main-content"
        className={`workspace ${showInbox ? "with-inbox" : ""}`}
      >
        <section className="office-section" aria-labelledby="office-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR WORKSPACE, IN VIEW</span>
              <h2 id="office-title">A little space for big ideas.</h2>
            </div>
            <span className="local-badge">Passive observer</span>
          </div>
          <Metrics />
          {showOffice ? (
            <div id="office-visual">
              <OfficeStudio />
            </div>
          ) : (
            <div className="office-caption">
              <p>
                Desks represent activity roles, not the number or identity of
                Codex agents. Status reflects observed activity.
              </p>
              <ActivityRoles />
            </div>
          )}
        </section>
        <Inbox />
      </main>
      <footer className="app-footer">
        <span>Codex Office</span>
        <p>
          Observes local session logs. It cannot start, stop, or direct Codex.
        </p>
      </footer>
    </div>
  );
}
export default App;
