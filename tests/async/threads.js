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
function globalsAfterStart(wasmPath, bytes, wants, gc = false) {
  let escaped = "";
  for (let i = 0; i < bytes.length; ++i) {
    escaped += "\\" + bytes[i].toString(16).padStart(2, "0");
  }
  const wastPath = join(dirname(wasmPath), "probe.globals.wast");
  writeFileSync(wastPath, [
    gc
      ? `(module $env (type $str (array (mut i16))) (func (export "abort") (param (ref null $str) (ref null $str) i32 i32)))`
      : `(module $env (func (export "abort") (param i32 i32 i32 i32)))`,
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

// ---------------------------------------------------------------------------
// 3b. `SlotRing`: a bounded ring of i32 slot indices over atomics.
// ---------------------------------------------------------------------------

console.log("\n# 3b the slot ring");
{
  // `--enable threads` is *not* passed: the shell implies the atomics feature
  // (§8.5 — the ring is the executor's queue), and a user who writes `await`
  // should not have to know that.
  const source = `
import { SlotRing } from "~lib/thread";
async function leaf(): i32 { return 0; }
export async function main(): i32 {
  await leaf();
  let r = new SlotRing(4);
  let emptyOk = r.pop() == -1;
  r.push(10); r.push(20); r.push(30);
  let depthOk = r.depth == 3;
  let orderOk = r.pop() + r.pop() + r.pop() == 60;
  r.push(1); r.push(2); r.push(3); r.push(4);
  let fullOk = !r.push(5) && r.depth == 4;
  return (emptyOk ? 1 : 0) + (depthOk ? 10 : 0) + (orderOk ? 100 : 0) + (fullOk ? 1000 : 0);
}
`;
  const built = compile(source);
  check("a program using SlotRing compiles without --enable threads",
    built.error === undefined, true);
  if (!built.error) {
    try {
      check("the ring's accesses are atomic",
        /i32\.atomic\.(load|store|rmw)/.test(built.wat), true);
      check("the ring's storage is an Int32Array over linear memory",
        /\$~lib\/typedarray\/Int32Array#constructor/.test(built.wat), true);
      if (wasmtime != null) {
        const ran = globalsAfterStart(built.wasmPath, built.bytes, [["__asyncStatus", 1111]]);
        // empty (-1) + depth + FIFO order + full-refuses, as four bits.
        check("push/pop/depth/-1/full: the answer is 1111", ran.ok, true);
      }
    } finally {
      built.dispose();
    }
  }
  const gc = compile(source, ["--wasmGc"]);
  check("the same ring compiles on the GC ABI", gc.error === undefined, true);
  if (!gc.error) {
    try {
      if (wasmtime != null) {
        const ran = globalsAfterStart(gc.wasmPath, gc.bytes, [["__asyncStatus", 1111]], true);
        check("the GC ABI answers 1111 too", ran.ok, true);
      }
    } finally {
      gc.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// 3c. `Executor.step` — one iteration, programmable, observed.
// ---------------------------------------------------------------------------

console.log("\n# 3c the executor and its step");
{
  // The program installs a COUNTING step on main: it counts its own calls and
  // then does main's work — one ready slot per iteration at first, two at
  // second. If the step were baked in, the second number could not differ.
  const source = `
import { mainExecutor, driveReady, __drainInbox, Executor } from "~lib/thread";

let mode: i32 = 0;
let calls: i32 = 0;
export let firstCount: i32 = 0;
export let secondCount: i32 = 0;

function counting(e: Executor): bool {
  calls++;
  __drainInbox(e);
  driveReady(e);
  if (mode == 1) driveReady(e);
  return false;
}

async function inner(): i32 { return 0; }
async function leaf(x: i32): i32 { await inner(); return x; }

export async function main(): i32 {
  mainExecutor().step = counting;
  let a = leaf(1); let b = leaf(2); let c = leaf(3);
  let s1 = (await a) + (await b) + (await c);
  firstCount = calls;
  calls = 0;
  mode = 1;
  let d = leaf(4); let e = leaf(5); let f = leaf(6);
  let s2 = (await d) + (await e) + (await f);
  secondCount = calls;
  return s1 * 1000 + s2;
}
`;
  const built = compile(source);
  check("a program that replaces main's step compiles", built.error === undefined, true);
  if (!built.error) {
    try {
      check("the loop calls the step field, not an inlined mainStep",
        /Executor#get:step/.test(built.wat), true);
      check("the loop guards on the stop flag",
        /Executor#get:stop/.test(built.wat), true);
      if (wasmtime != null) {
        const ran = globalsAfterStart(built.wasmPath, built.bytes, [["__asyncStatus", 6015]]);
        check("the replaced step still produces the awaited values (6015)", ran.ok, true);
        // 1 + 2 + 3 and 4 + 5 + 6 under a step that runs one slot per
        // iteration, then the same work at two slots per iteration: fewer calls.
        const first = globalsAfterStart(built.wasmPath, built.bytes,
          [["firstCount", 6], ["secondCount", 3]]);
        check("the counting step ran 6 iterations, then 3 with two drives each",
          first.ok, true);
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
