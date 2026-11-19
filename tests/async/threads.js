// Round VT1, Gate 3: the shared start table, the slot ring, the executor, and
// the guest half of the threading ABI.
//
// Gate 3 is deliberately single-threaded. `__startThread` and `__executorCount`
// are host imports and belong to Gate 4; `__spawnOn`, `__serveOne` and
// `__drainInbox` are guest functions (`docs/task-design.md` §8.5), which is what
// makes everything here runnable on bare wasmtime.
//
// Sections, one per gate:
//   3a  `$starts` — a funcref table with a deterministic index order, exported.
//   3b  `SlotRing` — a bounded ring of i32 slot indices over atomics.
//   3c  `Executor` — a programmable `step` field, and main's loop as its default.
//   3d  `__spawnOn` / `__serveOne` / `__drainInbox` — a posted request is served.
//
// Run: npm run test:threads (or `node tests/async/threads.js`).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "..", "..", "bin", "tensionscript.js");

let failures = 0;
let checks = 0;

function check(name, actual, expected) {
  ++checks;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok  ${name}`);
  } else {
    ++failures;
    console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
  }
}

function wasmtimeVersion() {
  try {
    return execFileSync("wasmtime", ["--version"], { encoding: "utf8", stdio: "pipe" }).trim();
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
const wasmtime = wasmtimeVersion();
if (wasmtime == null) {
  if (process.env.REQUIRE_WASMTIME === "1") {
    console.log("FAIL: wasmtime not found on PATH, and REQUIRE_WASMTIME=1");
    process.exit(1);
  }
  console.log("SKIP: wasmtime not found on PATH — the executor only runs under stack switching");
} else {
  console.log(`# wasmtime: ${wasmtime}`);
}

/** Compiles `source` with the stackful backend and returns the artefacts. */
function compile(source, extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), "async-threads-"));
  const tsPath = join(dir, "probe.ts");
  const wasmPath = join(dir, "probe.wasm");
  const watPath = join(dir, "probe.wat");
  writeFileSync(tsPath, source);
  try {
    execFileSync(process.execPath, [
      CLI, "probe.ts", "-o", "probe.wasm", "--textFile", "probe.wat",
      "--runtime", "stub", "--noColors", "--enable", "stack-switching",
      ...extraArgs,
    ], { stdio: "pipe", cwd: dir });
  } catch (error) {
    const output = `${error.stderr ?? ""}${error.stdout ?? ""}`;
    rmSync(dir, { recursive: true, force: true });
    return { error: output };
  }
  return {
    wat: readFileSync(watPath, "utf8"),
    bytes: readFileSync(wasmPath),
    wasmPath,
    dispose() { rmSync(dir, { recursive: true, force: true }); },
  };
}

/**
 * Instantiates the module (its start function runs the shell) and answers the
 * exports named in `wants` — the exported globals' values after start.
 *
 * `wasmtime wast`, because the CLI cannot print a global. The allocator's OOM
 * path names `env.abort`; the fixtures never take it, and the script supplies a
 * stub so instantiation succeeds.
 */
function globalsAfterStart(wasmPath, bytes, wants) {
  let escaped = "";
  for (let i = 0; i < bytes.length; ++i) {
    escaped += "\\" + bytes[i].toString(16).padStart(2, "0");
  }
  const wastPath = join(dirname(wasmPath), "probe.globals.wast");
  writeFileSync(wastPath, [
    `(module $env (func (export "abort") (param i32 i32 i32 i32)))`,
    `(register "env" $env)`,
    `(module $m binary "${escaped}")`,
    `(register "m" $m)`,
    ...wants.map(([name, value]) => `(assert_return (get $m "${name}") (i32.const ${value}))`),
    "",
  ].join("\n"));
  try {
    execFileSync("wasmtime", ["wast", "-W", "stack-switching=y", wastPath], { stdio: "pipe" });
    return { ok: true };
  } catch (error) {
    return { ok: false, output: `${error.stderr ?? ""}${error.stdout ?? ""}` };
  }
}

// ---------------------------------------------------------------------------
// 3a. `$starts`: a funcref table, deterministic, exported.
// ---------------------------------------------------------------------------

console.log("\n# 3a the shared start table");
{
  const source = `
async function leaf(): i32 { return 0; }
async function a(): i32 { await leaf(); return 1; }
async function b(): i32 { await leaf(); return 2; }
export async function main(): i32 {
  let x = a();
  let y = b();
  return (await x) + (await y);
}
`;
  const built = compile(source);
  check("the fixture compiles", built.error === undefined, true);
  if (!built.error) {
    try {
      const wat = built.wat;
      check("a `$starts` table is declared",
        /\(table \$\$starts \d+ \d+ funcref\)/.test(wat), true);
      check("it is exported as \"$starts\"",
        /\(export "\$starts" \(table \$\$starts\)\)/.test(wat), true);
      const elem = wat.match(/\(elem \$\$starts\$elem[^\n]*/);
      check("the element segment fills index 0.. in program order",
        elem != null && /i32\.const 0\) func \$probe\/a\$start \$probe\/b\$start/.test(elem[0]), true);
      check("the entry points are in the table too",
        elem != null && /\$~asyncMainStart/.test(elem[0]), true);

      // The index order must be a function of the program, not of a hash order.
      const again = compile(source);
      const elemAgain = again.error ? null : again.wat.match(/\(elem \$\$starts\$elem[^\n]*/);
      check("the same source emits the same index order",
        elemAgain != null && elem[0] === elemAgain[0], true);
      if (!again.error) again.dispose();

      // The binary says it too: `wasm-tools print` is an independent reader.
      let printed = null;
      try {
        printed = execFileSync("wasm-tools", ["print", built.wasmPath], { encoding: "utf8", stdio: "pipe" });
      } catch { /* wasm-tools absent: the WAT assertions above still stand */ }
      if (printed != null) {
        check("wasm-tools print shows the $starts export",
          /\(export "\$starts" \(table \d+\)\)/.test(printed), true);
      }

      if (wasmtime != null) {
        const ran = globalsAfterStart(built.wasmPath, built.bytes, [["__asyncStatus", 3]]);
        check("the module still runs (status 1 + 2)", ran.ok, true);
      }
    } finally {
      built.dispose();
    }
  }
}

if (failures) {
  console.error(`\nthreads: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\n[ SUCCESS ] ${checks} checks`);
