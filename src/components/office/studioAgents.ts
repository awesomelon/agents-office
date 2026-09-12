import type { AgentType, AgentStatus } from "../../types";

export interface StudioAgentDesign {
  source: string;
  /** Foot anchor on the full, uncropped studio image, in percent. */
  x: number;
  y: number;
  /** Square sprite width relative to the studio image width. */
  width: number;
  appearance: string;
}

/** Each role has its own locally bundled 3D-rendered character, not a recolor. */
export const STUDIO_AGENTS: Record<AgentType, StudioAgentDesign> = {
  explorer: {
    source: "/assets/agents/explorer.webp",
    x: 48,
    y: 43,
    width: 11,
    appearance: "Blue chore jacket, satchel and folded map",
  },
  analyzer: {
    source: "/assets/agents/analyzer.webp",
    x: 73,
    y: 48,
    width: 11,
    appearance: "Teal cardigan, round glasses and tablet",
  },
  architect: {
    source: "/assets/agents/architect.webp",
    x: 45.5,
    y: 56.5,
    width: 11,
    appearance: "Rose overshirt, bob haircut and rolled blueprint",
  },
  developer: {
    source: "/assets/agents/developer.webp",
    x: 73,
    y: 61,
    width: 11,
    appearance: "Sage hoodie, headphones and laptop",
  },
  operator: {
    source: "/assets/agents/operator.webp",
    x: 43,
    y: 71,
    width: 11,
    appearance: "Ochre utility vest and tool case",
  },
  validator: {
    source: "/assets/agents/validator.webp",
    x: 72,
    y: 78.5,
    width: 11,
    appearance: "Terracotta cardigan, glasses and clipboard",
  },
  connector: {
    source: "/assets/agents/connector.webp",
    x: 84,
    y: 59,
    width: 10,
    appearance: "Lavender jacket, natural curls and cable",
  },
  liaison: {
    source: "/assets/agents/liaison.webp",
    x: 81.5,
    y: 41.5,
    width: 10,
    appearance: "Berry blazer, notebook and coffee",
  },
};

export type StudioAgentState = AgentStatus | "limited";

export function studioAgentState(
  status: AgentStatus,
  rateLimited: boolean,
): StudioAgentState {
  return rateLimited ? "limited" : status;
}
