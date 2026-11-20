// Runs a Node script under the host's WebAssembly stack-switching flag.
//
// The flag's name moved: Node 22–26 calls it `--experimental-wasm-wasmfx`,
// Node 27 calls it `--wasm-wasmfx`. `process.allowedNodeEnvironmentFlags` is
// the engine's own answer to "which flags do I know", so this picks the one
// this Node accepts instead of pinning a name that ages out.
//
// If neither is known, the target still runs — `tests/rt/gate4.js` then prints
// its named skip for "core stack switching not enabled" and exits 0. That is
// the repo's convention: skip only when the feature is genuinely absent, never
// to hide another failure.

import { spawnSync } from "node:child_process";

const candidates = ["--experimental-wasm-wasmfx", "--wasm-wasmfx"];
const flag = candidates.find((name) =>
  spawnSync(process.execPath, [name, "-e", "0"], { stdio: "ignore" }).status === 0
);
const target = process.argv[2];

if (!target) {
  console.error("usage: node scripts/run-wasmfx.js <script> [args…]");
  process.exit(2);
}

const args = flag ? [flag, target, ...process.argv.slice(3)] : [target, ...process.argv.slice(3)];
const result = spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
