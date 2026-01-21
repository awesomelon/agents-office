/**
 * Idle animation system for agents.
 * Provides natural behaviors when agents are idle at their desks.
 */
import type { IdleAnimationType, IdleAnimationState, BlinkState } from "../types";
import {
  BLINK_DURATION_MS,
  BLINK_MIN_INTERVAL_MS,
  BLINK_MAX_INTERVAL_MS,
  IDLE_ANIMATION_DURATIONS,
  IDLE_ANIMATION_WEIGHTS,
  IDLE_ANIMATION_MIN_DELAY_MS,
  IDLE_ANIMATION_MAX_DELAY_MS,
} from "../constants";

// =============================================================================
// Eye Blink System
// =============================================================================

/**
 * Create initial blink state for an agent.
 */
export function createBlinkState(now: number): BlinkState {
  return {
    isBlinking: false,
    blinkStartedAt: 0,
    nextBlinkAt: now + getRandomBlinkInterval(),
  };
}

/**
 * Get random interval between blinks.
 */
function getRandomBlinkInterval(): number {
  return BLINK_MIN_INTERVAL_MS + Math.random() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS);
}

/**
 * Update blink state based on current time.
 * Returns new state (immutable).
 */
export function updateBlinkState(state: BlinkState, now: number): BlinkState {
  // Currently blinking - check if blink should end
  if (state.isBlinking) {
    const blinkElapsed = now - state.blinkStartedAt;
    if (blinkElapsed >= BLINK_DURATION_MS) {
      return {
        isBlinking: false,
        blinkStartedAt: 0,
        nextBlinkAt: now + getRandomBlinkInterval(),
      };
    }
    return state;
  }

  // Not blinking - check if it's time to blink
  if (now >= state.nextBlinkAt) {
    return {
      isBlinking: true,
      blinkStartedAt: now,
      nextBlinkAt: 0, // Will be set when blink ends
    };
  }

  return state;
}

// =============================================================================
// Idle Animation System
// =============================================================================

// Active animation types (excludes "none") derived from weights constant
type ActiveIdleAnimationType = Exclude<IdleAnimationType, "none">;
const ACTIVE_ANIMATION_TYPES = Object.keys(IDLE_ANIMATION_WEIGHTS) as ActiveIdleAnimationType[];

/**
 * Create initial idle animation state.
 */
export function createIdleAnimationState(): IdleAnimationState {
  return {
    type: "none",
    startedAt: 0,
    progress: 0,
  };
}

/**
 * Pick a random idle animation based on weighted probabilities.
 */
function pickRandomIdleAnimation(): ActiveIdleAnimationType {
  const rand = Math.random();
  let cumulative = 0;

  for (const type of ACTIVE_ANIMATION_TYPES) {
    cumulative += IDLE_ANIMATION_WEIGHTS[type];
    if (rand < cumulative) {
      return type;
    }
  }

  return "lookAround"; // fallback
}

/**
 * Get random delay before next idle animation.
 */
function getRandomIdleDelay(): number {
  return IDLE_ANIMATION_MIN_DELAY_MS + Math.random() * (IDLE_ANIMATION_MAX_DELAY_MS - IDLE_ANIMATION_MIN_DELAY_MS);
}

export interface IdleAnimationController {
  state: IdleAnimationState;
  nextAnimationAt: number;
}

/** Create a controller reset to idle state with scheduled next animation. */
function createIdleReset(now: number): IdleAnimationController {
  return {
    state: createIdleAnimationState(),
    nextAnimationAt: now + getRandomIdleDelay(),
  };
}

/**
 * Create idle animation controller.
 */
export function createIdleController(now: number): IdleAnimationController {
  return createIdleReset(now);
}

/**
 * Update idle animation controller.
 * Only plays animations when agent is idle and present at desk.
 */
export function updateIdleController(
  controller: IdleAnimationController,
  now: number,
  isIdleAtDesk: boolean
): IdleAnimationController {
  const { state, nextAnimationAt } = controller;

  // If not idle at desk, reset to no animation
  if (!isIdleAtDesk) {
    return state.type === "none" ? controller : createIdleReset(now);
  }

  // Currently playing an animation
  if (state.type !== "none") {
    const duration = IDLE_ANIMATION_DURATIONS[state.type] ?? 2000;
    const progress = Math.min(1, (now - state.startedAt) / duration);

    if (progress >= 1) {
      return createIdleReset(now);
    }

    return { ...controller, state: { ...state, progress } };
  }

  // Check if it's time to start a new animation
  if (now >= nextAnimationAt) {
    const animType = pickRandomIdleAnimation();
    return {
      state: {
        type: animType,
        startedAt: now,
        progress: 0,
      },
      nextAnimationAt: 0,
    };
  }

  return controller;
}

// =============================================================================
// Idle Animation Drawing Modifiers
// =============================================================================

export interface IdleAnimationModifiers {
  /** Additional arm movement */
  armOffset: { left: number; right: number };
  /** Head tilt angle in radians */
  headTilt: number;
  /** Additional eye direction */
  eyeOffset: { x: number; y: number };
  /** Mouth shape modifier */
  mouthOpen: boolean;
}

/**
 * Get drawing modifiers based on current idle animation state.
 */
export function getIdleAnimationModifiers(state: IdleAnimationState): IdleAnimationModifiers {
  const defaultModifiers: IdleAnimationModifiers = {
    armOffset: { left: 0, right: 0 },
    headTilt: 0,
    eyeOffset: { x: 0, y: 0 },
    mouthOpen: false,
  };

  if (state.type === "none") return defaultModifiers;

  const t = state.progress;

  switch (state.type) {
    case "coffee": {
      // Arm raises to mouth, then lowers
      const armCurve = Math.sin(t * Math.PI);
      return {
        armOffset: { left: 0, right: -armCurve * 8 },
        headTilt: armCurve * 0.1,
        eyeOffset: { x: 0, y: armCurve * 0.5 },
        mouthOpen: t > 0.3 && t < 0.7,
      };
    }

    case "stretch": {
      // Both arms raise up
      const stretchCurve = Math.sin(t * Math.PI);
      return {
        armOffset: { left: -stretchCurve * 10, right: -stretchCurve * 10 },
        headTilt: stretchCurve * -0.15,
        eyeOffset: { x: 0, y: -stretchCurve },
        mouthOpen: t > 0.4 && t < 0.6,
      };
    }

    case "lookAround": {
      // Head turns side to side
      const lookCurve = Math.sin(t * Math.PI * 2);
      return {
        armOffset: { left: 0, right: 0 },
        headTilt: lookCurve * 0.12,
        eyeOffset: { x: lookCurve * 2, y: 0 },
        mouthOpen: false,
      };
    }

    case "penTap": {
      // Small arm movement, periodic
      const tapCurve = Math.sin(t * Math.PI * 6) * Math.sin(t * Math.PI);
      return {
        armOffset: { left: 0, right: tapCurve * 3 },
        headTilt: 0,
        eyeOffset: { x: 0, y: tapCurve * 0.5 },
        mouthOpen: false,
      };
    }

    case "yawn": {
      // Mouth opens wide, eyes close
      const yawnCurve = Math.sin(t * Math.PI);
      return {
        armOffset: { left: 0, right: 0 },
        headTilt: -yawnCurve * 0.1,
        eyeOffset: { x: 0, y: 0 },
        mouthOpen: yawnCurve > 0.3,
      };
    }

    default:
      return defaultModifiers;
  }
}

/**
 * Check if eyes should be closed during idle animation (e.g., yawning).
 */
export function shouldCloseEyesDuringIdle(state: IdleAnimationState): boolean {
  if (state.type === "yawn") {
    return state.progress > 0.3 && state.progress < 0.8;
  }
  return false;
}
