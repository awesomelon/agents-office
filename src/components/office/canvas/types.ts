export type ViewportRect = { x: number; y: number; width: number; height: number };

export type MotionPhase = "absent" | "entering" | "present" | "walking" | "returning";

export interface AgentMotion {
  phase: MotionPhase;
  startedAt: number;
  durationMs: number;
  from: { x: number; y: number; alpha: number };
  to: { x: number; y: number; alpha: number };
}

// Agent mood for expression rendering
export type AgentMood = "neutral" | "focused" | "stressed" | "blocked";

