import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  ASSET_NAME,
  parseArgs,
  normalizeTag,
  withLock,
  requestHeaders,
  downloadToFile,
  httpsGetJson,
  parseChecksum,
  pickAsset,
  run,
} from "../../cli/agents-office.mjs";

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-office-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function fakeRequest(responses, calls = []) {
  return (url, options, callback) => {
    calls.push({ url, ...options });
    const req = new EventEmitter();
    req.setTimeout = () => req;
    req.destroy = (error) => req.emit("error", error);
    req.end = () =>
      queueMicrotask(() => {
        const next = responses.shift();
        if (!next) return req.emit("error", new Error("Unexpected request"));
        const response = next.stream ?? Readable.from([next.body ?? ""]);
        response.statusCode = next.status ?? 200;
        response.headers = next.headers ?? {};
        callback(response);
      });
    return req;
  };
}

function fixture(t, { digest = true } = {}) {
  const cacheDir = tempDir(t);
  const bytes = Buffer.from("fixture zip bytes");
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const release = {
    tag_name: "v0.2.0",
    assets: [
      {
        name: ASSET_NAME,
        id: 101,
        updated_at: "2026-09-12T00:00:00Z",
        url: "https://api.github.com/assets/101",
        ...(digest ? { digest: `sha256:${hash}` } : {}),
      },
    ],
  };
  const calls = { download: [], opened: [], extracted: [] };
  const deps = {
    platform: "darwin",
    cacheDir,
    fetchJson: async () => release,
    download: async (url, dest) => {
      calls.download.push(url);
      fs.writeFileSync(dest, bytes);
    },
    extract: (zip, out) => {
      calls.extracted.push(zip);
      const contents = path.join(out, "Agents Office.app", "Contents");
      fs.mkdirSync(path.join(contents, "MacOS"), { recursive: true });
      fs.writeFileSync(path.join(contents, "Info.plist"), "fixture plist");
      fs.writeFileSync(
        path.join(contents, "MacOS", "agents-office"),
        "fixture executable",
        { mode: 0o755 },
      );
    },
    open: (app) => calls.opened.push(app),
  };
  return { cacheDir, release, deps, bytes, hash, calls };
}

const quiet = ["--quiet"];

test("arguments normalize tags and reject typos, missing values and paths", () => {
  assert.deepEqual(parseArgs(["-v", "0.2.0-rc.1", "--force", "-q"]), {
    version: "v0.2.0-rc.1",
    force: true,
    quiet: true,
    help: false,
  });
  for (const args of [
    ["--froce"],
    ["--version"],
    ["--version", "--force"],
    ["unexpected"],
    ["-v", "../../outside"],
  ]) {
    assert.throws(
      () => parseArgs(args),
      /Unknown argument|requires a release version|Invalid version/,
    );
  }
  assert.throws(() => normalizeTag("v0.2.0/../../outside"), /Invalid version/);
});

test("the npm bin symlink executes the launcher and invalid flags exit nonzero", (t) => {
  const executable = fileURLToPath(
    new URL("../../cli/agents-office.mjs", import.meta.url),
  );
  const symlink = path.join(tempDir(t), "agents-office");
  fs.symlinkSync(executable, symlink);
  const help = spawnSync(process.execPath, [symlink, "--help"], {
    encoding: "utf8",
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Codex Office/);
  const invalid = spawnSync(process.execPath, [symlink, "--froce"], {
    encoding: "utf8",
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Unknown argument/);
});

test("asynchronous lock stays held until the callback settles and serializes contenders", async (t) => {
  const lock = path.join(tempDir(t), "download.lock");
  const order = [];
  let releaseFirst;
  const gate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const first = withLock(lock, async () => {
    order.push("first start");
    await gate;
    order.push("first end");
  });
  assert.equal(fs.existsSync(lock), true);
  const second = withLock(
    lock,
    async () => {
      order.push("second");
    },
    { pollMs: 1 },
  );
  await delay(10);
  assert.deepEqual(order, ["first start"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["first start", "first end", "second"]);
  assert.equal(fs.existsSync(lock), false);
});

test("callback failures release the lock without treating EEXIST as contention", async (t) => {
  const lock = path.join(tempDir(t), "download.lock");
  const failure = Object.assign(new Error("callback failure"), {
    code: "EEXIST",
  });
  await assert.rejects(
    withLock(lock, async () => {
      await delay(1);
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(fs.existsSync(lock), false);
});

test("lock timeout does not delete another process's lock", async (t) => {
  const lock = path.join(tempDir(t), "download.lock");
  fs.writeFileSync(lock, "owned");
  await assert.rejects(
    withLock(lock, () => assert.fail(), { timeoutMs: 2, pollMs: 1 }),
    /lock timeout/,
  );
  assert.equal(fs.readFileSync(lock, "utf8"), "owned");
});

test("GitHub credentials are confined to the HTTPS API origin", () => {
  assert.equal(
    requestHeaders("https://api.github.com/repos/a/b", "x", "secret")
      .Authorization,
    "Bearer secret",
  );
  for (const url of [
    "https://github.com/a/b",
    "https://storage.example/a",
    "https://api.github.com.evil.test/a",
    "https://api.github.com:8443/a",
  ]) {
    assert.equal(requestHeaders(url, "x", "secret").Authorization, undefined);
  }
  for (const url of [
    "http://api.github.com/a",
    "https://secret@api.github.com/a",
  ])
    assert.throws(() => requestHeaders(url, "x", "secret"), /HTTPS/);
});

test("redirects resolve relative URLs and strip credentials for asset storage", async (t) => {
  const dest = path.join(tempDir(t), "app.zip");
  const previous = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "test-secret";
  t.after(() => {
    if (previous === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous;
  });
  const calls = [];
  const request = fakeRequest(
    [
      { status: 302, headers: { location: "/assets/redirect" } },
      { status: 302, headers: { location: "https://storage.example/app.zip" } },
      { body: "downloaded bytes" },
    ],
    calls,
  );
  await downloadToFile("https://api.github.com/assets/101", dest, {
    quiet: true,
    request,
  });
  assert.equal(calls[1].url, "https://api.github.com/assets/redirect");
  assert.equal(calls[0].headers.Authorization, "Bearer test-secret");
  assert.equal(calls[2].headers.Authorization, undefined);
  assert.equal(fs.readFileSync(dest, "utf8"), "downloaded bytes");
});

test("redirect loops and HTTPS downgrades fail with no partial files", async (t) => {
  const dir = tempDir(t);
  const dest = path.join(dir, "app.zip");
  await assert.rejects(
    downloadToFile("https://api.github.com/a", dest, {
      quiet: true,
      request: fakeRequest(
        Array.from({ length: 6 }, () => ({
          status: 302,
          headers: { location: "/a" },
        })),
      ),
    }),
    /Too many/,
  );
  await assert.rejects(
    downloadToFile("https://api.github.com/a", dest, {
      quiet: true,
      request: fakeRequest([
        { status: 302, headers: { location: "http://storage.example/a" } },
      ]),
    }),
    /HTTPS/,
  );
  assert.deepEqual(fs.readdirSync(dir), []);
});

test("an interrupted download preserves the destination and removes temporary files", async (t) => {
  const dir = tempDir(t);
  const dest = path.join(dir, "app.zip");
  fs.writeFileSync(dest, "known good");
  const stream = new Readable({
    read() {
      this.push("partial");
      this.destroy(new Error("transfer interrupted"));
    },
  });
  await assert.rejects(
    downloadToFile("https://api.github.com/a", dest, {
      quiet: true,
      request: fakeRequest([{ stream }]),
    }),
    /transfer interrupted/,
  );
  assert.equal(fs.readFileSync(dest, "utf8"), "known good");
  assert.deepEqual(fs.readdirSync(dir), ["app.zip"]);
});

test("release JSON errors retain HTTP status and reject malformed JSON", async () => {
  await assert.rejects(
    httpsGetJson("https://api.github.com/a", {
      request: fakeRequest([{ status: 404 }]),
    }),
    (error) => error.statusCode === 404,
  );
  await assert.rejects(
    httpsGetJson("https://api.github.com/a", {
      request: fakeRequest([{ body: "not JSON" }]),
    }),
    /invalid release JSON/,
  );
});

test("checksums require a complete hash and exact filename", () => {
  const hash = "a".repeat(64);
  assert.equal(parseChecksum(`${hash}  ${ASSET_NAME}\n`, ASSET_NAME), hash);
  assert.equal(
    parseChecksum(`${hash.toUpperCase()} *${ASSET_NAME}\r\n`, ASSET_NAME),
    hash,
  );
  assert.equal(parseChecksum(hash, ASSET_NAME, true), hash);
  assert.throws(
    () => parseChecksum(`${hash}  ${ASSET_NAME}.malicious`, ASSET_NAME),
    /No valid/,
  );
  assert.throws(
    () => parseChecksum(`abc  ${ASSET_NAME}`, ASSET_NAME),
    /No valid/,
  );
  assert.throws(() => parseChecksum(hash, ASSET_NAME), /No valid/);
});

test("legacy release assets cannot pass the Codex release gate", () => {
  assert.throws(
    () =>
      pickAsset({
        assets: [
          {
            name: "Agents-Office-macos.zip",
            browser_download_url: "https://github.com/old",
          },
        ],
      }),
    /no Codex app/,
  );
});

test("unsupported platforms fail before creating cache or using the network", async (t) => {
  const cacheDir = path.join(tempDir(t), "unused");
  await assert.rejects(
    run([], { platform: "linux", cacheDir, fetchJson: () => assert.fail() }),
    /macOS only/,
  );
  assert.equal(fs.existsSync(cacheDir), false);
});

test("a verified Codex installation launches and is reused on subsequent runs", async (t) => {
  const { deps, calls, cacheDir } = fixture(t);
  await run(quiet, deps);
  await run(quiet, deps);
  assert.equal(calls.download.length, 1);
  assert.equal(calls.extracted.length, 1);
  assert.equal(calls.opened.length, 2);
  assert.equal(
    calls.opened[0],
    path.join(cacheDir, "v0.2.0", "extract", "Agents Office.app"),
  );
  assert.deepEqual(fs.readdirSync(cacheDir), ["v0.2.0"]);
});

test("a replaced release asset invalidates its cached installation", async (t) => {
  const { deps, calls, release } = fixture(t);
  await run(quiet, deps);
  release.assets[0].id = 102;
  await run(quiet, deps);
  assert.equal(calls.download.length, 2);
  assert.equal(calls.opened.length, 2);
});

test("legacy cache markers never bypass the Codex release check", async (t) => {
  const { deps, calls, cacheDir, release } = fixture(t);
  const versionDir = path.join(cacheDir, "v0.2.0");
  deps.extract("", path.join(versionDir, "extract"));
  fs.writeFileSync(path.join(versionDir, ".ready"), new Date().toISOString());
  release.assets[0].name = "Agents-Office-macos.zip";
  await assert.rejects(run(quiet, deps), /no Codex app/);
  assert.equal(calls.opened.length, 0);
  assert.equal(calls.download.length, 0);
});

test("old cache markers are replaced only by a verified Codex installation", async (t) => {
  const { deps, calls, cacheDir } = fixture(t);
  const versionDir = path.join(cacheDir, "v0.2.0");
  fs.mkdirSync(versionDir);
  fs.writeFileSync(path.join(versionDir, ".ready"), new Date().toISOString());
  await run(quiet, deps);
  const marker = JSON.parse(
    fs.readFileSync(path.join(versionDir, ".ready"), "utf8"),
  );
  assert.equal(marker.provider, "codex");
  assert.equal(calls.download.length, 1);
});

test("missing checksums fail before downloading or extracting the app", async (t) => {
  const { deps, calls, cacheDir } = fixture(t, { digest: false });
  await assert.rejects(run(quiet, deps), /missing a SHA-256 checksum/);
  assert.equal(calls.download.length, 0);
  assert.equal(calls.extracted.length, 0);
  assert.equal(calls.opened.length, 0);
  assert.deepEqual(fs.readdirSync(cacheDir), []);
});

test("published checksum assets are verified when GitHub supplies no digest", async (t) => {
  const { deps, release, calls, hash, bytes } = fixture(t, { digest: false });
  release.assets.push({
    name: `${ASSET_NAME}.sha256`,
    url: "https://api.github.com/checksum",
  });
  deps.download = async (url, dest) => {
    fs.writeFileSync(
      dest,
      url.endsWith("checksum") ? `${hash}  ${ASSET_NAME}\n` : bytes,
    );
  };
  await run(quiet, deps);
  assert.equal(calls.opened.length, 1);
});

test("checksum failures preserve an existing installation and never launch it as a successful refresh", async (t) => {
  const { deps, calls, cacheDir } = fixture(t);
  await run(quiet, deps);
  const marker = fs.readFileSync(
    path.join(cacheDir, "v0.2.0", ".ready"),
    "utf8",
  );
  deps.download = async (_, dest) => fs.writeFileSync(dest, "tampered");
  await assert.rejects(run([...quiet, "--force"], deps), /Checksum mismatch/);
  assert.equal(calls.opened.length, 1);
  assert.equal(calls.extracted.length, 1);
  assert.equal(
    fs.readFileSync(path.join(cacheDir, "v0.2.0", ".ready"), "utf8"),
    marker,
  );
  assert.deepEqual(fs.readdirSync(cacheDir), ["v0.2.0"]);
});

test("an incomplete verified archive cannot be marked ready or launched", async (t) => {
  const { deps, calls, cacheDir } = fixture(t);
  deps.extract = (_, out) =>
    fs.mkdirSync(path.join(out, "Agents Office.app"), { recursive: true });
  await assert.rejects(run(quiet, deps), /complete Agents Office.app bundle/);
  assert.equal(calls.opened.length, 0);
  assert.deepEqual(fs.readdirSync(cacheDir), []);
});

test("concurrent launcher runs share one verified installation", async (t) => {
  const { deps, calls, bytes } = fixture(t);
  deps.download = async (url, dest) => {
    calls.download.push(url);
    await delay(15);
    fs.writeFileSync(dest, bytes);
  };
  await Promise.all([run(quiet, deps), run(quiet, deps)]);
  assert.equal(calls.download.length, 1);
  assert.equal(calls.opened.length, 2);
});
