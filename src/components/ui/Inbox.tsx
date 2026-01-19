import { useLogStore, useSettingsStore } from "../../store";
import type { LogEntry, LogEntryType } from "../../types";

const TYPE_COLORS: Record<LogEntryType, string> = {
  tool_call: "text-blue-400",
  tool_result: "text-green-400",
  message: "text-gray-300",
  error: "text-red-400",
  todo_update: "text-purple-400",
  session_start: "text-yellow-400",
  session_end: "text-yellow-400",
};

const TYPE_ICONS: Record<LogEntryType, string> = {
  tool_call: "->",
  tool_result: "<-",
  message: "...",
  error: "!!",
  todo_update: "[]",
  session_start: ">>",
  session_end: "<<",
};

function LogEntryItem({ entry }: { entry: LogEntry }) {
  const colorClass = TYPE_COLORS[entry.entry_type] || "text-gray-300";
  const icon = TYPE_ICONS[entry.entry_type] || "?";

  return (
    <div className="px-3 py-2 border-b border-office-wall/50 hover:bg-office-wall/20 transition-colors">
      <div className="flex items-center gap-2 text-xs">
        <span className={`font-mono ${colorClass}`}>{icon}</span>
        {entry.tool_name && (
          <span className="px-1.5 py-0.5 bg-office-wall rounded text-white">
            {entry.tool_name}
          </span>
        )}
        {entry.timestamp && (
          <span className="text-gray-500 ml-auto">
            {entry.timestamp.slice(11, 19)}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-400 truncate">{entry.content}</p>
    </div>
  );
}

export function Inbox() {
  const { logs, clearLogs } = useLogStore();
  const { showInbox } = useSettingsStore();

  if (!showInbox) {
    return null;
  }

  return (
    <aside className="w-80 bg-inbox-bg border-l border-office-wall flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-office-wall">
        <h2 className="text-xs font-pixel text-white">Inbox</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{logs.length} logs</span>
          <button
            onClick={clearLogs}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-xs">
            No logs yet...
          </div>
        ) : (
          logs.map((log, index) => <LogEntryItem key={index} entry={log} />)
        )}
      </div>
    </aside>
  );
}
