// Build (once) and return the tension-core interpreter the harness debugs.
//
// The debug inferior is tension-core, not standalone wasmtime: the host embeds
// wasmtime, calls Config::debug_info, and registers the JIT'd guest with the
// platform debugger through the GDB JIT interface. lldb attaches to that host.
//
// The binary is cached under tests/debug/.cache/, keyed by the Tension checkout's
// HEAD sha and by `rustc --version`, so a language change or a toolchain change
// rebuilds and a repeat run does not.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const debugRoot = path.resolve(here, "..");
const cacheRoot = path.join(debugRoot, ".cache");

/** The Tension checkout: TENSION_REPO, else the canonical sibling of this repo. */
export function tensionRepo() {
  if (process.env.TENSION_REPO) return path.resolve(process.env.TENSION_REPO);
  const sibling = path.resolve(debugRoot, "..", "..", "..", "Tension");
  if (fs.existsSync(path.join(sibling, "tension-core", "Cargo.toml"))) return sibling;
  return path.join(os.homedir(), "work", "Tension");
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options }).trim();
}

function sanitize(text) {
  return text.replace(/[^0-9A-Za-z.]+/g, "-");
}

/**
 * @returns {{binary: string, cachePath: string, sha: string, rustc: string, built: boolean}}
 */
export function resolveTensionCore({ log = () => {} } = {}) {
  const repo = tensionRepo();
  const crate = path.join(repo, "tension-core");
  if (!fs.existsSync(path.join(crate, "Cargo.toml"))) {
    throw new Error(
      `tension-core not found at ${crate}; set TENSION_REPO to the Tension checkout`
    );
  }

  const sha = run("git", ["-C", repo, "rev-parse", "HEAD"]);
  const rustc = run("rustc", ["--version"]);
  const exe = process.platform === "win32" ? "tension-core.exe" : "tension-core";
  const key = `tension-core-${sha.slice(0, 12)}-${sanitize(rustc)}`;
  const cachePath = path.join(cacheRoot, key, exe);

  if (fs.existsSync(cachePath)) {
    return { binary: cachePath, cachePath, sha, rustc, built: false };
  }

  log(`building tension-core at ${sha.slice(0, 12)} (rustc ${rustc})`);
  execFileSync("cargo", ["build", "--release"], { cwd: crate, stdio: "inherit" });

  const builtPath = path.join(crate, "target", "release", exe);
  if (!fs.existsSync(builtPath)) {
    throw new Error(`cargo build --release produced no ${builtPath}`);
  }
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.copyFileSync(builtPath, cachePath);
  fs.chmodSync(cachePath, 0o755);
  return { binary: cachePath, cachePath, sha, rustc, built: true };
}

export function tensionCoreVersion(binary) {
  return run(binary, ["--version"]);
}
