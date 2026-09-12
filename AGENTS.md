# Codex Office

This is a passive, local Codex activity viewer: React/TypeScript/PixiJS in `src/`,
Tauri/Rust in `src-tauri/`, and a macOS release launcher in `cli/`.

- Read only plain JSONL under `CODEX_HOME/sessions` (default `~/.codex/sessions`).
  Never read credentials, other assistants' directories, or execute log content.
- Treat rollout records as an evolving internal format. Ignore unknown records;
  preserve call/thread correlation and bounded, privacy-safe summaries.
- Office desks represent inferred workflow roles, not actual Codex agents or
  proof of process liveness. Browser demos must be explicitly labeled.
- Keep Rust `models` and TypeScript `types` synchronized. Cover protocol,
  incremental reading, startup races, and release integrity with focused tests.
- Run `npm run check` and `npm run test:core`. For desktop changes also run
  `cargo test --manifest-path src-tauri/Cargo.toml` on a Tauri-capable machine.
  Report any platform checks you cannot run.
- Keep package, lockfile, Cargo and Tauri versions aligned. `npm run zip` creates
  the Codex-only asset plus checksum; retain `Agents Office.app` compatibility.

See `docs/CONTRIB.md` and `docs/RUNBOOK.md` for development and release procedures.
