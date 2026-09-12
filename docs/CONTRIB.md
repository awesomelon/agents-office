# Contributing

Use Node.js 22+, npm and stable Rust. Desktop development additionally needs
the platform-specific Tauri prerequisites linked in the README.

```bash
npm ci
npm run dev
npm run tauri:dev
```

Browser preview uses synthetic activity only. Use desktop development for actual
JSONL observation. Run a new Codex task after opening the observer; startup does
not replay history.

## Architecture

| Area | Responsibility |
| --- | --- |
| `src-tauri/src/watcher` | Source discovery, bounded incremental reads, Codex parsing |
| `src-tauri/src/models` | Serialized events, snapshot and workflow role types |
| `src/hooks` and `src/services` | Tauri subscription and initial snapshot coordination |
| `src/store` | Bounded activity, role visualization and HUD state |
| `src/components/ui` | Connection guidance, accessible controls and searchable inbox |
| `src/components/office` | PixiJS office scene |
| `cli` | Verified macOS release download, cache and launcher |
| `tests` and `src-tauri/core-tests` | Synthetic regression tests |

The Rust backend determines role identities. A Codex thread ID is metadata, not
a desk ID. Preserve this distinction when adding collaboration events.

## Before opening a change

```bash
npm run check
npm run test:core
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
```

The pure Rust harness imports the production parser and tailer directly so it
can run on machines without GTK/WebKit. It does not replace a native build.
The macOS CI job covers the full Tauri target.

Use focused regression tests for observed failures: partial bytes, file
replacement, call correlation, stale snapshots, duplicate events and cache
integrity. Do not put real user transcripts or credentials in fixtures.

Keep `src/types/index.ts` synchronized with Rust models. Run the metadata check
when changing versions. Commit Cargo lockfiles and `package-lock.json` so app
and CI use the same resolved dependencies.
