import { useEffect, useState, memo } from "react";
import { useLogStore, useSettingsStore } from "../../store";
import { TIMELINE_COLORS } from "../../types";
import type { TimelineEvent } from "../../types";

interface TimelineDotProps {
  event: TimelineEvent;
}

const TimelineDot = memo(function TimelineDot({ event }: TimelineDotProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const color = TIMELINE_COLORS[event.entry_type];

  return (
    <div
      className="relative flex-shrink-0 p-1 -m-1 cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="w-3 h-3 rounded-full transition-transform hover:scale-125"
        style={{ backgroundColor: color }}
      />

      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none">
          {/* Arrow pointing up toward the dot */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-700" />
          <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1 shadow-lg whitespace-nowrap">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-white font-pixel">
                {event.displayText}
              </span>
            </div>
            {event.agent_id && (
              <div className="text-[10px] text-gray-400 mt-0.5 font-pixel">
                {event.agent_id}
              </div>
            )}
            <div className="text-[10px] text-gray-500 mt-0.5 font-pixel">
              {event.relativeTime}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export function Timeline() {
  const { showTimeline } = useSettingsStore();
  const getTimelineEvents = useLogStore((state) => state.getTimelineEvents);
  const logs = useLogStore((state) => state.logs);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  // 5초마다 상대 시간 갱신
  useEffect(() => {
    const updateEvents = () => {
      setEvents(getTimelineEvents());
    };

    updateEvents();
    const interval = setInterval(updateEvents, 5000);

    return () => clearInterval(interval);
  }, [getTimelineEvents, logs]);

  if (!showTimeline) {
    return null;
  }

  return (
    <div className="h-10 bg-office-wall/60 border-b border-office-bg flex items-center px-4 gap-1 relative">
      <span className="text-[10px] text-gray-500 font-pixel mr-2 flex-shrink-0">
        Timeline
      </span>
      <div className="flex-1 flex items-center justify-end gap-2 overflow-visible">
        {events.length === 0 ? (
          <span className="text-[10px] text-gray-600 font-pixel">
            No events yet
          </span>
        ) : (
          events.map((event) => <TimelineDot key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}
