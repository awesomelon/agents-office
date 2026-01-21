# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agents Office is a Tauri desktop application that visualizes Claude Code's work as agents working in a 2D pixel-art office. It monitors the `~/.claude/debug` and `~/.claude/projects` directories to update agent states in real-time.

## Commands

```bash
# Tauri app dev mode (frontend + Rust backend)
npm run tauri:dev

# Frontend dev server only (browser preview)
npm run dev

# Production build
npm run tauri:build

# Frontend build only
npm run build

# Frontend preview (view build output)
npm run preview

# Rust backend type check
cd src-tauri && cargo check

# Rust tests
cd src-tauri && cargo test
```

## Tech Stack
- **Frontend**: React 18 + PixiJS 7 + Zustand 5 + Vite 6 + TypeScript 5
- **Backend**: Tauri 2.x + Rust (notify-debouncer-full for file watching)
- **Styling**: TailwindCSS 3

## Architecture

### Data Flow
```
~/.claude/debug/*.txt   ─┐
                         ├→ Rust LogWatcher → AppEvent → Tauri emit → useTauriEvents → Zustand → PixiJS
~/.claude/projects/**/* ─┘     (200ms debounce)         ("app-event")
```

### AppEvent Types (Tauri → Frontend)
- `LogEntry`: Add inbox log entry
- `AgentUpdate`: Update agent status/current task
- `WatcherStatus`: Display Watching/Idle status at top
- `SessionUpdate`: Update session ID
- `BatchUpdate`: Batch process multiple log/agent updates (performance optimization)

### Backend (src-tauri/src/)
- **lib.rs**: Tauri app entry point; log watcher runs via `spawn_blocking` (isolates blocking watcher loop from runtime)
- **watcher/log_watcher.rs**: File watching with notify-debouncer-full + batch emit (`AppEvent::BatchUpdate`)
  - `FileTracker` tracks read position per file based on **actual stream position** (no EOF seek jump → prevents data loss during appends)
  - Offset reset on file truncate/rotate detection
  - **Last line without newline** is kept in tail-buffer and concatenated on next event (prevents duplication/loss in incremental reads)
  - `tracing::debug!` measures batch processing time/line count/emit size (for bottleneck analysis)
- **watcher/log_parser.rs**: Log line parsing
  - `"Tool call: ..."` / `"Tool result: ..."` branch to fast-path (minimizes Regex/unnecessary lowercase allocations)
  - Determines agent type based on tool name
- **models/mod.rs**: `Agent`, `LogEntry`, `AppEvent` type definitions

### Frontend (src/)
- **components/office/OfficeCanvas.tsx**: PixiJS-based office rendering (550×700 canvas)
- **components/office/canvas/**: OfficeCanvas submodules
  - `agent/AgentSprite.tsx`: Agent character rendering and bounce animation
  - `desk/Desk.tsx`: Desk + monitor (status-based screen), AlertLight, QueueIndicator
  - `document/FlyingDocument.tsx`: Document transfer animation between agents (parabolic trajectory, rotation, tool stamp)
  - `effects/EffectsLayer.tsx`: Visual effects layer (4 effect types)
  - `background/OfficeBackground.tsx`: Floor tiles, windows, walls, right-side decorations
  - `partition/HorizontalPartition.tsx`: Section divider partition (300px width)
  - `hud/HudDisplay.tsx`: Top HUD bar (tool call/error/agent switch counts, rate limit indicator)
  - `hooks/useAgentMotion.ts`: Agent motion state management (5-phase system)
  - `hooks/useNowRaf.ts`: RAF loop driver (~30fps throttle during animation)
  - `hooks/useOfficeViewport.ts`: Viewport scaling calculation
  - `constants.ts`, `layout.ts`, `types.ts`, `math.ts`: Constants, layout utils, types, math functions
- **hooks/useTauriEvents.ts**: Subscribe to Tauri events via `listen("app-event")`, detect agent switches, record HUD metrics
- **store/agentStore.ts**: Zustand state management
  - `documentTransfer`: Document transfer animation state (fromAgentId, toAgentId, startedAt)
  - `lastActiveAgentId`: Track last active agent (for document transfer triggers)
  - `lastTaskUpdateById`: Last task update time per agent (for speech bubble timeout)
  - `errorById`: Error state tracking per agent (for alert light display)
- **store/hudStore.ts**: HUD metrics state management
  - Tracks tool_call, error, agent_switch events with 60-second sliding window
  - `rateLimitActive`: Rate limit active state
- **store/logStore.ts**: Log entry management
- **types/index.ts**: Type definitions, `DESK_CONFIGS` (3-3-2 vertical layout), `AGENT_COLORS`

### Type Synchronization (Important)
Rust and TypeScript types require manual synchronization:
- `AgentType`: explorer, analyzer, architect, developer, operator, validator, connector, liaison
- `AgentStatus`: idle, working, thinking, passing, error
- `LogEntryType`: tool_call, tool_result, message, error, todo_update, session_start, session_end

When modifying, update both `src-tauri/src/models/mod.rs` and `src/types/index.ts`.

## Key Patterns

### Tauri Environment Check
Running `npm run dev` in browser causes errors due to missing Tauri API. Environment check required before using Tauri API:
```typescript
function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}
```
`useTauriEvents.ts` uses this pattern for browser/Tauri environment branching.

### Agent-Tool Mapping (Workflow-based)
`log_parser.rs` `determine_agent_type()`:
- Read/Glob → Explorer (blue 0x3b82f6) - File exploration
- Grep/WebSearch → Analyzer (cyan 0x06b6d4) - Content analysis
- TodoWrite/Task → Architect (pink 0xf472b6) - Planning
- Write/Edit/NotebookEdit → Developer (green 0x22c55e) - Code writing
- Bash (general) → Operator (yellow 0xfbbf24) - Command execution
- Bash (test/git/jest/vitest/pytest) → Validator (orange 0xf97316) - Testing/validation
- WebFetch/mcp__*/Skill → Connector (purple 0x8b5cf6) - External integration
- AskUserQuestion/Error → Liaison (pink 0xec4899) - User communication

### Office Layout
3-3-2 vertical layout (`DESK_CONFIGS` in types/index.ts, 550×700 canvas):
```
┌─────────────────────────────────────────────┬────────┐ Y=0
│              (Wall area 70px)               │        │
│  ┌──────────────────────────────────────────┤[Hanger]│ Y=70
│  │ ENTRANCE (156px)                         │        │ Y=80
├═══════════════════════════┤                 │[Locker]│ Y=70 (Partition 1, 300px width)
│ [Explorer] [Analyzer] [Architect]           │        │ Y=130 (facing up)
│   (60)      (150)      (240)                │        │  Explore/Analyze/Design
│                                             │  RIGHT │
│ [Developer][Operator] [Validator]           │  WALL  │ Y=320 (facing down)
│   (60)      (150)      (240)                │ X=500~ │  Implement/Execute/Validate
├═══════════════════════════┤                 │        │ Y=420 (Partition 2, 300px width)
│ [Connector][Liaison]                        │        │ Y=520 (facing up)
│   (60)      (150)                           │        │  Integrate/Communicate
├─────────────────────────────────────────────┴────────┤
│              (Bottom window band 78px)               │
└──────────────────────────────────────────────────────┘ Y=700
```
- Agent position: `getAgentPosition()` calculates from DESK_CONFIGS (desk Y - 55px)
- Right decorations: Coat hanger (Y=80), Lockers 2×5 grid (Y=180)
- Partitions: 300px width (avoids right wall area)

### Document Transfer Animation
Visualizes task handoff between agents as document passing:
1. `handleDocumentTransfer()` in `useTauriEvents.ts` detects agent change on tool_call events
2. Calls `agentStore.startDocumentTransfer(fromId, toId, toolName)` (includes toolName)
3. `FlyingDocument` component renders 600ms parabolic animation:
   - **Tool stamp**: Pixel-art icon + label for tool type on document
   - `TOOL_STAMPS` mapping (workflow-based):
     - read/glob → EXPL (Explorer)
     - grep/websearch → ANLZ (Analyzer)
     - todowrite/task → ARCH (Architect)
     - write/edit → DEV (Developer)
     - bash → OPER (Operator)
     - webfetch/skill → CONN (Connector)
     - askuserquestion → LIAS (Liaison)
   - Offset/scale/opacity adjustment based on stack depth (handles concurrent transfers)
4. Auto-calls `clearDocumentTransfer()` on completion

### Monitor Screen States
`MonitorScreen` component displays status-based screens:
- **idle**: Dark screen + scanlines
- **working**: Code lines scrolling in agent color + cursor blink
- **thinking**: 3 loading dots blinking sequentially
- **passing**: Arrow moving right animation
- **error**: Red background blinking + X mark

### Agent Motion (5-Phase System)
`useAgentMotion` hook manages 5-phase system based on agent state changes:

**Motion Phases** (`MotionPhase` type):
1. **absent**: Initial state before appearance
2. **entering**: Moving from entrance to desk (700ms, easeOutCubic)
3. **present**: Settled at desk (static)
4. **walking**: Walking around office (on idle transition)
5. **returning**: Returning to desk when working resumes during walk

**State Transitions**:
- `absent` → `entering`: On first tool_call
- `entering` → `present`: After 700ms
- `present` → `walking`: On working → idle transition
- `walking` → `returning`: On idle → working transition
- `returning` → `present`: On return completion

**Walking Motion Details**:
- Movement only within same Y band (prevents partition crossing)
- Speed: 35px/sec (`WALKING_SPEED_PX_PER_SEC`)
- Random pause 2-4 seconds after reaching waypoint before next move
- Walk animation: 180ms frame interval, amplified limb movement
- Eye gaze changes based on movement direction

**Walkable Areas**:
- X range: 30~295 (`WALK_X_MIN` ~ `WALK_X_MAX`)
- Y bands (prevents partition crossing):
  - 85~115: Below Partition 1 ~ Above Section A
  - 175~280: Section A ~ Section B
  - 360~410: Section B ~ Partition 2
  - 440~490: Below Partition 2 ~ Above Section C
  - 565~670: Below Section C ~ Floor

### Speech Bubble Timeout
`OfficeCanvas` calls `clearExpiredTasks()` every second to auto-hide speech bubbles for agents without updates for 5+ seconds. Timeout value adjustable via `SPEECH_BUBBLE_TIMEOUT_MS` constant.

### HUD (Heads-Up Display)
Semi-transparent bar at canvas top showing real-time metrics:
- **Calls**: tool_call event count in last 60 seconds
- **Err**: Error count in last 60 seconds
- **Switch**: Agent switch count in last 60 seconds
- **LIMIT**: Blinking indicator when rate limit occurs

`hudStore.ts` tracks events with 60-second sliding window, auto-cleans old data every second.

### Error Alert Light
On error, red warning light blinks at 200ms interval on the right side of affected agent's desk monitor:
- `useTauriEvents.ts` calls `setAgentError(agentId, true)` when detecting `entry_type === "error"`
- Cleared via `setAgentError(agentId, false)` on subsequent tool_call/tool_result success
- `AlertLight` component renders red light + glow effect

### Rate Limit Visual Effects
Visual feedback on rate limit detection:
1. **Vacation sign**: Existing VacationSign component display
2. **Queue indicator**: QueueIndicator component - hourglass icon + 3 dots blinking sequentially (500ms period)
3. **HUD highlight**: "LIMIT" text blinking red

Rate limit pattern detection: `isLimitReachedMessage()` function matches patterns like "rate_limit", "hit your limit".

### Session Timeline
`Timeline.tsx` component visualizes recent events as horizontal bar:
- Color-coded dots for event types (tool_call, error, etc.)
- Tooltip on hover showing details (agent, relative time)
- `TIMELINE_COLORS` defines colors per event type
- Toggle button for show/hide

### Visual Effects System
`EffectsLayer.tsx` renders visual effects based on agent actions:

**Effect Types** (`VisualEffect.kind`):
- **searchPulse**: Concentric pulse (Explorer/Analyzer/Connector) - 2 rings expanding with fadeout
- **typeParticles**: Rising particles (Architect/Developer/Liaison) - 6 rectangles floating up
- **runSpark**: Spark burst (Operator) - 8-directional sparks + center glow
- **errorBurst**: Explosion pattern (on error) - 10 fragments + flash

**Implementation Details**:
- Deterministic particle generation: Consistent random patterns via `seed` value
- Auto-cleanup of expired effects every 500ms (`removeExpiredEffects`)
- `easeOutCubic` applied for smooth animations

### Agent Mood System
`AgentMood` type determines agent expressions:

**Mood Types**:
- **neutral**: Default expression
- **focused**: Focused expression (tool_call within last 2 seconds)
- **stressed**: Tense expression (on error)
- **blocked**: Blocked expression (rate limit/vacation state)

**Decision Logic** (priority order):
1. `vacationById[id]` → `blocked`
2. `errorById[id]` → `stressed`
3. Last tool_call within 2 seconds → `focused`
4. Default → `neutral`

### useNowRaf Pattern
RAF (requestAnimationFrame) based animation loop:
```typescript
useNowRaf({
  nowRef,           // Current time ref (prevents re-render)
  documentTransfers,
  motionById,
  effects,
  removeExpiredEffects,
});
```
- Throttles to ~30fps only during active animation (33ms interval)
- Mirrors frequently changing state via refs → single effect setup
- Active state check: Document transfers, entering/walking/returning motion, visual effects

### Canvas Constants
Key layout constants (`constants.ts`):
```
OFFICE_WIDTH = 550      // Canvas width
OFFICE_HEIGHT = 700     // Canvas height
RIGHT_WALL_START_X = 500  // Right wall start position
ENTRANCE_WIDTH = 156    // Entrance width
COAT_HANGER_X = 420     // Coat hanger X position
LOCKER_X = 420          // Locker X position
LOCKER_CELL_SIZE = 24   // Locker cell size (2×5 grid)
PARTITION_WIDTH = 300   // Partition width (avoids right wall)
```

### Build Optimization
Vite build config (`vite.config.ts`):
```typescript
build: {
  chunkSizeWarningLimit: 700,  // KB (avoids PixiJS chunk warning)
  rollupOptions: {
    output: {
      manualChunks: {
        pixi: ["pixi.js", "@pixi/react"],  // ~420KB
        react: ["react", "react-dom"],     // ~140KB
        tauri: ["@tauri-apps/api", ...],   // ~30KB
        vendor: ["zustand"],               // ~10KB
      }
    }
  }
}
```
- Separate chunks for major dependencies maximizes caching efficiency
- Warning threshold set to 700KB as PixiJS is the largest chunk
