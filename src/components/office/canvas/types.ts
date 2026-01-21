export type ViewportRect = { x: number; y: number; width: number; height: number };

export type MotionPhase = "absent" | "entering" | "present" | "walking" | "returning";

export interface AgentMotion {
  phase: MotionPhase;
  startedAt: number;
  durationMs: number;
  from: { x: number; y: number; alpha: number };
  to: { x: number; y: number; alpha: number };
  /** Control point for Bezier curve path (walking/entering phases) */
  controlPoint?: { x: number; y: number };
}

// Agent mood for expression rendering
export type AgentMood = "neutral" | "focused" | "stressed" | "blocked";

// =============================================================================
// Idle Animation Types
// =============================================================================

/** Idle animation types that play when agent is idle at desk */
export type IdleAnimationType =
  | "none"
  | "coffee"       // Drinking coffee
  | "stretch"      // Stretching arms
  | "lookAround"   // Looking around the office
  | "penTap"       // Tapping pen on desk
  | "yawn";        // Yawning

/** Current idle animation state */
export interface IdleAnimationState {
  type: IdleAnimationType;
  startedAt: number;
  /** Animation progress 0-1 */
  progress: number;
}

// =============================================================================
// Eye Blink Types
// =============================================================================

/** Eye blink state for natural blinking animation */
export interface BlinkState {
  /** Is currently in a blink */
  isBlinking: boolean;
  /** When the current blink started */
  blinkStartedAt: number;
  /** When the next blink should occur */
  nextBlinkAt: number;
}

