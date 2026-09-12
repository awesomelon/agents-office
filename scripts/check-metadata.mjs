import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
const cargoVersion = read("src-tauri/Cargo.toml").match(
  /^version = "([^"]+)"/m,
)?.[1];
for (const [source, version] of Object.entries({
  lock: lock.version,
  lockRoot: lock.packages[""].version,
  tauri: tauri.version,
  cargo: cargoVersion,
})) {
  assert.equal(
    version,
    pkg.version,
    `${source} version must match package.json`,
  );
}
assert.equal(
  tauri.productName,
  "Agents Office",
  "Preserve the launcher bundle contract",
);
assert.ok(
  pkg.scripts.zip.includes("Codex-Office-macos.zip.sha256"),
  "Release must include checksum",
);
assert.ok(
  tauri.app.security.csp,
  "Desktop content security policy is required",
);
console.log(`Metadata aligned at ${pkg.version}`);
