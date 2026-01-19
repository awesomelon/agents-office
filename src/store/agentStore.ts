import { create } from "zustand";
import type { Agent, AgentStatus } from "../types";

export interface DocumentTransfer {
  fromAgentId: string;
  toAgentId: string;
  startedAt: number;
}

interface AgentState {
  agents: Record<string, Agent>;
  vacationById: Record<string, boolean>;
  documentTransfer: DocumentTransfer | null;
  lastActiveAgentId: string | null;
  lastTaskUpdateById: Record<string, number>; // timestamp when task was last updated
  initializeAgents: () => void;
  updateAgent: (agent: Agent) => void;
  setAgentStatus: (id: string, status: AgentStatus) => void;
  setAgentTask: (id: string, task: string | null) => void;
  setAgentVacation: (id: string, on: boolean) => void;
  startDocumentTransfer: (fromAgentId: string, toAgentId: string) => void;
  clearDocumentTransfer: () => void;
  setLastActiveAgent: (id: string) => void;
  resetAllToIdle: () => void;
  clearExpiredTasks: (timeoutMs: number) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: {},
  vacationById: {},
  documentTransfer: null,
  lastActiveAgentId: null,
  lastTaskUpdateById: {},

  initializeAgents: () => {
    // Keep empty by default. Agents will appear only when the backend emits an update.
    // (We still keep the function for compatibility.)
    set({ agents: {}, vacationById: {}, documentTransfer: null, lastActiveAgentId: null, lastTaskUpdateById: {} });
  },

  updateAgent: (agent) => {
    set((state) => {
      // If we haven't seen this agent before and it's idle, ignore it.
      // This prevents agents from appearing in the office until they start working.
      if (!state.agents[agent.id] && agent.status === "idle") {
        return state;
      }

      const now = Date.now();
      const taskChanged = state.agents[agent.id]?.current_task !== agent.current_task;

      return {
        agents: {
          ...state.agents,
          [agent.id]: agent,
        },
        lastTaskUpdateById: taskChanged && agent.current_task
          ? { ...state.lastTaskUpdateById, [agent.id]: now }
          : state.lastTaskUpdateById,
      };
    });
  },

  setAgentStatus: (id, status) => {
    set((state) => {
      const agent = state.agents[id];
      if (!agent) return state;
      return {
        agents: {
          ...state.agents,
          [id]: { ...agent, status },
        },
      };
    });
  },

  setAgentTask: (id, task) => {
    set((state) => {
      const agent = state.agents[id];
      if (!agent) return state;
      const now = Date.now();
      return {
        agents: {
          ...state.agents,
          [id]: { ...agent, current_task: task },
        },
        lastTaskUpdateById: task
          ? { ...state.lastTaskUpdateById, [id]: now }
          : state.lastTaskUpdateById,
      };
    });
  },

  setAgentVacation: (id, on) => {
    set((state) => ({
      vacationById: {
        ...state.vacationById,
        [id]: on,
      },
    }));
  },

  startDocumentTransfer: (fromAgentId, toAgentId) => {
    set({
      documentTransfer: {
        fromAgentId,
        toAgentId,
        startedAt: performance.now(),
      },
    });
  },

  clearDocumentTransfer: () => {
    set({ documentTransfer: null });
  },

  setLastActiveAgent: (id) => {
    set({ lastActiveAgentId: id });
  },

  resetAllToIdle: () => {
    set((state) => {
      const updatedAgents: Record<string, Agent> = {};
      for (const [id, agent] of Object.entries(state.agents)) {
        updatedAgents[id] = { ...agent, status: "idle", current_task: null };
      }
      return { agents: updatedAgents, lastTaskUpdateById: {} };
    });
  },

  clearExpiredTasks: (timeoutMs) => {
    set((state) => {
      const now = Date.now();
      let changed = false;
      const updatedAgents: Record<string, Agent> = { ...state.agents };
      const updatedLastTaskUpdate: Record<string, number> = { ...state.lastTaskUpdateById };

      for (const [id, lastUpdate] of Object.entries(state.lastTaskUpdateById)) {
        if (now - lastUpdate > timeoutMs) {
          const agent = state.agents[id];
          if (agent && agent.current_task) {
            updatedAgents[id] = { ...agent, current_task: null };
            delete updatedLastTaskUpdate[id];
            changed = true;
          }
        }
      }

      return changed
        ? { agents: updatedAgents, lastTaskUpdateById: updatedLastTaskUpdate }
        : state;
    });
  },
}));
