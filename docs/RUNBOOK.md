# Operations and releases

## Source troubleshooting

| Symptom | Check |
| --- | --- |
| Browser preview, no real events | Run the Tauri desktop app; browsers cannot read the source. |
| Waiting for sessions | Confirm Codex writes plain JSONL below the displayed source path. Submit a new task. |
| Custom Codex home ignored | Set `CODEX_HOME` in the environment of the application process. Finder launches may differ from a terminal. |
| Connected but no history | Expected: old file content is baselined at startup. Observe newly appended activity. |
| Source error or capacity warning | Check permissions and the displayed path; the app retries automatically. Large trees can exceed its bounded scope. |
| Tool appears under a general role | Classification is heuristic; add a synthetic regression fixture for the specific tool shape. |
| Activity seems stale | JSONL is passive observation, not a process or approval API. Inspect Codex itself. |

The viewer does not write to Codex's directories. Do not delete or alter real
session files to test rotation or error recovery. Use a separate temporary
`CODEX_HOME` with synthetic fixtures.

## Desktop smoke check

1. Use a temporary Codex home with an empty `sessions` directory.
2. Launch the app and verify the displayed source and empty-state guidance.
3. Append synthetic session metadata, call and output records; verify a single
   matching call/result pair, a thread label and the expected desk role.
4. Split a Unicode record across writes; it should appear only after its newline.
5. Finish/abort a turn; the affected thread should stop showing work. Interleave
   two threads and confirm finishing one does not clear the other.
6. Remove/recreate the temporary source and check visible status recovery.
7. Resize, filter the inbox, use keyboard controls and clear the displayed logs.
8. In a normal local installation, observe a real Codex task before publishing.

## Prepare a macOS release

Only publish after CI and the native smoke check pass. This repository change
does not automatically publish to npm or GitHub Releases.

```bash
npm ci
npm run check
npm run test:core
npm run tauri:build -- --bundles app
npm run zip
```

Use tag `v0.2.0` for this migration. Attach both:

- `Codex-Office-macos.zip` (contains `Agents Office.app/`)
- `Codex-Office-macos.zip.sha256` (exact asset basename in checksum line)

The launcher refuses legacy asset names and verifies downloaded bytes before
extraction. Its cache marker is versioned; old markers are not sufficient to
launch a bundle. Test `node cli/agents-office.mjs --version 0.2.0 --force` on a
Mac. Sign/notarize distribution builds as appropriate and verify Gatekeeper
behavior on a clean Mac; a successful web build does not establish this.

Inspect `npm pack --dry-run`, then publish the package only as part of an
authorized release. Keep package/Cargo/Tauri versions aligned.

## Rollback

Keep the previous verified artifacts. If a new release fails, publish a fixed
version or repoint npm's distribution tag to a known good **Codex-compatible**
release. Avoid deleting published versions as a routine rollback. Users can pin
both the package version and the release version with `npx` and `--version`.

For a local source rollback, use a separate checkout of a known good commit,
run `npm ci`, and rebuild. A pre-migration build observes a different source and
must not be described as a Codex-compatible rollback.
