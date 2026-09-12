import type { AgentType, AgentStatus } from "../../types";

/** Percent coordinates on the uncropped 1536 × 1024 studio illustration.
 * These are visual zones, independent of the observer's desk coordinates. */
export const STUDIO_ZONES: {
  id: AgentType;
  label: string;
  place: string;
  purpose: string;
  x: number;
  y: number;
}[] = [
  {
    id: "explorer",
    label: "Explorer",
    place: "Discovery desk",
    purpose: "Finding files, searching code, and reading the workspace.",
    x: 37.5,
    y: 32,
  },
  {
    id: "analyzer",
    label: "Analyzer",
    place: "Research desk",
    purpose: "Making sense of evidence and inspecting the details.",
    x: 64.5,
    y: 36,
  },
  {
    id: "architect",
    label: "Architect",
    place: "Planning desk",
    purpose: "Organizing the approach and updating the plan.",
    x: 34.5,
    y: 44,
  },
  {
    id: "developer",
    label: "Developer",
    place: "Build desk",
    purpose: "Writing code and applying changes to the project.",
    x: 63,
    y: 49,
  },
  {
    id: "operator",
    label: "Operator",
    place: "Operations desk",
    purpose: "Running commands and supporting the development workflow.",
    x: 31.5,
    y: 58,
  },
  {
    id: "validator",
    label: "Validator",
    place: "Verification desk",
    purpose: "Checking changes, running tests, and inspecting failures.",
    x: 61.5,
    y: 63,
  },
  {
    id: "connector",
    label: "Connector",
    place: "Resource library",
    purpose: "Connecting tools and resources across the workflow.",
    x: 86.5,
    y: 44,
  },
  {
    id: "liaison",
    label: "Liaison",
    place: "Conversation lounge",
    purpose: "Exchanging updates and communicating results.",
    x: 80.5,
    y: 29,
  },
];

export const STUDIO_STATUS: Record<AgentStatus, string> = {
  idle: "Idle",
  working: "Working",
  thinking: "Thinking",
  passing: "Passing",
  error: "Error",
};
