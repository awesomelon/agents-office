import { create } from "zustand";
import type { Agent, AgentStatus } from "../types";

interface AgentState {
  agents: Record<string, Agent>;
  vacationById: Record<string, boolean>;
  initializeAgents: () => void;
  updateAgent: (agent: Agent) => void;
  setAgentStatus: (id: string, status: AgentStatus) => void;
  setAgentTask: (id: string, task: string | null) => void;
  setAgentVacation: (id: string, on: boolean) => void;
  resetAllToIdle: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: {},
  vacationById: {},

  initializeAgents: () => {
    // Keep empty by default. Agents will appear only when the backend emits an update.
    // (We still keep the function for compatibility.)
    set({ agents: {}, vacationById: {} });
  },

  updateAgent: (agent) => {
    set((state) => {
      // If we haven't seen this agent before and it's idle, ignore it.
      // This prevents agents from appearing in the office until they start working.
      if (!state.agents[agent.id] && agent.status === "idle") {
        return state;
      }

      return {
        agents: {
          ...state.agents,
          [agent.id]: agent,
        },
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
      return {
        agents: {
          ...state.agents,
          [id]: { ...agent, current_task: task },
        },
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

  resetAllToIdle: () => {
    set((state) => {
      const agents = { ...state.agents };
      for (const id in agents) {
        agents[id] = { ...agents[id], status: "idle", current_task: null };
      }
      return { agents };
    });
  },
}));
