#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import https from "node:https";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const RELEASE_API =
  "https://api.github.com/repos/awesomelon/agents-office/releases";
const CACHE_DIR = process.env.AGENTS_OFFICE_CACHE_DIR
  ? path.resolve(process.env.AGENTS_OFFICE_CACHE_DIR)
  : path.join(os.homedir(), "Library", "Caches", "agents-office");
export const ASSET_NAME = "Codex-Office-macos.zip";
const APP_NAME = "Agents Office.app";
const CACHE_SCHEMA = 2;

export function normalizeTag(value) {
  if (!/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(value)) {
    throw new Error(
      `Invalid version: ${value}. Expected a release version such as 0.2.0.`,
    );
  }
  return value.startsWith("v") ? value : `v${value}`;
}

export function parseArgs(argv) {
  const args = { version: null, help: false, force: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--quiet" || arg === "-q") args.quiet = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--version" || arg === "-v") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) {
        throw new Error(
          `${arg} requires a release version, for example --version 0.2.0.`,
        );
      }
      args.version = normalizeTag(argv[++i]);
    } else
      throw new Error(`Unknown argument: ${arg}. Run with --help for usage.`);
  }
  return args;
}

function log(message, { quiet }) {
  if (!quiet) process.stdout.write(`${message}\n`);
}

function usage() {
  return `
Codex Office — a local Codex session monitor for macOS.

Usage:
  npx @j-ho/agents-office [--version <x.y.z>] [--force] [--quiet]

Options:
  --version, -v   Use a specific Codex release (e.g. 0.2.0 -> v0.2.0)
  --force         Download and verify a fresh copy
  --quiet, -q     Reduce logs
  --help, -h      Show help

Requires a release containing ${ASSET_NAME} and a SHA-256 checksum.
`;
}

export async function withLock(
  lockPath,
  fn,
  { timeoutMs = 60_000, pollMs = 250 } = {},
) {
  const started = Date.now();
  let fd;
  while (fd === undefined) {
    try {
      fd = fs.openSync(lockPath, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() - started >= timeoutMs) {
        throw new Error(
          `Another agents-office process is busy (lock timeout): ${lockPath}. If no launcher is running, remove the stale lock and retry.`,
        );
      }
      await delay(pollMs);
    }
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid }));
    return await fn();
  } finally {
    fs.closeSync(fd);
    fs.rmSync(lockPath, { force: true });
  }
}

export function requestHeaders(url, accept, token = process.env.GITHUB_TOKEN) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error(
      "Release downloads require HTTPS URLs without embedded credentials.",
    );
  }
  return {
    "User-Agent": "codex-office-cli",
    Accept: accept,
    ...(token &&
    parsed.hostname === "api.github.com" &&
    (!parsed.port || parsed.port === "443")
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
}

async function responseStream(
  url,
  accept,
  { request = https.request, redirects = 0 } = {},
) {
  const headers = requestHeaders(url, accept);
  return await new Promise((resolve, reject) => {
    const req = request(url, { method: "GET", headers }, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        res.on("error", () => {});
        res.resume();
        if (redirects >= 5)
          return reject(new Error("Too many release download redirects."));
        let next;
        try {
          next = new URL(res.headers.location, url).href;
        } catch (error) {
          return reject(error);
        }
        resolve(
          responseStream(next, accept, { request, redirects: redirects + 1 }),
        );
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve(res);
      } else {
        res.on("error", () => {});
        res.resume();
        const error = new Error(
          `HTTP ${res.statusCode} from ${new URL(url).hostname}`,
        );
        error.statusCode = res.statusCode;
        reject(error);
      }
    });
    req.setTimeout(30_000, () =>
      req.destroy(new Error("Release request timed out.")),
    );
    req.on("error", reject);
    req.end();
  });
}

export async function httpsGetJson(url, options = {}) {
  const response = await responseStream(
    url,
    "application/vnd.github+json",
    options,
  );
  const chunks = [];
  let size = 0;
  for await (const chunk of response) {
    size += Buffer.byteLength(chunk);
    if (size > 5 * 1024 * 1024) {
      response.destroy();
      throw new Error("GitHub release response exceeded the size limit.");
    }
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("GitHub returned invalid release JSON.");
  }
}

export async function downloadToFile(url, destPath, options = {}) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const tmpPath = `${destPath}.tmp-${crypto.randomUUID()}`;
  try {
    const response = await responseStream(
      url,
      "application/octet-stream",
      options,
    );
    await pipeline(response, fs.createWriteStream(tmpPath, { flags: "wx" }));
    fs.renameSync(tmpPath, destPath);
    log(`Downloaded: ${path.basename(destPath)}`, options);
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export function parseChecksum(text, assetName, direct = false) {
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^([a-fA-F0-9]{64})(?:\s+\*?(.+))?$/);
    if (match && (match[2] === assetName || (direct && !match[2]))) {
      return match[1].toLowerCase();
    }
  }
  throw new Error(`No valid SHA-256 checksum for ${assetName}.`);
}

export function pickAsset(release) {
  const asset = Array.isArray(release?.assets)
    ? release.assets.find((entry) => entry?.name === ASSET_NAME)
    : null;
  if (!asset || !(asset.url || asset.browser_download_url)) {
    throw new Error(
      `This release has no Codex app (${ASSET_NAME}). Publish a Codex release or select one with --version. Legacy Claude releases are incompatible.`,
    );
  }
  return asset;
}

async function expectedChecksum(release, asset, stagingDir, args, download) {
  if (/^sha256:[a-fA-F0-9]{64}$/.test(asset.digest ?? "")) {
    return asset.digest.slice(7).toLowerCase();
  }
  const direct = release.assets.find(
    (entry) => entry?.name === `${ASSET_NAME}.sha256`,
  );
  const checksum =
    direct ?? release.assets.find((entry) => entry?.name === "checksums.txt");
  if (!checksum || !(checksum.url || checksum.browser_download_url)) {
    throw new Error(
      `Release is missing a SHA-256 checksum. Publish ${ASSET_NAME}.sha256 alongside the zip.`,
    );
  }
  const checksumPath = path.join(stagingDir, "checksum.txt");
  await download(
    checksum.url || checksum.browser_download_url,
    checksumPath,
    args,
  );
  return parseChecksum(
    fs.readFileSync(checksumPath, "utf8"),
    ASSET_NAME,
    Boolean(direct),
  );
}

function extractZip(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const result = spawnSync("ditto", ["-x", "-k", zipPath, outDir], {
    stdio: "inherit",
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Failed to extract zip: ${result.error?.message ?? `ditto exit ${result.status}`}`,
    );
}

export function findAppBundle(dirPath, maxDepth = 5) {
  if (maxDepth < 0 || !fs.existsSync(dirPath)) return null;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory() && entry.name === APP_NAME) {
      try {
        const executableDir = path.join(full, "Contents", "MacOS");
        const hasExecutable = fs
          .readdirSync(executableDir, { withFileTypes: true })
          .some(
            (binary) =>
              binary.isFile() &&
              (fs.statSync(path.join(executableDir, binary.name)).mode &
                0o111) !==
                0,
          );
        if (
          hasExecutable &&
          fs.statSync(path.join(full, "Contents", "Info.plist")).isFile()
        )
          return full;
      } catch {
        /* Incomplete bundles are replaced by a fresh verified download. */
      }
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.endsWith(".app")) {
      const found = findAppBundle(path.join(dirPath, entry.name), maxDepth - 1);
      if (found) return found;
    }
  }
  return null;
}

function openApp(appPath) {
  const result = spawnSync("open", [appPath], { stdio: "inherit" });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Failed to open app: ${result.error?.message ?? `exit ${result.status}`}. If Gatekeeper blocked it, check System Settings → Privacy & Security.`,
    );
  }
}

function cachedApp(versionDir, tag, asset) {
  try {
    const marker = JSON.parse(
      fs.readFileSync(path.join(versionDir, ".ready"), "utf8"),
    );
    if (
      marker.schema !== CACHE_SCHEMA ||
      marker.provider !== "codex" ||
      marker.tag !== tag ||
      marker.asset !== ASSET_NAME
    )
      return null;
    if (
      marker.assetId !== asset.id ||
      marker.assetUpdatedAt !== asset.updated_at
    )
      return null;
    if (asset.digest && asset.digest !== `sha256:${marker.sha256}`) return null;
    return findAppBundle(path.join(versionDir, "extract"));
  } catch {
    return null;
  }
}

// Dependencies are injectable so release verification is testable without a Mac or network.
export async function run(
  argv,
  {
    platform = process.platform,
    cacheDir = CACHE_DIR,
    fetchJson = httpsGetJson,
    download = downloadToFile,
    extract = extractZip,
    open = openApp,
  } = {},
) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (platform !== "darwin")
    throw new Error(
      "The release launcher supports macOS only. Build the app from source for other platforms.",
    );
  fs.mkdirSync(cacheDir, { recursive: true });
  await withLock(path.join(cacheDir, "download.lock"), async () => {
    let release;
    try {
      release = await fetchJson(
        args.version
          ? `${RELEASE_API}/tags/${encodeURIComponent(args.version)}`
          : `${RELEASE_API}/latest`,
      );
    } catch (error) {
      if (error.statusCode === 404)
        throw new Error(
          "Codex release not found. Publish a Codex release or use --version with an existing Codex tag. Private repositories require GITHUB_TOKEN.",
        );
      throw error;
    }
    const tag = normalizeTag(release?.tag_name ?? "");
    if (args.version && args.version !== tag)
      throw new Error(
        "GitHub returned a different release version than requested.",
      );
    const asset = pickAsset(release); // Check the release identity before accepting any old cache.
    const versionDir = path.join(cacheDir, tag);
    let appPath = args.force ? null : cachedApp(versionDir, tag, asset);
    if (!appPath) {
      const stagingDir = fs.mkdtempSync(path.join(cacheDir, `${tag}.tmp-`));
      try {
        const expected = await expectedChecksum(
          release,
          asset,
          stagingDir,
          args,
          download,
        );
        const zipPath = path.join(stagingDir, ASSET_NAME);
        log(`Downloading Codex Office (${tag})...`, args);
        await download(asset.url || asset.browser_download_url, zipPath, args);
        const actual = await sha256File(zipPath);
        if (actual !== expected)
          throw new Error(
            `Checksum mismatch for ${ASSET_NAME}. Expected ${expected}; received ${actual}.`,
          );
        const extractDir = path.join(stagingDir, "extract");
        extract(zipPath, extractDir);
        const stagedApp = findAppBundle(extractDir);
        if (!stagedApp)
          throw new Error(
            `Verified archive does not contain a complete ${APP_NAME} bundle.`,
          );
        const relativeApp = path.relative(stagingDir, stagedApp);
        fs.writeFileSync(
          path.join(stagingDir, ".ready"),
          JSON.stringify({
            schema: CACHE_SCHEMA,
            provider: "codex",
            tag,
            asset: ASSET_NAME,
            assetId: asset.id,
            assetUpdatedAt: asset.updated_at,
            sha256: actual,
          }),
        );
        // Keep the last working installation until its replacement has been verified.
        fs.rmSync(versionDir, { recursive: true, force: true });
        fs.renameSync(stagingDir, versionDir);
        appPath = path.join(versionDir, relativeApp);
      } finally {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    }
    log(`Launching Codex Office: ${appPath}`, args);
    open(appPath);
  });
}

if (
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `[agents-office] ${error?.message ?? String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
