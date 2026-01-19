import { create } from "zustand";
import type { Agent, AgentStatus, AgentType } from "../types";
import { DESK_CONFIGS } from "../types";

interface AgentState {
  agents: Record<string, Agent>;
  initializeAgents: () => void;
  updateAgent: (agent: Agent) => void;
  setAgentStatus: (id: string, status: AgentStatus) => void;
  setAgentTask: (id: string, task: string | null) => void;
  resetAllToIdle: () => void;
}

const createInitialAgent = (
  id: string,
  agentType: AgentType,
  position: [number, number]
): Agent => ({
  id,
  agent_type: agentType,
  status: "idle",
  current_task: null,
  desk_position: position,
});

export const useAgentStore = create<AgentState>((set) => ({
  agents: {},

  initializeAgents: () => {
    const agents: Record<string, Agent> = {};
    for (const config of DESK_CONFIGS) {
      agents[config.id] = createInitialAgent(
        config.id,
        config.agentType,
        config.position
      );
    }
    set({ agents });
  },

  updateAgent: (agent) => {
    set((state) => ({
      agents: {
        ...state.agents,
        [agent.id]: agent,
      },
    }));
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
