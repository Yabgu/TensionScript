// Resolve the standalone Wasmtime that serves as the debug inferior.
//
// The harness used to debug `tension-core`, which embeds wasmtime 24.0.13
// (tension-core/Cargo.toml pins `wasmtime = "=24.0.13"`). This module removes
// that dependency without changing what the debugger sees: it fetches
// `wasmtime-cli` at the same version, so the DWARF consumer is the same one
// that produced the committed baseline.
//
// Version choice is measured, not assumed (Prompt D, pre-work):
//   * 24.0.13, default opt level  -> identical stops and variables to the
//     embedded 24.0.13 the baseline was captured against.
//   * 44.0.0 / 48.0.0            -> a line-10 breakpoint resolves into `add`.
//   * 50.0.1, -O0                -> line 10 resolves correctly but `i` has no
//     location, where 24 showed 5.
// So the pin stays at 24.0.13 until a newer consumer is measured to be at
// least as precise (see tests/debug/README.md).
//
// A prebuilt release tarball is used rather than `cargo install`: measured at
// landing, the download is ~2.8 s and 8.5 MB, the cargo build 6 m 42 s and
// 73 MB. Each platform's tarball is pinned by SHA-256.

import { createHash } from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const debugRoot = path.resolve(here, "..");
const cacheRoot = path.join(debugRoot, ".cache");

/** The version pin lives in one file so a bump is a one-line review. */
export const pinnedVersion = fs
  .readFileSync(path.join(debugRoot, "wasmtime.version"), "utf8")
  .trim();

/**
 * Release assets for the pinned version. `name` is the asset filename; the
 * extracted directory is the filename without its archive suffix.
 */
const ASSETS = {
  "linux-x64": {
    name: "wasmtime-v24.0.13-x86_64-linux.tar.xz",
    sha256: "6a81ae0c0a47915f5b739a8c6905c2f74dc7e79a883ab3e2db858015d0980a5a",
    dir: "wasmtime-v24.0.13-x86_64-linux",
    exe: "wasmtime",
  },
  "linux-arm64": {
    name: "wasmtime-v24.0.13-aarch64-linux.tar.xz",
    sha256: "1aaff5cc5c0ce901a36fe2d600cf6d9965a710f75d86f78383343bf69efb73eb",
    dir: "wasmtime-v24.0.13-aarch64-linux",
    exe: "wasmtime",
  },
  "darwin-x64": {
    name: "wasmtime-v24.0.13-x86_64-macos.tar.xz",
    sha256: "7f2ce6643e5488f3725d42991ed8f67febdd0fd044126c3dce396ea8dfb0fc30",
    dir: "wasmtime-v24.0.13-x86_64-macos",
    exe: "wasmtime",
  },
  "darwin-arm64": {
    name: "wasmtime-v24.0.13-aarch64-macos.tar.xz",
    sha256: "712af9df269abc7aa32b895edbfd043c1c465a2d14667fb2117f732cad59735d",
    dir: "wasmtime-v24.0.13-aarch64-macos",
    exe: "wasmtime",
  },
  "win32-x64": {
    name: "wasmtime-v24.0.13-x86_64-mingw.zip",
    sha256: "7958c6a3c9e95a72c17274822fa84151d1cfb8de42196927e16d905acf68d34e",
    dir: "wasmtime-v24.0.13-x86_64-mingw",
    exe: "wasmtime.exe",
  },
};

function assetForPlatform() {
  const key = `${process.platform}-${process.arch}`;
  const asset = ASSETS[key];
  if (!asset) {
    throw new Error(
      `no pinned Wasmtime asset for ${key}; add one to tests/debug/lib/wasmtime.js ` +
        `(version ${pinnedVersion} is pinned in tests/debug/wasmtime.version)`
    );
  }
  return asset;
}

function download(url, destination, redirects = 0) {
  if (redirects > 5) throw new Error(`too many redirects fetching ${url}`);
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "user-agent": "tensionscript-debug-harness" } }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          download(response.headers.location, destination, redirects + 1).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`GET ${url} -> HTTP ${response.statusCode}`));
          return;
        }
        const sink = fs.createWriteStream(destination);
        response.pipe(sink);
        sink.on("finish", () => sink.close(() => resolve(destination)));
        sink.on("error", reject);
      })
      .on("error", reject);
  });
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** Runs `<exe> --version` and returns the first line. */
export function wasmtimeVersion(executable) {
  const result = spawnSync(executable, ["--version"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`\`${executable} --version\` failed: ${result.stderr || result.stdout}`);
  }
  return (result.stdout || "").split("\n")[0].trim();
}

/**
 * @returns {Promise<{executable: string, version: string, pinned: string}>}
 */
export async function resolveWasmtime({ log = () => {} } = {}) {
  const asset = assetForPlatform();
  const installDir = path.join(cacheRoot, `wasmtime-${pinnedVersion}`);
  const executable = path.join(installDir, asset.exe);

  if (fs.existsSync(executable)) {
    const version = wasmtimeVersion(executable);
    if (!version.includes(pinnedVersion)) {
      throw new Error(
        `cached ${executable} reports "${version}", expected ${pinnedVersion}; ` +
          `delete ${installDir} to reinstall`
      );
    }
    return { executable, version, pinned: pinnedVersion };
  }

  log(`installing wasmtime ${pinnedVersion} (${asset.name})`);
  const downloads = path.join(cacheRoot, "downloads");
  fs.mkdirSync(downloads, { recursive: true });
  fs.mkdirSync(installDir, { recursive: true });

  const archive = path.join(downloads, asset.name);
  if (!fs.existsSync(archive)) {
    const url = `https://github.com/bytecodealliance/wasmtime/releases/download/v${pinnedVersion}/${asset.name}`;
    await download(url, archive);
  }

  const digest = sha256(archive);
  if (digest !== asset.sha256) {
    fs.rmSync(archive, { force: true });
    throw new Error(
      `checksum mismatch for ${asset.name}: got ${digest}, expected ${asset.sha256}`
    );
  }

  // `tar` reads both .tar.xz and .zip on the platforms this pins.
  const extracted = spawnSync("tar", ["-xf", archive, "-C", installDir], { encoding: "utf8" });
  if (extracted.status !== 0) {
    throw new Error(`could not extract ${archive}: ${extracted.stderr}`);
  }

  const nested = path.join(installDir, asset.dir, asset.exe);
  if (fs.existsSync(nested)) {
    fs.copyFileSync(nested, executable);
    fs.chmodSync(executable, 0o755);
    fs.rmSync(path.join(installDir, asset.dir), { recursive: true, force: true });
  }
  if (!fs.existsSync(executable)) {
    throw new Error(`extracted ${asset.name} but found no ${asset.exe}`);
  }

  const version = wasmtimeVersion(executable);
  if (!version.includes(pinnedVersion)) {
    throw new Error(`installed wasmtime reports "${version}", expected ${pinnedVersion}`);
  }
  return { executable, version, pinned: pinnedVersion };
}

/** One line naming the version and path, for the runner's log. */
export function describeWasmtime(info) {
  return `wasmtime: ${info.version} (${info.executable}; pinned ${info.pinned})`;
}
