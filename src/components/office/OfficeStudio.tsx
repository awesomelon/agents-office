import {
  Component,
  lazy,
  Suspense,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useShallow } from "zustand/shallow";
import { useAgentStore, useLogStore, useSettingsStore } from "../../store";
import { deskForEntry } from "../../config/toolMapping";
import { isDesktop } from "../../services/tauriCommands";
import { logKey } from "../../store/logStore";
import { STUDIO_STATUS, STUDIO_ZONES } from "./studioLayout";
import { useAnimationPreferences } from "./canvas/hooks/useAnimationPreferences";
import { useStudioMaintenance } from "./useStudioMaintenance";
import type { AgentType } from "../../types";

const PixelOffice = lazy(() =>
  import("./OfficeCanvas").then((module) => ({ default: module.OfficeCanvas })),
);

class PixelBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="canvas-fallback">
        <h3>Pixel view is unavailable.</h3>
        <p>
          Choose Studio view to explore the office. All activity remains
          available below.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function OfficeStudio() {
  const { agents, errors, vacations, lastActive } = useAgentStore(
    useShallow((state) => ({
      agents: state.agents,
      errors: state.errorById,
      vacations: state.vacationById,
      lastActive: state.lastActiveAgentId,
    })),
  );
  const logs = useLogStore((state) => state.logs);
  const { officeView, setOfficeView, officeMotion, toggleOfficeMotion } =
    useSettingsStore();
  const [selected, setSelected] = useState<AgentType>("developer");
  const [follow, setFollow] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);
  const { reducedMotion, visible } = useAnimationPreferences();
  useStudioMaintenance();
  const latestRoleEntry = logs.find((entry) => deskForEntry(entry) !== null);
  const followRole =
    (latestRoleEntry && deskForEntry(latestRoleEntry)) ||
    lastActive ||
    STUDIO_ZONES.find(
      (zone) => agents[zone.id] && agents[zone.id].status !== "idle",
    )?.id ||
    selected;
  const activeZone =
    STUDIO_ZONES.find((zone) => zone.id === (follow ? followRole : selected)) ??
    STUDIO_ZONES[3];
  const statusFor = (id: AgentType) =>
    errors[id] ? "error" : (agents[id]?.status ?? "idle");
  const selectedStatus = statusFor(activeZone.id);
  const recent = logs
    .filter((entry) => deskForEntry(entry) === activeZone.id)
    .slice(0, 3);
  const activeCount = STUDIO_ZONES.filter((zone) =>
    ["working", "thinking", "passing"].includes(statusFor(zone.id)),
  ).length;
  const selectZone = (id: AgentType) => {
    setSelected(id);
    setFollow(false);
  };

  return (
    <div
      className="office-studio"
      data-motion={officeMotion && !reducedMotion && visible ? "on" : "off"}
    >
      <div className="studio-toolbar">
        <div
          className="studio-view-switch"
          role="group"
          aria-label="Office appearance"
        >
          <button
            type="button"
            aria-pressed={officeView === "studio"}
            onClick={() => setOfficeView("studio")}
          >
            Studio view
          </button>
          <button
            type="button"
            aria-pressed={officeView === "pixel"}
            onClick={() => setOfficeView("pixel")}
          >
            Pixel view
          </button>
        </div>
        <span className="studio-role-count">
          <strong>{activeCount}</strong> active{" "}
          {activeCount === 1 ? "role" : "roles"}
        </span>
        {officeView === "studio" && (
          <button
            type="button"
            className="studio-motion"
            aria-pressed={officeMotion && !reducedMotion}
            disabled={reducedMotion}
            onClick={toggleOfficeMotion}
          >
            {reducedMotion
              ? "Reduced motion"
              : `Motion ${officeMotion ? "on" : "off"}`}
          </button>
        )}
      </div>

      {officeView === "studio" ? (
        <div
          className="studio-scene"
          aria-label="Illustrated office with eight activity zones"
        >
          <div className="studio-scene-heading">
            <span>THE CODEX STUDIO</span>
            <span>{isDesktop() ? "LOCAL OBSERVATIONS" : "SYNTHETIC DEMO"}</span>
          </div>
          <div className="studio-artboard">
            {!imageFailed ? (
              <img
                src="/assets/codex-studio.webp"
                width="1536"
                height="1024"
                alt=""
                draggable={false}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="studio-image-fallback">
                <p>The studio illustration could not load.</p>
                <p>
                  Select an activity role below to inspect its latest events.
                </p>
              </div>
            )}
            {!imageFailed &&
              STUDIO_ZONES.map((zone, index) => {
                const status = statusFor(zone.id);
                return (
                  <button
                    key={zone.id}
                    type="button"
                    className={`studio-pin studio-status-${status} ${zone.id === activeZone.id ? "is-selected" : ""}`}
                    style={
                      { left: `${zone.x}%`, top: `${zone.y}%` } as CSSProperties
                    }
                    aria-label={`${zone.label}: ${STUDIO_STATUS[status]}${vacations[zone.id] ? ", rate limited" : ""}`}
                    aria-pressed={zone.id === activeZone.id}
                    aria-controls="studio-role-detail"
                    onClick={() => selectZone(zone.id)}
                  >
                    <span className="studio-pin-number" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="studio-pin-label" aria-hidden="true">
                      {zone.label}
                      <small>
                        {vacations[zone.id]
                          ? "Rate limited"
                          : STUDIO_STATUS[status]}
                      </small>
                    </span>
                  </button>
                );
              })}
            {!imageFailed &&
              STUDIO_ZONES.map((zone, index) => (
                <span
                  key={zone.id}
                  aria-hidden="true"
                  className={`studio-mobile-marker ${zone.id === activeZone.id ? "is-selected" : ""}`}
                  style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              ))}
          </div>
          <div className="studio-scene-footer">
            <span>Select a space or a role below to see its activity</span>
            <span>6 desks · library · lounge</span>
          </div>
        </div>
      ) : (
        <div className="canvas-wrap studio-pixel-view" aria-hidden="true">
          <PixelBoundary>
            <Suspense
              fallback={
                <div className="canvas-fallback">Opening pixel office…</div>
              }
            >
              <PixelOffice />
            </Suspense>
          </PixelBoundary>
        </div>
      )}

      <div
        className="studio-directory"
        role="group"
        aria-label="Activity roles"
      >
        {STUDIO_ZONES.map((zone, index) => (
          <button
            key={zone.id}
            type="button"
            className={`studio-role studio-status-${statusFor(zone.id)}`}
            aria-pressed={zone.id === activeZone.id}
            aria-controls="studio-role-detail"
            onClick={() => selectZone(zone.id)}
          >
            <span className="studio-role-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="studio-role-name">
              {zone.label}
              <small>
                <span className="studio-status-dot" aria-hidden="true" />
                {vacations[zone.id]
                  ? "Rate limited"
                  : STUDIO_STATUS[statusFor(zone.id)]}
              </small>
            </span>
          </button>
        ))}
      </div>

      <section
        id="studio-role-detail"
        className="studio-detail"
        aria-labelledby="studio-detail-title"
      >
        <div className="studio-detail-header">
          <div>
            <span className="eyebrow">{activeZone.place}</span>
            <h3 id="studio-detail-title">
              {activeZone.label}
              <span
                className={`studio-detail-status studio-status-${selectedStatus}`}
              >
                {STUDIO_STATUS[selectedStatus]}
              </span>
            </h3>
          </div>
          <button
            type="button"
            className="studio-follow"
            aria-pressed={follow}
            onClick={() => {
              setSelected(activeZone.id);
              setFollow((value) => !value);
            }}
          >
            Follow activity
          </button>
        </div>
        <p className="studio-purpose">{activeZone.purpose}</p>
        {vacations[activeZone.id] && (
          <p className="studio-rate-limit">
            A rate limit was observed for this role.
          </p>
        )}
        {recent.length ? (
          <ol
            className="studio-recent"
            aria-label={`Recent ${activeZone.label} events`}
          >
            {recent.map((entry) => (
              <li key={logKey(entry)}>
                <span
                  className={`studio-event-kind ${entry.entry_type === "error" ? "is-error" : ""}`}
                >
                  {entry.tool_name ?? entry.entry_type.replace(/_/g, " ")}
                </span>
                <p>{entry.content}</p>
                <time dateTime={entry.timestamp}>
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="studio-empty">
            No events observed for this role yet.{" "}
            {isDesktop()
              ? "Start a Codex turn to bring the office to life."
              : "Play the demo to see activity move through the studio."}
          </p>
        )}
      </section>
      <p className="studio-disclosure">
        Spaces illustrate workflow roles, not individual Codex agents. Status
        reflects observed logs; it does not prove a process is still running.
      </p>
    </div>
  );
}
