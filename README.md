# Codex Office

A local desktop companion that brings **Codex activity** into a warm, illustrated studio.
Explore eight workflow spaces, select a role to inspect its recent events, or follow
new activity automatically. A searchable event inbox sits alongside the office.

![The Codex studio illustration: six desks, a resource library and a conversation lounge](public/assets/codex-studio.webp)

The image above is the studio artwork; live status labels and controls are rendered by the app.
**Studio view** uses a lightweight 3D-rendered illustration with interactive activity zones.
**Pixel view** preserves the animated office. Studio view needs no WebGL; the pixel
renderer loads when selected. Both views observe the same local activity.

This is an independent community project. The desks illustrate workflow roles;
they are not a count of actual Codex agents. Codex Office observes saved activity
and never starts, controls or changes your Codex sessions.

## Try it

Use Node.js 22+ and npm:

```bash
git clone https://github.com/awesomelon/agents-office.git
cd agents-office
npm ci
npm run dev
```

The browser opens a clearly labeled preview with an opt-in synthetic demo.
It cannot read your local Codex files. For real activity, install the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and stable Rust,
then run:

```bash
npm run tauri:dev
```

Start Codex locally and submit a new task. Existing history is skipped when the
observer starts, so old tasks do not appear as live work. Newly appended records
appear automatically. An empty or missing sessions folder produces an explanatory
status and is checked again without restarting the app.

## What it reads

Only plain `sessions/**/*.jsonl` files below `CODEX_HOME` are observed. If that
environment variable is unset or empty, the default is `~/.codex/sessions`.
Set `CODEX_HOME` before launching the desktop application for a custom location.
On macOS, applications opened from Finder may not inherit your shell variables;
use `CODEX_HOME=/absolute/path npm run tauri:dev` when developing.

The observer supports Codex rollout envelopes such as `session_meta`,
`response_item` and selected `event_msg` records. It correlates tool results with
their calls within each thread and recognizes turn completion and interruption.
Unknown records are skipped. The inbox shows bounded summaries rather than raw
prompts, command arguments, source code or command output.

| Desk      | Observed activity                        |
| --------- | ---------------------------------------- |
| Explorer  | File discovery and reading commands      |
| Analyzer  | Content search and web search            |
| Architect | Plans and agent delegation               |
| Developer | Patch application and editing            |
| Operator  | Shell commands and process interaction   |
| Validator | Recognized test, lint and build commands |
| Connector | MCP and external tool calls              |
| Liaison   | Messages and user interaction            |

Classification is an approximation. A shell wrapper or a new tool name may be
shown under a general role. A tool result means that a result was recorded;
success is claimed only when the record carries enough evidence.

## Privacy and limits

- All observation and rendering happen locally. No analytics, remote fonts,
  model requests or telemetry are needed by the desktop viewer.
- Credentials (`auth.json`), configuration, SQLite databases, archived sessions
  and other assistants' directories are outside the source scope. Symlinked
  source entries are skipped.
- The UI can show local directory and thread identifiers. Consider this before
  screen sharing. Clearing the inbox does not delete Codex files.
- Rollout JSONL is an internal, evolving format, not a stable integration API.
  A Codex host that does not persist these files cannot be observed by this app.
- Saved records do not reliably expose approval prompts, live process status,
  or every intermediate event. “Watching” describes the observer, not proof
  that Codex is executing. Activity status is inferred from recorded events.
- Work is bounded per poll and discovery cycle. Large session trees surface a
  capacity warning rather than silently claiming complete coverage.

The compatibility implementation is based on the official
[rollout envelope](https://github.com/openai/codex/blob/main/codex-rs/history/src/rollout_payload.rs),
[protocol](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/protocol.rs),
[response items](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/models.rs)
and [persistence policy](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/policy.rs).
Tests use synthetic examples and never contain private session transcripts.

## Checks and builds

```bash
npm run check          # metadata, TypeScript, frontend/launcher tests, web build
npm run test:core      # Rust parser/tailer tests; no desktop libraries required
npm run tauri:build    # native desktop bundle; OS prerequisites required
```

CI checks frontend, launcher and pure Rust behavior, and builds the macOS desktop
application. See [contributing](docs/CONTRIB.md), [operations](docs/RUNBOOK.md)
and the [project review](docs/REVIEW.md) for scope and validation evidence.
The [design review](docs/DESIGN_REVIEW.md) records the studio redesign and its validation limits.

## macOS launcher

The package name remains `@j-ho/agents-office` for compatibility. The Codex-only
launcher requires a `Codex-Office-macos.zip` release asset and its integrity
metadata. It refuses legacy releases that contain only the previous asset name.
The inner bundle remains `Agents Office.app`; its window is titled Codex Office.

Until a Codex release and npm package are published, use the source instructions
above. An existing npm `latest` version may still be the previous application.
After release, use `npx @j-ho/agents-office@0.2.0`; `--version` selects the GitHub
release tag and `--force` refreshes its cache.

MIT license.
