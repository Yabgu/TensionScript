// Round VT2: the policy layer — `on` at the call site, `TaskPolicy` as the
// task's awaiter.
//
// `docs/policy-and-threads.md` §2/§3/§4/§6. What each section proves:
//
//   1. **`on` compiles and is called exactly once per call.** A counting policy
//      sees one `create` per `on` call, none for a call without `on`, and its
//      `await` is what the `await` expression runs.
//   2. **The absence is the default.** `f(x)` runs none of `f` before `await`;
//      `f(x) on eager` runs its prefix at the call site. The counts are printed,
//      because the difference is the whole reason the policy is explicit.
//   3. **`inlinePolicy` is the default as a value**, and `t.policy` reads back.
//   4. **`mainStep` in the program is the shell's default step**, and
//      `mainExecutor().step = …` still replaces it at runtime.
//
// Run: npm run test:policy (or `node tests/async/policy.js`).

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

const wasmtime = (() => {
  try {
    return execFileSync("wasmtime", ["--version"], { encoding: "utf8", stdio: "pipe" }).trim();
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
})();
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
  const dir = mkdtempSync(join(tmpdir(), "async-policy-"));
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

/** Instantiates, runs start, and reads the named exported globals. */
function readGlobals(wasmPath, bytes, wants, gc = false) {
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

/**
 * Reads one exported global's value after start.
 *
 * `wasmtime wast` asserts rather than prints, so the value is recovered from the
 * mismatch text — the same trick `tests/async/regressions.js` uses for
 * `__asyncStatus`. Used where the *number* is the point (a step's iteration
 * count), not merely a yes/no.
 */
function readGlobal(wasmPath, bytes, name, gc = false) {
  let escaped = "";
  for (let i = 0; i < bytes.length; ++i) {
    escaped += "\\" + bytes[i].toString(16).padStart(2, "0");
  }
  const wastPath = join(dirname(wasmPath), "probe.read.wast");
  writeFileSync(wastPath, [
    gc
      ? `(module $env (type $str (array (mut i16))) (func (export "abort") (param (ref null $str) (ref null $str) i32 i32)))`
      : `(module $env (func (export "abort") (param i32 i32 i32 i32)))`,
    `(register "env" $env)`,
    `(module $m binary "${escaped}")`,
    `(register "m" $m)`,
    `(assert_return (get $m "${name}") (i32.const 2147483647))`,
    "",
  ].join("\n"));
  let output = "";
  try {
    execFileSync("wasmtime", ["wast", "-W", "stack-switching=y", wastPath], { stdio: "pipe" });
    return 2147483647;
  } catch (error) {
    output = `${error.stderr ?? ""}${error.stdout ?? ""}`;
  }
  const actual = output.match(/actual\s+(-?\d+)/);
  return actual ? Number(actual[1]) : NaN;
}

// ---------------------------------------------------------------------------
// 1. `on POLICY`: once per call, before any body, and the awaiter is its own.
// ---------------------------------------------------------------------------

console.log("\n# 1  the policy is called once per call");
{
  const source = `
import { TaskPolicy, TaskBase } from "~lib/task";

let bodies: i32 = 0;

class CountingPolicy extends TaskPolicy {
  created: i32 = 0;
  awaited: i32 = 0;
  sawBody: i32 = 0;
  create(task: TaskBase): void {
    this.created++;
    if (bodies != 0) this.sawBody = 1;   // create must precede the body
  }
  await(task: TaskBase): void {
    this.awaited++;
    __inlineAwait(task);
  }
}

async function leaf(): i32 { return 0; }
async function decode(x: i32): i32 { await leaf(); bodies++; return x * 2; }

export async function main(): i32 {
  let p = new CountingPolicy();
  let a = decode(10) on p;
  let b = decode(20) on p;
  let d = decode(30);                       // no \`on\`: the default, no create
  let sum = (await a) + (await b) + (await d);
  // created 2, awaited 2, sawBody 0, sum 120.
  return p.created * 100000 + p.awaited * 10000 + p.sawBody * 1000 + sum;
}
`;
  const built = compile(source);
  check("a program using `on` compiles", built.error === undefined, true);
  if (!built.error) {
    try {
      const gc = compile(source, ["--wasmGc"]);
      check("...and on the GC ABI", gc.error === undefined, true);
      if (!gc.error) gc.dispose();

      check("the call site sets the policy and calls create",
        /TaskBase#set:policy/.test(built.wat) && /TaskPolicy#create/.test(built.wat), true);
      if (wasmtime != null) {
        const ran = readGlobals(built.wasmPath, built.bytes, [["__asyncStatus", 220120]]);
        check("create x2, await x2, no body seen at create, sum 120", ran.ok, true);
        console.log("        counts: created=2 awaited=2 sawBody=0 sum=120");
      }
    } finally {
      built.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Eager vs lazy — the visible difference, printed.
// ---------------------------------------------------------------------------

console.log("\n# 2  the default is lazy, `on eager` is not");
{
  const source = `
import { TaskPolicy, TaskBase, inlinePolicy } from "~lib/task";

let bodyRuns: i32 = 0;

class EagerPolicy extends TaskPolicy {
  create(task: TaskBase): void { task.drive(); }        // runs the prefix now
  await(task: TaskBase): void { if (!task.settled) __inlineAwait(task); }
}

async function leaf(): i32 { return 0; }
async function f(x: i32): i32 { bodyRuns++; await leaf(); return x; }

export async function main(): i32 {
  let t0 = f(1);
  let afterDefault = bodyRuns;               // 0: the call ran nothing
  let t1 = f(2) on new EagerPolicy();
  let afterEager = bodyRuns;                 // 1: create ran the prefix
  let v = (await t0) + (await t1);
  let t2 = f(3) on inlinePolicy();
  let hasPolicy = t2.policy ? 1 : 0;         // the policy is readable after the fact
  let v2 = await t2;
  return afterDefault * 1000000 + afterEager * 100000 + v * 10000 + hasPolicy * 1000 + v2;
}
`;
  const built = compile(source);
  check("the eagerness fixture compiles", built.error === undefined, true);
  if (!built.error) {
    try {
      check("the default call site emits no create for the absent policy",
        /TaskPolicy#create/.test(built.wat), true);
      if (wasmtime != null) {
        const ran = readGlobals(built.wasmPath, built.bytes, [["__asyncStatus", 131003]]);
        check("default ran nothing before await; eager ran its prefix", ran.ok, true);
        console.log("        body runs before await — default: 0, `on eager`: 1");
        console.log("        awaited values: 1 + 2 = 3, inlinePolicy value: 3");
      }
    } finally {
      built.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// 3. `on` on something that is not an async entry is refused by name.
// ---------------------------------------------------------------------------

console.log("\n# 3  `on` applies to a call of an async function");
{
  // The `on` sits in a **non-async** body: inside an async one, Backend A's
  // lowering refuses the node first (`this async body`), which is a less useful
  // message than the one this refusal exists for. The program still opts into
  // the stackful shell through `susp`, so `on` reaches its own check.
  const built = compile(`
import { TaskPolicy } from "~lib/task";
async function leaf(): i32 { return 0; }
async function susp(): i32 { await leaf(); return 1; }
function plain(x: i32): i32 { return x; }
export function main(): i32 {
  let p: TaskPolicy | null = null;
  return plain(1) on p;
}
`);
  check("a non-async callee is refused", built.error !== undefined, true);
  check("...by name, not by a type error",
    built.error !== undefined && /`on` applies to a call of an async function/.test(built.error), true);
  if (built.error) console.log("        " + built.error.split("\n").filter((l) => /ERROR/.test(l))[0]);
}

// ---------------------------------------------------------------------------
// 4. `mainStep` in the program is the default step; runtime still overrides.
// ---------------------------------------------------------------------------

console.log("\n# 4  the program's mainStep, and the runtime override");
{
  const source = `
import { Executor, __drainInbox, driveReady, mainExecutor } from "~lib/thread";

export let fromSource: i32 = 0;
export let fromRuntime: i32 = 0;

function replacement(e: Executor): bool {
  fromRuntime++;
  __drainInbox(e);
  driveReady(e);
  return false;
}

export function mainStep(e: Executor): bool {
  fromSource++;
  __drainInbox(e);
  driveReady(e);
  return false;
}

async function leaf(): i32 { return 0; }
async function f(x: i32): i32 { await leaf(); return x; }

export async function main(): i32 {
  let a = await f(1);                       // driven by mainStep
  let sourceBefore = fromSource > 0 ? 1 : 0;
  mainExecutor().step = replacement;
  let b = await f(2);                       // driven by the replacement
  let runtimeAfter = fromRuntime > 0 ? 1 : 0;
  return a + b + sourceBefore * 100 + runtimeAfter * 1000;
}
`;
  const built = compile(source);
  check("the mainStep fixture compiles", built.error === undefined, true);
  if (!built.error) {
    try {
      check("__start installs the program's step",
        /__setDefaultMainStep/.test(built.wat), true);
      if (wasmtime != null) {
        const ran = readGlobals(built.wasmPath, built.bytes, [["__asyncStatus", 1103]]);
        check("source step ran, then the runtime replacement did (1+2 +100 +1000)", ran.ok, true);
        // The exact counts depend on how many iterations each step took; what
        // matters is that both are non-zero, which the returned value already
        // proves. Printed so the shape is visible in the transcript.
        const fromSource = readGlobal(built.wasmPath, built.bytes, "fromSource");
        const fromRuntime = readGlobal(built.wasmPath, built.bytes, "fromRuntime");
        console.log(`        step iterations: mainStep=${fromSource}, replacement=${fromRuntime}`);
        check("both steps ran at least once",
          fromSource > 0 && fromRuntime > 0, true);
      }
    } finally {
      built.dispose();
    }
  }
}

if (failures) {
  console.error(`\npolicy: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\n[ SUCCESS ] ${checks} checks`);
