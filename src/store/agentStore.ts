import { create } from "zustand";
import type { Agent, AgentStatus } from "../types";

export interface DocumentTransfer {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  startedAt: number;
  toolName?: string | null;
}

const MAX_DOCUMENT_TRANSFERS = 8;
let documentTransferSeq = 0;

export interface BatchUpdateData {
  agentList: Agent[];
  vacations: Record<string, boolean>;
  errors: Record<string, boolean>;
  newDocumentTransfers: Array<{ from: string; to: string; toolName?: string | null }>;
  lastActiveId: string | null;
}

interface AgentState {
  agents: Record<string, Agent>;
  vacationById: Record<string, boolean>;
  errorById: Record<string, boolean>;
  documentTransfers: DocumentTransfer[];
  lastActiveAgentId: string | null;
  lastTaskUpdateById: Record<string, number>; // timestamp when task was last updated
  initializeAgents: () => void;
  updateAgent: (agent: Agent) => void;
  updateAgentsBatch: (agentList: Agent[]) => void;
  processBatchUpdate: (data: BatchUpdateData) => void;
  setAgentStatus: (id: string, status: AgentStatus) => void;
  setAgentTask: (id: string, task: string | null) => void;
  setAgentVacation: (id: string, on: boolean) => void;
  setAgentVacationsBatch: (vacations: Record<string, boolean>) => void;
  setAgentError: (id: string, hasError: boolean) => void;
  setAgentErrorsBatch: (errors: Record<string, boolean>) => void;
  startDocumentTransfer: (fromAgentId: string, toAgentId: string, toolName?: string | null) => void;
  removeDocumentTransfer: (id: string) => void;
  clearDocumentTransfers: () => void;
  setLastActiveAgent: (id: string) => void;
  resetAllToIdle: () => void;
  clearExpiredTasks: (timeoutMs: number) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: {},
  vacationById: {},
  errorById: {},
  documentTransfers: [],
  lastActiveAgentId: null,
  lastTaskUpdateById: {},

  initializeAgents: () => {
    // Keep empty by default. Agents will appear only when the backend emits an update.
    // (We still keep the function for compatibility.)
    set({ agents: {}, vacationById: {}, errorById: {}, documentTransfers: [], lastActiveAgentId: null, lastTaskUpdateById: {} });
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

  updateAgentsBatch: (agentList) => {
    if (agentList.length === 0) return;
    set((state) => {
      const now = Date.now();
      const newAgents = { ...state.agents };
      const newLastTaskUpdate = { ...state.lastTaskUpdateById };

      for (const agent of agentList) {
        // If we haven't seen this agent before and it's idle, skip it
        if (!newAgents[agent.id] && agent.status === "idle") {
          continue;
        }

        const taskChanged = newAgents[agent.id]?.current_task !== agent.current_task;
        newAgents[agent.id] = agent;

        if (taskChanged && agent.current_task) {
          newLastTaskUpdate[agent.id] = now;
        }
      }

      return {
        agents: newAgents,
        lastTaskUpdateById: newLastTaskUpdate,
      };
    });
  },

  processBatchUpdate: ({ agentList, vacations, errors, newDocumentTransfers, lastActiveId }) => {
    set((state) => {
      const now = Date.now();
      const startedAt = performance.now();
      const newAgents = { ...state.agents };
      const newLastTaskUpdate = { ...state.lastTaskUpdateById };

      for (const agent of agentList) {
        if (!newAgents[agent.id] && agent.status === "idle") {
          continue;
        }
        const taskChanged = newAgents[agent.id]?.current_task !== agent.current_task;
        newAgents[agent.id] = agent;
        if (taskChanged && agent.current_task) {
          newLastTaskUpdate[agent.id] = now;
        }
      }

      const newTransfers = newDocumentTransfers.map((t) => ({
        id: `${Date.now()}-${documentTransferSeq++}`,
        fromAgentId: t.from,
        toAgentId: t.to,
        startedAt,
        toolName: t.toolName ?? null,
      }));

      const hasVacationUpdates = Object.keys(vacations).length > 0;
      const hasErrorUpdates = Object.keys(errors).length > 0;
      const hasNewTransfers = newTransfers.length > 0;

      return {
        agents: newAgents,
        lastTaskUpdateById: newLastTaskUpdate,
        vacationById: hasVacationUpdates ? { ...state.vacationById, ...vacations } : state.vacationById,
        errorById: hasErrorUpdates ? { ...state.errorById, ...errors } : state.errorById,
        documentTransfers: hasNewTransfers
          ? [...state.documentTransfers, ...newTransfers].slice(-MAX_DOCUMENT_TRANSFERS)
          : state.documentTransfers,
        lastActiveAgentId: lastActiveId ?? state.lastActiveAgentId,
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

  setAgentVacationsBatch: (vacations) => {
    const entries = Object.entries(vacations);
    if (entries.length === 0) return;
    set((state) => ({ vacationById: { ...state.vacationById, ...vacations } }));
  },

  setAgentError: (id, hasError) => {
    set((state) => ({
      errorById: {
        ...state.errorById,
        [id]: hasError,
      },
    }));
  },

  setAgentErrorsBatch: (errors) => {
    const entries = Object.entries(errors);
    if (entries.length === 0) return;
    set((state) => ({ errorById: { ...state.errorById, ...errors } }));
  },

  startDocumentTransfer: (fromAgentId, toAgentId, toolName) => {
    const startedAt = performance.now();
    const id = `${Date.now()}-${documentTransferSeq++}`;
    set((state) => ({
      documentTransfers: [
        ...state.documentTransfers,
        { id, fromAgentId, toAgentId, startedAt, toolName: toolName ?? null },
      ].slice(-MAX_DOCUMENT_TRANSFERS),
    }));
  },

  removeDocumentTransfer: (id) => {
    set((state) => ({
      documentTransfers: state.documentTransfers.filter((t) => t.id !== id),
    }));
  },

  clearDocumentTransfers: () => {
    set({ documentTransfers: [] });
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
      return { agents: updatedAgents, lastTaskUpdateById: {}, errorById: {} };
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
