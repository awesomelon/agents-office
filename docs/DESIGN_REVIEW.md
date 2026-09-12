# Codex Office: studio design review

The follow-up [3D character integration](3D_AGENTS.md) replaces the pins described
below with eight rendered teammates and matching portraits. This original review
and provisional score remain historical; the follow-up records its own evidence.

## Scope and evidence

This is an implementation review, not a completed screenshot audit. The current
cloud browser rejected the local app with `ERR_BLOCKED_BY_CLIENT`; no desktop or
mobile runtime screenshot could be accepted. The illustration itself was generated
and visually inspected. Layout, controls and state behavior were reviewed in code
and tested in jsdom. Native macOS visual verification remains outstanding.

## Provisional design score

These are equally weighted design judgments, not a measured usability study.
The user's “12 out of 10” goal is treated as an ambition to exceed the original
scope; the rating stays on a ten-point scale. Final visual scoring requires the
running application to be inspected on desktop and a narrow viewport.

| Criterion                    |  Before | After, provisional | Concrete change                                                                         |
| ---------------------------- | ------: | -----------------: | --------------------------------------------------------------------------------------- |
| Visual identity              |     6.0 |                9.0 | Ink, cream and sage system; consistent typography and controls                          |
| Hierarchy                    |     6.5 |                9.0 | Compact header/demo area; office, metrics and event inbox in a clearer order            |
| Office atmosphere            |     5.5 |                9.5 | Warm 3D-rendered room, six desks, resource library and conversation lounge              |
| Interaction and adaptability |     7.0 |                8.5 | Selectable spaces, per-role recent events, automatic following, narrow-layout directory |
| Accessibility and resilience |     7.5 |                8.5 | Native buttons, explicit statuses, reduced motion, image fallback, no WebGL for Studio  |
| **Average**                  | **6.5** |            **8.9** | **Provisional until runtime visual review**                                             |

## Implemented experience

1. **Enter the office — implementation verified.** Studio is the default for new
   installations. Existing visibility settings remain respected. Browser mode
   explicitly labels synthetic demo events; desktop mode identifies local observations.
2. **Explore activity — interaction tests pass.** Eight numbered spaces map to the
   same observer roles as the original canvas. Select a space or its directory
   button to read up to three recent safe summaries. Manual selection stays in place
   until Follow activity is enabled again. Messages and errors also update following.
3. **Choose the presentation — interaction tests pass.** Studio and Pixel share
   activity state. Pixel remains an optional lazy-loaded animated scene. Motion can
   be disabled without pausing incoming observations; system reduced motion wins.
4. **Use a narrow or limited device — partial verification.** Narrow scenes replace
   overlapping hotspots with static numbered markers and full-sized role controls.
   The directory survives image failure. CSS layout and fallback behavior are checked;
   actual reflow, touch targeting and contrast still need a browser visual pass.

## Scope details

- The studio artwork is a static 3D-rendered illustration, not a real-time 3D engine.
  The role indicators, selection, recent events and following are live application UI.
- Six work desks plus the library and lounge provide eight workflow zones. They do
  not represent eight running agents or direct Codex execution.
- The 1536 × 1024 WebP is 158,240 bytes, bundled locally. It has no remote image
  dependency. [Asset provenance and generation prompt](../public/assets/README.md).
- The artwork is never cropped; hotspot positions use percentages of its fixed 3:2
  canvas. Narrow scenes use noninteractive markers to avoid overlapping hit areas.
- No runtime dependencies, remote fonts, analytics or model calls were added.
- Stale visual details are pruned while visible, and maintenance stops in hidden
  tabs. The original observer, privacy rules and backend protocol are unchanged.

## Validation

- `npm run check`: metadata, TypeScript, 49 frontend tests, 22 launcher tests and production build.
- `cargo test --manifest-path src-tauri/core-tests/Cargo.toml --locked`: 23 passing tests.
- Ten additional tests cover selection/following, snapshot state, keyboard controls,
  image failure, view switching, reduced motion, observation while motion is paused,
  expiration, hidden-tab recovery and cleanup.
- Independent code review identified follow-target and small-screen hitbox defects;
  both were corrected before handoff.
- A production HTML check confirms that Studio does not preload the Pixi chunk.
- Native macOS CI checks are recorded in the pull request. CI success is not a claim
  that someone visually inspected the desktop application.

## Remaining visual acceptance

Inspect the running app at the default 1200 × 800 window and 375px browser width,
with empty, working, error and reduced-motion states. Confirm marker alignment,
focus visibility, text contrast, scrolling and event-panel legibility. Also test
the native WebKit view on macOS. Until those checks are done, 8.9/10 is provisional.
