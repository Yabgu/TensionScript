// Round A1: the async shell — `main` runs on a continuation, driven by
// `__coreloop`, with no `await` anywhere.
//
// What is under test (`docs/async-core-loop.md` §3.1–§3.4, narrowed to the
// await-free case):
//
//   1. An await-free async program gets the shell: the `$idle`/`$done` tags,
//      `__coreloop`, the continuation table, and an exported `__asyncPump`.
//   2. `__start` does not **call** `main` — it `cont.new`s it and resumes it on
//      the core loop. Asserted on the emitted text, not on intent.
//   3. The `$done` status path is observable: the handler stores the payload
//      into the exported `__asyncStatus` global, so an embedder (a later round)
//      can read it without a host contract. Asserted structurally on the WAT
//      and, for an i32-returning `main`, by reading the global after start.
//   4. The module runs on wasmtime and exits 0.
//   5. A program that declares no async gets none of the above — async costs
//      nothing when unused, which is the round's whole shape.
//
// Node cannot run this: V8 has no stack switching, and
// `WebAssembly.validate(continuationModule)` is false there. The execution
// half therefore shells out to `wasmtime`. A missing `wasmtime` is a **named
// skip**, never a silent pass; set `REQUIRE_WASMTIME=1` (CI does) to turn it
// into a failure instead.
//
// Run: npm run test:coreloop (or `node tests/async/coreloop.js`).

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
function compile(source) {
  const dir = mkdtempSync(join(tmpdir(), "async-coreloop-"));
  const tsPath = join(dir, "probe.ts");
  const wasmPath = join(dir, "probe.wasm");
  const watPath = join(dir, "probe.wat");
  writeFileSync(tsPath, source);
  // A bare file name, from the temp directory: the compiler's internal name is
  // derived from the path, and `probe/main` is what the assertions expect.
  execFileSync(process.execPath, [
    CLI, "probe.ts", "-o", "probe.wasm", "--textFile", "probe.wat",
    "--runtime", "incremental", "--noColors",
    // **Continuation, named** (DL51). This suite asserts the continuation shell's own
    // shape — `__asyncStatus`, the `$idle`/`$done`/`$await` tags, the core loop — and it
    // used to get that by saying nothing, because an `await` under the old default was
    // continuation. `auto` means fiber now, so "nothing" produces a different artifact and
    // every assertion here would be about the wrong one. Choosing the backend also enables
    // its wasm feature, which is why no `--enable stack-switching` appears.
    "--stackful-backend", "continuation"
  ], { stdio: "pipe", cwd: dir });
  const wat = readFileSync(watPath, "utf8");
  const bytes = readFileSync(wasmPath);
  return {
    wat,
    bytes,
    wasmPath,
    watPath,
    dispose() { rmSync(dir, { recursive: true, force: true }); }
  };
}

/**
 * The text of one top-level function, from `(func $name` to Binaryen's
 * top-level `\n )`. Enough for structural assertions, and it refuses to answer
 * for a function that is not there — which is itself a check in the shell case.
 */
function functionBody(wat, name) {
  const start = wat.indexOf(`(func $${name}`);
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
  console.log("SKIP: wasmtime not found on PATH — the shell is only executable by an engine with stack switching");
  console.log("      install the pinned version (see package.json `config.wasmtime`) to run this test");
  ++skipped;
} else {
  console.log(`# wasmtime: ${wasmtime}`);
}

/** Runs a module as the wasm start function and returns the process status. */
function runWasm(wasmPath) {
  try {
    execFileSync("wasmtime", ["run", "-W", "stack-switching=y", wasmPath], { stdio: "pipe" });
    return 0;
  } catch (e) {
    if (typeof e.status === "number") return e.status;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// 1. The shell: a plain main, an async declaration to make the program async
//    (A1 has no `await`, so `main` itself stays an ordinary `void` function).
// ---------------------------------------------------------------------------

console.log("\n# the shell");
const shell = compile(`
// A may-suspend declaration, never called: it is what makes this program
// async. Its body has no await, so A1 owns it (a program with an await stays
// on Backend A and is byte-identical this round).
async function marker(): void {}

export function main(): void { }
`);
try {
  const { wat } = shell;
  check("has tag $idle", /\(tag \$idle\b/.test(wat), true);
  check("has tag $done", /\(tag \$done\b/.test(wat), true);
  check("has __coreloop", /\(func \$~lib\/async\/__coreloop\b/.test(wat), true);
  check("exports __asyncPump", /\(export "__asyncPump" \(func \$/.test(wat), true);
  check("has the continuation table", /\(table \$~asyncCont \d+ \d+ \(ref null \$/.test(wat), true);

  const start = functionBody(wat, "~start");
  check("__start exists", start != null, true);
  check("__start does not call main", start != null && !/call \$probe\/main\b/.test(start), true);
  check("__start resumes main's continuation",
    start != null && /ref\.func \$probe\/main\b/.test(start) && /cont\.new\b/.test(start) && /resume \$/.test(start), true);
  check("__start installs a handler for $idle and $done",
    start != null && /\(on \$idle \$/.test(start) && /\(on \$done \$/.test(start), true);

  // The status store must take its value from the `$done` payload, not from a
  // constant: `tuple.extract 0` of the handler block's `(i32, continuation)`.
  // Binaryen prints stack-machine text, so the extract is the line immediately
  // before the store.
  check("exports __asyncStatus", /\(export "__asyncStatus" \(global \$/.test(wat), true);
  check("__asyncStatus is written from the $done payload",
    start != null && /tuple\.extract[^\n]*\n\s*global\.set \$~asyncStatus/.test(start), true);
  check("__asyncStatus is not written from a constant",
    start != null && !/global\.set \$~asyncStatus\s*\n?\s*\(i32\.const/.test(start), true);

  if (wasmtime != null) {
    check("the module runs on wasmtime (exit 0)", runWasm(shell.wasmPath), 0);
  }
} finally {
  shell.dispose();
}

// ---------------------------------------------------------------------------
// 2. The status path, observed: main's i32 result becomes the $done payload
//    and lands in the exported global. Read back after start with
//    `wasmtime wast`, because the CLI cannot print a global.
// ---------------------------------------------------------------------------

console.log("\n# the status path");
const status = compile(`
async function marker(): void {}

export function main(): i32 { return 7; }
`);
try {
  const { wat } = status;
  const start = functionBody(wat, "~start");
  check("an i32 main gets an i32 $done payload", /\(tag \$done \(type \$[0-9]+\) \(param i32\)\)/.test(wat), true);
  check("the status again comes from the $done payload",
    start != null && /tuple\.extract[^\n]*\n\s*global\.set \$~asyncStatus/.test(start), true);

  if (wasmtime != null) {
    check("the module runs on wasmtime (exit 0)", runWasm(status.wasmPath), 0);
    // A one-command wast script: instantiate the binary module (its start
    // function runs the shell) and read the exported global.
    const bytes = status.bytes;
    let escaped = "";
    for (let i = 0; i < bytes.length; ++i) {
      escaped += "\\" + bytes[i].toString(16).padStart(2, "0");
    }
    const wastPath = join(dirname(status.wasmPath), "status.wast");
    writeFileSync(wastPath, [
      `(module $m binary "${escaped}")`,
      `(register "m" $m)`,
      `(assert_return (get $m "__asyncStatus") (i32.const 7))`,
      ""
    ].join("\n"));
    let statusObserved = true;
    try {
      execFileSync("wasmtime", ["wast", "-W", "stack-switching=y", wastPath], { stdio: "pipe" });
    } catch {
      statusObserved = false;
    }
    check("__asyncStatus holds main's 7 after start", statusObserved, true);
  }
} finally {
  status.dispose();
}

// ---------------------------------------------------------------------------
// 3. Conditional emission: no async, no shell. This is the shape of the round
//    — a program that does not suspend pays nothing.
// ---------------------------------------------------------------------------

console.log("\n# conditional emission");
const plain = compile(`export function main(): void { }\n`);
try {
  const { wat } = plain;
  check("no tags", /\(tag \$/.test(wat), false);
  check("no __coreloop", /__coreloop/.test(wat), false);
  check("no continuation table", /table \$~asyncCont\b/.test(wat), false);
  check("no reference to ~lib/async", /~lib\/async/.test(wat), false);
  check("no __asyncStatus", /__asyncStatus/.test(wat), false);
  // The baseline shape is unchanged: no start function at all, because there is
  // nothing to initialise and the shell is not emitted.
  check("no __start", /\(func \$~start\b/.test(wat), false);
  if (wasmtime != null) {
    check("the plain module still runs (exit 0)", runWasm(plain.wasmPath), 0);
  }
} finally {
  plain.dispose();
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
