// Round A2: one `await`, one value — the park/resume protocol.
//
// What is under test (`docs/async-core-loop.md` §3.1–§3.4, §4.1–§4.4):
//
//   1. `let t = f(); await t;` — `f()` creates `f`'s continuation and returns
//      a `Task`, running none of `f`; the `await` parks `main`, the core loop
//      resumes `f`, and `f`'s value comes back through the task record.
//   2. The call runs nothing: a flag `f` sets stays 0 until the await.
//   3. An `async function` with no `await` is inline: no `cont.new`, no
//      `f$start`, and `await g()` reads a value already there (§4.4).
//   4. Park/resume ordering: a counter proves `main` stopped at the await and
//      resumed after.
//   5. A `try`/`catch` around an await is refused by name: wasm-time exception
//      handling does not yet carry an exception across a capture.
//
// Node cannot run any of this: V8 has no stack switching. The execution half
// shells out to `wasmtime` (50.0.2, `-W stack-switching=y`). A missing
// `wasmtime` is a named skip; `REQUIRE_WASMTIME=1` turns it into a failure.
//
// The modules are compiled with `--runtime stub`: A2's task cells come from a
// static arena, so a module that starts a task still has no imports and
// instantiates on a bare wasmtime. `--enable stack-switching` selects this
// backend; without it an `await` stays on Backend A, byte for byte.
//
// Run: npm run test:await (or `node tests/async/await.js`).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "..", "..", "bin", "tensionscript.js");

let failures = 0;
let checks = 0;
let skipped = 0;

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

/** Compiles `source` with the real CLI and returns the emitted text and path. */
function compile(source, extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), "async-await-"));
  const tsPath = join(dir, "probe.ts");
  const wasmPath = join(dir, "probe.wasm");
  const watPath = join(dir, "probe.wat");
  writeFileSync(tsPath, source);
  execFileSync(process.execPath, [
    CLI, "probe.ts", "-o", "probe.wasm", "--textFile", "probe.wat",
    "--runtime", "stub", "--noColors", "--enable", "stack-switching",
    ...extraArgs
  ], { stdio: "pipe", cwd: dir });
  const wat = readFileSync(watPath, "utf8");
  const bytes = readFileSync(wasmPath);
  return {
    wat,
    bytes,
    wasmPath,
    dispose() { rmSync(dir, { recursive: true, force: true }); }
  };
}

/** Compiles a program that must be refused, and returns the CLI's stderr. */
function compileExpectFailure(source) {
  const dir = mkdtempSync(join(tmpdir(), "async-await-"));
  const tsPath = join(dir, "probe.ts");
  writeFileSync(tsPath, source);
  let output = "";
  try {
    execFileSync(process.execPath, [
      CLI, "probe.ts", "-o", "probe.wasm",
      "--runtime", "stub", "--noColors", "--enable", "stack-switching"
    ], { stdio: "pipe", cwd: dir });
  } catch (e) {
    output = String(e.stderr || "") + String(e.stdout || "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return output;
}

/** The text of one top-level function, from `(func $name` to Binaryen's `\n )`. */
function functionBody(wat, name) {
  // `(func $name (type $N)` — the `(type` keeps `$f` from matching `$f$body`,
  // and the leading `(func` keeps an export's `(func $name)` out.
  const start = wat.indexOf(`(func $${name} (type `);
  if (start < 0) return null;
  const end = wat.indexOf("\n )", start);
  return end < 0 ? wat.slice(start) : wat.slice(start, end);
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
  console.log("SKIP: wasmtime not found on PATH — stack switching is only executable by an engine that has it");
  ++skipped;
} else {
  console.log(`# wasmtime: ${wasmtime}`);
}

function runWasm(wasmPath) {
  try {
    execFileSync("wasmtime", ["run", "-W", "stack-switching=y", wasmPath], { stdio: "pipe" });
    return 0;
  } catch (e) {
    if (typeof e.status === "number") return e.status;
    throw e;
  }
}

/**
 * Instantiate the binary module (its start function runs the shell) and assert
 * the exported `__asyncStatus` global. `wasmtime wast` is used because the CLI
 * has no "print a global" command.
 */
function expectStatus(wasmPath, bytes, expected, label) {
  let escaped = "";
  for (let i = 0; i < bytes.length; ++i) {
    escaped += "\\" + bytes[i].toString(16).padStart(2, "0");
  }
  const wastPath = join(dirname(wasmPath), label + ".wast");
  writeFileSync(wastPath, [
    `(module $m binary "${escaped}")`,
    `(register "m" $m)`,
    `(assert_return (get $m "__asyncStatus") (i32.const ${expected}))`,
    ""
  ].join("\n"));
  let ok = true;
  try {
    execFileSync("wasmtime", ["wast", "-W", "stack-switching=y", wastPath], { stdio: "pipe" });
  } catch {
    ok = false;
  }
  check(`__asyncStatus is ${expected}`, ok, true);
}

/** `wasm-tools validate --features all`, when the tool is present. */
function validateWasm(wasmPath, bytes) {
  const tool = (() => {
    try {
      execFileSync("wasm-tools", ["--version"], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  })();
  if (!tool) {
    check("wasm-tools validates the module", "skipped: wasm-tools not on PATH", "skipped: wasm-tools not on PATH");
    return;
  }
  let ok = true;
  try {
    execFileSync("wasm-tools", ["validate", "--features", "all", wasmPath], { stdio: "pipe" });
  } catch {
    ok = false;
  }
  check("wasm-tools validates the module", ok, true);
}

// ---------------------------------------------------------------------------
// 1. `let t = f(); await t;` — the value arrives.
// ---------------------------------------------------------------------------

console.log("\n# one await, one value");
const one = compile(`
async function leaf(): i32 { return 7; }
async function f(): i32 { return await leaf(); }

export async function main(): i32 {
  let t = f();
  let v = await t;
  return v;
}
`);
try {
  const { wat, bytes, wasmPath } = one;
  check("has tag $await", /\(tag \$await\b/.test(wat), true);
  check("f$body exists", functionBody(wat, "probe/f$body") != null, true);
  check("f$start exists", functionBody(wat, "probe/f$start") != null, true);
  check("f is the entry", functionBody(wat, "probe/f") != null, true);
  const start = functionBody(wat, "probe/f$start");
  check("f$start reads the current record", start != null && /__currentRecord/.test(start), true);
  check("f$start calls f$body", start != null && /call \$probe\/f\$body\b/.test(start), true);
  const entry = functionBody(wat, "probe/f");
  check("the entry installs f$start's continuation",
    entry != null && /ref\.func \$probe\/f\$start\b/.test(entry) && /cont\.new\b/.test(entry), true);
  check("the entry does not call f$body", entry != null && !/call \$probe\/f\$body\b/.test(entry), true);
  const main = functionBody(wat, "probe/main");
  check("main parks on $await", main != null && /suspend \$await\b/.test(main), true);
  check("main's await is guarded by the task's done flag",
    main != null && /TaskRecord#get:done/.test(main) && /if\b/.test(main), true);
  const startFn = functionBody(wat, "~start");
  check("__start resumes main$start, not main",
    startFn != null && /ref\.func \$~asyncMainStart\b/.test(startFn) && !/ref\.func \$probe\/main\b/.test(startFn), true);
  check("no imports", /\(import /.test(wat), false);
  if (wasmtime != null) {
    check("the module runs on wasmtime (exit 0)", runWasm(wasmPath), 0);
    expectStatus(wasmPath, bytes, 7, "one");
  }
  validateWasm(wasmPath, bytes);
} finally {
  one.dispose();
}

// ---------------------------------------------------------------------------
// 2. The call runs nothing: `f`'s flag is still 0 immediately after `f()`.
// ---------------------------------------------------------------------------

console.log("\n# an async call runs nothing");
const nothing = compile(`
let flag: i32 = 0;

async function leaf(): i32 { return 7; }
async function f(): i32 {
  flag = 1;
  return await leaf();
}

export async function main(): i32 {
  let t = f();
  if (flag != 0) return 99;   // the body must not have run
  let v = await t;
  if (flag != 1) return 98;   // and now it must have
  return v;
}
`);
try {
  const { wat, bytes, wasmPath } = nothing;
  const entry = functionBody(wat, "probe/f");
  check("the entry stores nothing of f's body", entry != null && !/flag/.test(entry), true);
  if (wasmtime != null) {
    check("the module runs on wasmtime (exit 0)", runWasm(wasmPath), 0);
    expectStatus(wasmPath, bytes, 7, "nothing");
  }
  validateWasm(wasmPath, bytes);
} finally {
  nothing.dispose();
}

// ---------------------------------------------------------------------------
// 3. `await g()` where `g` has no await: inline, no continuation.
// ---------------------------------------------------------------------------

console.log("\n# a body that cannot suspend is free");
const free = compile(`
async function g(): i32 { return 42; }

export async function main(): i32 {
  let v = await g();
  return v;
}
`);
try {
  const { wat, bytes, wasmPath } = free;
  check("no g$start", functionBody(wat, "probe/g$start") == null, true);
  check("no g$body", functionBody(wat, "probe/g$body") == null, true);
  check("no g$Rec", /g\$Rec/.test(wat), false);
  check("no cont.new for g", /cont\.new[^\n]*\n[^\n]*g\b/.test(wat), false);
  check("the shell is still there for main's await", /\(tag \$await\b/.test(wat), true);
  if (wasmtime != null) {
    check("the module runs on wasmtime (exit 0)", runWasm(wasmPath), 0);
    expectStatus(wasmPath, bytes, 42, "free");
  }
  validateWasm(wasmPath, bytes);
} finally {
  free.dispose();
}

// ---------------------------------------------------------------------------
// 4. Park/resume ordering: main reaches the call, stops, and resumes after f.
// ---------------------------------------------------------------------------

console.log("\n# park ordering");
const order = compile(`
let seq: i32 = 0;

async function leaf(): i32 { return 7; }
async function f(): i32 {
  if (seq != 1) return 90;   // main parked after setting seq = 1
  seq = 2;
  return await leaf();
}

export async function main(): i32 {
  let t = f();
  seq = 1;
  let v = await t;
  if (seq != 2) return 91;   // f ran while main was parked
  seq = 3;
  return v;
}
`);
try {
  const { wat, bytes, wasmPath } = order;
  check("main suspends exactly once", (functionBody(wat, "probe/main") || "").match(/suspend \$await\b/g)?.length, 1);
  if (wasmtime != null) {
    check("the module runs on wasmtime (exit 0)", runWasm(wasmPath), 0);
    expectStatus(wasmPath, bytes, 7, "order");
  }
  validateWasm(wasmPath, bytes);
} finally {
  order.dispose();
}

// ---------------------------------------------------------------------------
// 4b. Two parks live: `main` awaits `a`, and `a` awaits `b`.
// ---------------------------------------------------------------------------

console.log("\n# two parks live");
const deep = compile(`
let depth: i32 = 0;

async function leaf(): i32 { return 7; }
async function b(): i32 { return await leaf(); }
async function a(): i32 {
  depth = 1;
  let v = await b();
  depth = 2;
  return v;
}

export async function main(): i32 {
  let t = a();
  let v = await t;
  if (depth != 2) return 91;
  return v;
}
`);
try {
  const { wat, bytes, wasmPath } = deep;
  check("both a and b have continuations",
    functionBody(wat, "probe/a$start") != null && functionBody(wat, "probe/b$start") != null, true);
  if (wasmtime != null) {
    check("the module runs on wasmtime (exit 0)", runWasm(wasmPath), 0);
    expectStatus(wasmPath, bytes, 7, "deep");
  }
  validateWasm(wasmPath, bytes);
} finally {
  deep.dispose();
}

// ---------------------------------------------------------------------------
// 5. try/catch around an await — refused by name, not miscompiled.
// ---------------------------------------------------------------------------

console.log("\n# try/catch across an await");
{
  const stderr = compileExpectFailure(`
async function leaf(): i32 { return 7; }
async function f(): i32 { return await leaf(); }

export async function main(): i32 {
  let t = f();
  try {
    let v = await t;
    return v;
  } catch (e) {
    return 1;
  }
}
`);
  check("refused by name", /a try\/catch around an await/.test(stderr), true);
  check("the compiler does not crash", /Whoops|AssertionError/.test(stderr), false);
}

// ---------------------------------------------------------------------------
// 6. The guards: main parameters and the nested pump.
// ---------------------------------------------------------------------------

console.log("\n# guards");
{
  const stderr = compileExpectFailure(`
async function leaf(): i32 { return 7; }
async function f(): i32 { return await leaf(); }

export async function main(x: i32): i32 {
  let t = f();
  return await t;
}
`);
  check("main taking parameters is refused", /main takes parameters/.test(stderr), true);
}
const guards = compile(`
async function leaf(): i32 { return 7; }
async function f(): i32 { return await leaf(); }
export async function main(): i32 { let t = f(); return await t; }
`);
try {
  const { wat } = guards;
  check("__asyncPump is exported", /\(export "__asyncPump" \(func \$/.test(wat), true);
  check("__coreloopAwait is not exported", /\(export "[^"]*__coreloopAwait"/.test(wat), false);
  const loop = functionBody(wat, "~lib/async/__coreloopAwait");
  check("the root loop never awaits", loop != null && !/suspend \$await\b/.test(loop), true);
} finally {
  guards.dispose();
}

// ---------------------------------------------------------------------------

console.log();
if (failures) {
  console.log(`ERROR: ${failures} of ${checks} checks failed`);
  process.exitCode = 1;
} else if (skipped) {
  console.log(`[ SKIP ] ${checks} checks passed, execution skipped (${skipped} reason)`);
} else {
  console.log(`[ SUCCESS ] ${checks} checks`);
}
