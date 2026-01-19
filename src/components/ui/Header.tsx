import { useLogStore, useSettingsStore } from "../../store";

export function Header() {
  const { watcherActive, sessionId } = useLogStore();
  const { showInbox, toggleInbox, showTimeline, toggleTimeline } = useSettingsStore();

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-office-wall/80 border-b-2 border-office-bg">
      <div className="flex items-center gap-6">
        <h1 className="text-sm font-pixel text-yellow-300 tracking-wider">
          <span className="text-yellow-400">✨</span>
          <span className="mx-2">AGENT OFFICE</span>
          <span className="text-yellow-400">✨</span>
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              watcherActive ? "bg-green-400 animate-pulse shadow-lg shadow-green-400/50" : "bg-gray-500"
            }`}
          />
          <span className="text-xs text-gray-300 font-pixel">
            {watcherActive ? "Watching" : "Idle"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {sessionId && (
          <span className="text-xs text-gray-400 truncate max-w-48 font-pixel">
            Session: {sessionId.slice(0, 8)}
          </span>
        )}

        <button
          onClick={toggleTimeline}
          className={`px-3 py-1.5 text-xs font-pixel rounded border transition-colors ${
            showTimeline
              ? "bg-blue-600/80 border-blue-500 text-white"
              : "bg-transparent border-gray-600 text-gray-400 hover:text-white hover:border-gray-400"
          }`}
        >
          {showTimeline ? "Hide Timeline" : "Show Timeline"}
        </button>

        <button
          onClick={toggleInbox}
          className={`px-3 py-1.5 text-xs font-pixel rounded border transition-colors ${
            showInbox
              ? "bg-yellow-600/80 border-yellow-500 text-white"
              : "bg-transparent border-gray-600 text-gray-400 hover:text-white hover:border-gray-400"
          }`}
        >
          {showInbox ? "Hide Inbox" : "Show Inbox"}
        </button>
      </div>
    </header>
  );
}
