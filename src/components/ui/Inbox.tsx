import { useMemo, useState } from "react";
import { useLogStore, useSettingsStore } from "../../store";
import { logKey } from "../../store/logStore";
import { deskForEntry } from "../../config/toolMapping";
import type { LogEntry, LogEntryType } from "../../types";

export const EVENT_LABELS: Record<LogEntryType, string> = {
  tool_call: "Tool call",
  tool_result: "Tool result",
  message: "Message",
  error: "Error",
  todo_update: "Plan update",
  session_start: "Session opened",
  session_end: "Session ended",
  task_start: "Turn started",
  task_complete: "Turn completed",
  turn_aborted: "Turn interrupted",
};

export function filterEntries(
  logs: LogEntry[],
  query: string,
  type: string,
  session: string,
): LogEntry[] {
  const term = query.trim().toLowerCase();
  return logs.filter(
    (entry) =>
      (type === "all" || entry.entry_type === type) &&
      (session === "all" || (entry.session_id ?? entry.agent_id) === session) &&
      (!term ||
        [
          entry.content,
          entry.tool_name,
          entry.session_id,
          entry.agent_id,
          entry.call_id,
          deskForEntry(entry),
          EVENT_LABELS[entry.entry_type],
        ].some((value) => value?.toLowerCase().includes(term))),
  );
}

function LogEntryItem({ entry }: { entry: LogEntry }) {
  const timestamp = new Date(entry.timestamp);
  const role = deskForEntry(entry);
  return (
    <details
      className={`log-entry ${entry.entry_type === "error" ? "log-error" : ""}`}
    >
      <summary>
        <div className="log-meta">
          <span className={`event-type event-${entry.entry_type}`}>
            {EVENT_LABELS[entry.entry_type]}
          </span>
          <time dateTime={entry.timestamp}>
            {Number.isNaN(timestamp.getTime())
              ? "Unknown time"
              : timestamp.toLocaleTimeString([], { hour12: false })}
          </time>
        </div>
        <strong>{entry.tool_name ?? EVENT_LABELS[entry.entry_type]}</strong>
        <p className="log-preview">{entry.content}</p>
        <span className="details-hint">View event details</span>
      </summary>
      <div className="log-details">
        <p>{entry.content}</p>
        <dl>
          <dt>Observed at</dt>
          <dd>{entry.timestamp}</dd>
          <dt>Session</dt>
          <dd>{entry.session_id ?? entry.agent_id ?? "Not provided"}</dd>
          {entry.call_id && (
            <>
              <dt>Call ID</dt>
              <dd>{entry.call_id}</dd>
            </>
          )}
          {role && (
            <>
              <dt>Illustrative role</dt>
              <dd>{role}</dd>
            </>
          )}
        </dl>
      </div>
    </details>
  );
}

export function Inbox() {
  const { logs, clearLogs, maxLogs } = useLogStore();
  const showInbox = useSettingsStore((state) => state.showInbox);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [session, setSession] = useState("all");
  const sessions = useMemo(
    () =>
      Array.from(
        new Set(
          logs
            .map((entry) => entry.session_id ?? entry.agent_id)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [logs],
  );
  const visible = useMemo(
    () => filterEntries(logs, query, type, session),
    [logs, query, type, session],
  );
  if (!showInbox) return null;
  return (
    <aside className="inbox" id="event-inbox" aria-labelledby="inbox-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">OBSERVATIONS</span>
          <h2 id="inbox-title">Event inbox</h2>
        </div>
        <button
          className="quiet-button"
          onClick={clearLogs}
          disabled={!logs.length}
          title="Clear this view only; local Codex files are unchanged"
        >
          Clear view
        </button>
      </div>
      <div className="inbox-filters">
        <label htmlFor="event-search">Search events</label>
        <input
          id="event-search"
          type="search"
          placeholder="Tool, role, session, or summary"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="filter-row">
          <label>
            Event type
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="all">All event types</option>
              {Object.entries(EVENT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Session
            <select
              value={session}
              onChange={(event) => setSession(event.target.value)}
            >
              <option value="all">All sessions</option>
              {session !== "all" && !sessions.includes(session) && (
                <option value={session}>
                  {session.slice(0, 16)} (no events)
                </option>
              )}
              {sessions.map((id) => (
                <option key={id} value={id}>
                  {id.slice(0, 16)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted" role="status">
          {visible.length} shown · newest first · keeps {maxLogs} events
        </p>
      </div>
      <div className="inbox-events">
        {visible.length ? (
          visible.map((entry) => (
            <LogEntryItem key={logKey(entry)} entry={entry} />
          ))
        ) : (
          <div className="empty-inbox">
            <span aria-hidden="true">◎</span>
            <h3>
              {logs.length ? "No matching events" : "Ready when Codex is"}
            </h3>
            <p>
              {logs.length
                ? "Try another search or reset the filters."
                : "New tool activity and turn boundaries will appear here."}
            </p>
            {(query || type !== "all" || session !== "all") && (
              <button
                onClick={() => {
                  setQuery("");
                  setType("all");
                  setSession("all");
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>
      <p className="inbox-note">
        Metadata summaries only. Prompts, commands, source code, and tool output
        stay hidden.
      </p>
    </aside>
  );
}
