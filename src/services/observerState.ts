import { useAgentStore, useLogStore, useHudStore } from "../store";
import {
  deskForEntry,
  getEffectForTool,
  isDeskId,
  isLimitReachedMessage,
} from "../config/toolMapping";
import { logKey } from "../store/logStore";
import type { Agent, AppEvent, LogEntry, ObserverSnapshot } from "../types";
import { TOOL_COLORS } from "../types";

const previousRoleBySession = new Map<string, string>();
const validAgents = (agents: Agent[]) =>
  agents.filter((agent) => isDeskId(agent.id) && agent.id === agent.agent_type);

export function resetObserverActivity(): void {
  previousRoleBySession.clear();
  useAgentStore.getState().initializeAgents();
  useHudStore.getState().reset();
  useLogStore.getState().replaceLogs([]);
  useLogStore.getState().setSessionId(null);
}

export function hydrateObserver(snapshot: ObserverSnapshot): void {
  resetObserverActivity();
  const logs = useLogStore.getState();
  logs.replaceLogs(snapshot.logs);
  logs.setSessionId(snapshot.session_id);
  logs.setWatcherStatus(snapshot.watcher);
  logs.setConnectionError(null);
  useAgentStore.getState().updateAgentsBatch(validAgents(snapshot.agents));
  for (const agent of validAgents(snapshot.agents))
    useAgentStore.getState().setAgentError(agent.id, agent.status === "error");
  useHudStore.getState().recordEventsBatch(snapshot.logs, 0);
}

/** All live and demo observations use the same state path. Raw session IDs never address desks. */
export function processObservedBatch(
  entries: LogEntry[],
  agents: Agent[],
): void {
  const known = new Set(useLogStore.getState().logs.map(logKey));
  const fresh = entries.filter((entry) => {
    const key = logKey(entry);
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
  const office = useAgentStore.getState();
  const logs = useLogStore.getState();
  let switches = 0;
  for (const entry of fresh) {
    const role = deskForEntry(entry);
    const session = entry.session_id ?? entry.agent_id;
    if (session) logs.setSessionId(session);
    if (
      session &&
      ["session_end", "task_complete", "turn_aborted"].includes(
        entry.entry_type,
      )
    ) {
      previousRoleBySession.delete(session);
    }
    if (!role) continue;
    if (entry.entry_type === "tool_call") {
      office.recordToolCall(role);
      office.setAgentError(role, false);
      office.setAgentVacation(role, false);
      const effect = getEffectForTool(entry.tool_name);
      office.enqueueEffect(role, effect.kind, effect.color);
      if (session) {
        const previous = previousRoleBySession.get(session);
        if (previous && previous !== role) {
          office.startDocumentTransfer(previous, role, entry.tool_name);
          switches++;
        }
        previousRoleBySession.delete(session);
        previousRoleBySession.set(session, role);
        if (previousRoleBySession.size > 500)
          previousRoleBySession.delete(
            previousRoleBySession.keys().next().value!,
          );
      }
      office.setLastActiveAgent(role);
    }
    if (entry.entry_type === "error") {
      office.recordError(role);
      office.setAgentError(role, true);
      office.enqueueEffect(role, "errorBurst", TOOL_COLORS.error);
      if (isLimitReachedMessage(entry.content)) {
        office.setAgentVacation(role, true);
        useHudStore.getState().setRateLimitActive(true);
      }
    } else if (entry.entry_type === "tool_call")
      useHudStore.getState().setRateLimitActive(false);
  }
  // Backend aggregates concurrent sessions before emitting the authoritative activity roles.
  office.updateAgentsBatch(validAgents(agents));
  for (const agent of validAgents(agents)) {
    office.setAgentError(agent.id, agent.status === "error");
    if (agent.status === "idle") office.setAgentVacation(agent.id, false);
  }
  logs.addLogsBatch(fresh);
  useHudStore.getState().recordEventsBatch(fresh, switches);
}

export function applyObserverEvent(event: AppEvent): void {
  const logs = useLogStore.getState();
  switch (event.type) {
    case "BatchUpdate":
      processObservedBatch(event.payload.logs, event.payload.agents);
      break;
    case "LogEntry":
      processObservedBatch([event.payload], []);
      break;
    case "AgentUpdate":
      useAgentStore.getState().updateAgentsBatch(validAgents([event.payload]));
      break;
    case "WatcherStatus":
      logs.setWatcherStatus(event.payload);
      break;
    case "SessionStart":
      logs.setSessionId(event.payload.session_id);
      break;
    case "SessionEnd":
      previousRoleBySession.delete(event.payload.session_id);
      logs.setSessionId(event.payload.session_id);
      break;
  }
}
