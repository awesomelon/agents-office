import { useEffect, useState } from "react";
import { useLogStore, useSettingsStore } from "../../store";
import { EVENT_LABELS } from "./Inbox";

export function Timeline() {
  const show = useSettingsStore((state) => state.showTimeline);
  const logs = useLogStore((state) => state.logs);
  const getEvents = useLogStore((state) => state.getTimelineEvents);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!show) return;
    const timer = setInterval(() => tick((value) => value + 1), 5000);
    return () => clearInterval(timer);
  }, [show]);
  if (!show) return null;
  const events = getEvents();
  return (
    <section
      id="activity-timeline"
      className="timeline"
      aria-label="Recent event timeline"
    >
      <span className="eyebrow">RECENT</span>
      <div className="timeline-events">
        {logs.length ? (
          events.map((event) => (
            <span
              className={`timeline-event event-${event.entry_type}`}
              key={event.id}
              title={`${EVENT_LABELS[event.entry_type]} · ${event.timestamp.toLocaleString()}`}
            >
              <span aria-hidden="true">●</span>
              {event.displayText}
              <time>
                {event.relativeTime === "now" ||
                event.relativeTime === "unknown time"
                  ? event.relativeTime
                  : `${event.relativeTime} ago`}
              </time>
            </span>
          ))
        ) : (
          <p className="muted">Your latest observations will appear here.</p>
        )}
      </div>
    </section>
  );
}
