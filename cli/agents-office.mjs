#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import https from "node:https";
import { spawnSync } from "node:child_process";

const GITHUB_OWNER = "awesomelon";
const GITHUB_REPO = "agents-office";
const USER_AGENT = "agents-office-cli";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

const CACHE_DIR = process.env.AGENTS_OFFICE_CACHE_DIR
  ? path.resolve(process.env.AGENTS_OFFICE_CACHE_DIR)
  : path.join(os.homedir(), "Library", "Caches", "agents-office");

const ASSET_NAME_CANDIDATES = [
  "Agents-Office-macos.zip",
  "Agents Office-macos.zip",
  "AgentsOffice-macos.zip",
  "Agents-Office-macOS.zip",
  "Agents Office.app.zip",
];

function parseArgs(argv) {
  const args = { version: null, help: false, force: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--quiet" || a === "-q") args.quiet = true;
    else if (a === "--force") args.force = true;
    else if (a === "--version" || a === "-v") args.version = argv[++i] ?? null;
  }
  return args;
}

function log(msg, { quiet }) {
  if (!quiet) process.stdout.write(`${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function usage() {
  return `
Usage:
  npx @j-ho/agents-office [--version <x.y.z>] [--force] [--quiet]

Options:
  --version, -v   Use a specific version tag (e.g. 0.1.2 -> v0.1.2)
  --force         Re-download even if cached
  --quiet, -q     Reduce logs
  --help, -h      Show help
`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function withLock(lockPath, fn) {
  const started = Date.now();
  const timeoutMs = 60_000;
  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      try {
        return fn();
      } finally {
        try {
          fs.closeSync(fd);
        } catch {}
        try {
          fs.unlinkSync(lockPath);
        } catch {}
      }
    } catch (err) {
      if (err && err.code !== "EEXIST") throw err;
      if (Date.now() - started > timeoutMs) {
        fail(`Another agents-office process is busy (lock timeout): ${lockPath}`);
      }
      // simple backoff
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
}

function toHttpError(statusCode, url, body) {
  const err = new Error(`HTTP ${statusCode} from ${url}: ${String(body).slice(0, 200)}`);
  err.statusCode = statusCode;
  err.url = url;
  err.body = body;
  return err;
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/vnd.github+json",
          ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
            }
          } else {
            reject(toHttpError(res.statusCode, url, body));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function downloadToFile(url, destPath, { quiet }) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(destPath));
    const tmpPath = `${destPath}.tmp-${process.pid}`;
    const file = fs.createWriteStream(tmpPath);

    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/octet-stream",
          ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close(() => {
            fs.rmSync(tmpPath, { force: true });
            resolve(downloadToFile(res.headers.location, destPath, { quiet }));
          });
          return;
        }

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          file.close(() => {
            fs.rmSync(tmpPath, { force: true });
            reject(toHttpError(res.statusCode, url, ""));
          });
          return;
        }

        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            fs.renameSync(tmpPath, destPath);
            log(`Downloaded: ${path.basename(destPath)}`, { quiet });
            resolve();
          });
        });
      }
    );

    req.on("error", (err) => {
      try {
        file.close(() => fs.rmSync(tmpPath, { force: true }));
      } catch {}
      reject(err);
    });
    file.on("error", (err) => {
      try {
        fs.rmSync(tmpPath, { force: true });
      } catch {}
      reject(err);
    });

    req.end();
  });
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const buf = fs.readFileSync(filePath);
  hash.update(buf);
  return hash.digest("hex");
}

function extractZip(zipPath, outDir) {
  ensureDir(outDir);
  // Use macOS built-in ditto for zip extraction.
  const r = spawnSync("ditto", ["-x", "-k", zipPath, outDir], { stdio: "inherit" });
  if (r.status !== 0) {
    throw new Error(`Failed to extract zip (ditto exit ${r.status})`);
  }
}

function findAppBundle(dirPath, maxDepth = 5) {
  if (maxDepth < 0) return null;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dirPath, ent.name);
    if (ent.isDirectory() && ent.name.endsWith(".app")) return full;
  }
  for (const ent of entries) {
    const full = path.join(dirPath, ent.name);
    if (ent.isDirectory() && !ent.name.endsWith(".app")) {
      const found = findAppBundle(full, maxDepth - 1);
      if (found) return found;
    }
  }
  return null;
}

function openApp(appPath) {
  const r = spawnSync("open", [appPath], { stdio: "inherit" });
  return r.status ?? 1;
}

async function fetchLatestReleaseOrExplain() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  try {
    return await httpsGetJson(url);
  } catch (err) {
    // GitHub returns 404 if there are no releases, or if the repo is private without auth.
    if (err?.statusCode === 404) {
      throw new Error(
        [
          `GitHub Releases latest not found for ${GITHUB_OWNER}/${GITHUB_REPO}.`,
          `This usually means either:`,
          `- There is no GitHub Release yet (recommended: create a release like v0.1.3 with Agents-Office-macos.zip), or`,
          `- The repo is private and you need to set GITHUB_TOKEN for API access.`,
          ``,
          `You can also run with a specific tag once releases exist:`,
          `  npx @j-ho/agents-office --version 0.1.3`,
        ].join("\n")
      );
    }
    throw err;
  }
}

async function resolveReleaseTag(requestedVersion) {
  if (requestedVersion) {
    const v = requestedVersion.startsWith("v") ? requestedVersion.slice(1) : requestedVersion;
    return `v${v}`;
  }
  const latest = await fetchLatestReleaseOrExplain();
  if (!latest?.tag_name) throw new Error("GitHub latest release has no tag_name");
  return latest.tag_name;
}

async function fetchReleaseByTag(tag) {
  return await httpsGetJson(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${encodeURIComponent(tag)}`);
}

function pickAsset(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  for (const name of ASSET_NAME_CANDIDATES) {
    const a = assets.find((x) => x && x.name === name);
    if (a) return a;
  }
  // Fallback: any zip that looks like macos
  const fallback = assets.find((a) => typeof a?.name === "string" && a.name.endsWith(".zip") && /mac/i.test(a.name));
  return fallback ?? null;
}

function findChecksumAsset(release, zipAssetName) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const direct = assets.find((a) => a?.name === `${zipAssetName}.sha256`);
  if (direct) return { kind: "sha256", asset: direct };
  const checksums = assets.find((a) => a?.name === "checksums.txt");
  if (checksums) return { kind: "checksums.txt", asset: checksums };
  return null;
}

async function downloadOptionalChecksum(release, zipAsset, cacheDir, { quiet }) {
  const checksumInfo = findChecksumAsset(release, zipAsset.name);
  if (!checksumInfo) return null;

  const checksumPath = path.join(cacheDir, checksumInfo.asset.name);
  await downloadToFile(checksumInfo.asset.browser_download_url, checksumPath, { quiet });

  if (checksumInfo.kind === "sha256") {
    const expected = fs.readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0];
    return { expected, source: checksumInfo.asset.name };
  }

  // checksums.txt: try to find a line containing the asset name
  const text = fs.readFileSync(checksumPath, "utf8");
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && l.includes(zipAsset.name));
  if (!line) return null;
  const expected = line.split(/\s+/)[0];
  return { expected, source: checksumInfo.asset.name };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    process.exit(0);
  }

  ensureDir(CACHE_DIR);
  const lockPath = path.join(CACHE_DIR, "download.lock");

  await withLock(lockPath, async () => {
    const tag = await resolveReleaseTag(args.version);
    const versionDir = path.join(CACHE_DIR, tag);
    const extractDir = path.join(versionDir, "extract");
    const marker = path.join(versionDir, ".ready");

    log(`Agents Office CLI (tag: ${tag})`, args);

    if (!args.force && fs.existsSync(marker)) {
      const appPath = findAppBundle(extractDir);
      if (!appPath) {
        // cache seems broken; force re-download below
        log("Cache marker exists but .app not found; re-downloading.", args);
      } else {
        log(`Using cache: ${appPath}`, args);
        const code = openApp(appPath);
        if (code !== 0) {
          fail(
            `Failed to open app (exit ${code}). If macOS Gatekeeper blocks it, allow it in System Settings -> Privacy & Security.`
          );
        }
        return;
      }
    }

    // Prepare fresh directory
    fs.rmSync(versionDir, { recursive: true, force: true });
    ensureDir(versionDir);
    ensureDir(extractDir);

    const release = await fetchReleaseByTag(tag);
    const asset = pickAsset(release);
    if (!asset?.browser_download_url || !asset?.name) {
      fail(
        `No suitable macOS zip asset found in release ${tag}.\nExpected one of: ${ASSET_NAME_CANDIDATES.join(
          ", "
        )}\nPlease upload a zip containing 'Agents Office.app/'.`
      );
    }

    const zipPath = path.join(versionDir, asset.name);
    log(`Downloading release asset: ${asset.name}`, args);
    await downloadToFile(asset.browser_download_url, zipPath, args);

    const checksum = await downloadOptionalChecksum(release, asset, versionDir, args);
    if (checksum?.expected) {
      const actual = sha256File(zipPath);
      if (actual.toLowerCase() !== checksum.expected.toLowerCase()) {
        fail(
          `Checksum mismatch for ${asset.name}\nExpected(${checksum.source}): ${checksum.expected}\nActual: ${actual}`
        );
      }
      log(`Checksum OK (${checksum.source})`, args);
    } else {
      log("Checksum: skipped (no checksum asset found)", args);
    }

    log("Extracting...", args);
    extractZip(zipPath, extractDir);

    const appPath = findAppBundle(extractDir);
    if (!appPath) {
      fail(
        `Extraction completed but .app bundle not found.\nPlease ensure the zip contains 'Agents Office.app/' at any depth.`
      );
    }

    fs.writeFileSync(marker, new Date().toISOString(), "utf8");
    log(`Launching: ${appPath}`, args);
    const code = openApp(appPath);
    if (code !== 0) {
      fail(
        `Failed to open app (exit ${code}). If macOS Gatekeeper blocks it, allow it in System Settings -> Privacy & Security.`
      );
    }
  });
}

main().catch((err) => {
  const msg = err?.stack || err?.message || String(err);
  fail(`[agents-office] ${msg}`);
});

