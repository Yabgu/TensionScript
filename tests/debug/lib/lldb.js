// Resolve an lldb executable for the debug harness.
//
// Route A (primary) is the `@debugmcp/codelldb-<platform>` family: CodeLLDB's
// vendored lldb binaries published to npm, declared as optionalDependencies in
// package.json so a platform only installs its own package.
//
// Route B (@eqrion/lldb-wasm) is a fallback for a machine where Route A has no
// package. It was measured absent from npm when this harness landed
// (`npm view @eqrion/lldb-wasm` -> E404), so the route exists to fail with the
// reason rather than to guess at an API nobody could inspect.
//
// The runner imports this module, never a package directly: swapping lldb's
// delivery must not touch the runner.

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

const PLATFORM_PACKAGES = {
  "linux-x64": "@debugmcp/codelldb-linux-x64",
  "darwin-x64": "@debugmcp/codelldb-darwin-x64",
  "darwin-arm64": "@debugmcp/codelldb-darwin-arm64",
  "win32-x64": "@debugmcp/codelldb-win32-x64",
};

function platformKey() {
  return `${process.platform}-${process.arch}`;
}

function routeA() {
  const key = platformKey();
  const pkg = PLATFORM_PACKAGES[key];
  if (!pkg) throw new Error(`no CodeLLDB package is declared for ${key}`);

  const pkgJson = require.resolve(`${pkg}/package.json`);
  const root = path.dirname(pkgJson);
  const names = process.platform === "win32" ? ["lldb.exe", "lldb"] : ["lldb"];
  const executable = names
    .map((name) => path.join(root, "lldb", "bin", name))
    .find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error(`${pkg} is installed but has no lldb binary under ${path.join(root, "lldb", "bin")}`);
  }
  const version = JSON.parse(fs.readFileSync(pkgJson, "utf8")).version;
  return { executable, kind: "cli", route: "A", package: pkg, version };
}

async function routeB() {
  let mod;
  try {
    mod = await import("@eqrion/lldb-wasm");
  } catch (error) {
    throw new Error(
      `@eqrion/lldb-wasm did not resolve (${error.code || error.message}); ` +
        "it is not published under that name on npm",
      { cause: error }
    );
  }
  // A wasm lldb exposes a library API, not a process. Wrapping it needs an
  // adapter written against its actual surface; none exists in this tree and
  // the package could not be inspected because it does not resolve.
  if (typeof mod?.default !== "function" && typeof mod?.createLLDB !== "function") {
    throw new Error("@eqrion/lldb-wasm resolved but exposes no known lldb entry point");
  }
  throw new Error("@eqrion/lldb-wasm resolved but no adapter is implemented in tests/debug/lib");
}

/**
 * @returns {Promise<{executable: string, kind: "cli", route: "A"|"B", package: string, version: string}>}
 */
export async function resolveLldb() {
  let primary;
  try {
    return routeA();
  } catch (error) {
    primary = error;
  }
  try {
    return await routeB();
  } catch (fallback) {
    throw new Error(
      "no lldb route resolved; install the @debugmcp/codelldb-* package for this platform " +
        `(npm install).\n  route A: ${primary.message}\n  route B: ${fallback.message}`,
      { cause: fallback }
    );
  }
}

/** The lldb build string, e.g. "lldb version 20.1.4-codelldb". */
export function lldbBuildString(executable) {
  const out = execFileSync(executable, ["--version"], { encoding: "utf8" });
  return out.split("\n")[0].trim();
}

/** One line naming the route and version, for the runner's log. */
export function describeLldb(info, build) {
  return `lldb: route ${info.route} ${info.package}@${info.version} (${info.executable}; ${build})`;
}
