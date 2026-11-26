// Round VT5: whole-value copies between memory and SROA locals.
//
// An `@inline struct` value has exactly two representations — one WASM local per
// leaf, or bytes at an address — and this round adds the primitive that moves a
// value between them in both directions. What that unlocks, and what is measured
// here:
//
//   `Task<Res>`      an async function returning an inline struct; `await t` into
//                    a local, fields read back. The body has a second suspension
//                    so the task is a real task, not the inlined no-await form.
//   `Array<Res>`     `arr[0] = r; let q: Res = arr[0];` round-trips, and two
//                    elements are independent (the stride is `sizeof(Res)`, not
//                    `alignof(Res)`).
//   SROA -> SROA     `let q: Res = p` still copies leaf by leaf (regression).
//   nested + array   a struct with a nested inline field and one with a
//                    `[i32 * 4]` field both copy through memory correctly.
//   refusals         a top-level `@inline struct` is still refused (two globals
//                    would alias), and an `Array<Res>` method other than `[]` is
//                    refused by name rather than addressing the wrong bytes.
//
// Every case runs under both class representations: `--runtime stub` (pointers)
// and `--wasmGc`. The async cases need the stack-switching proposal, so the
// driver is `wasmtime` — the same arrangement `tests/async/returnvalues.js` uses.
//
// Run: node tests/interop/inline-whole-value.js (wired as `npm run test:inlinevalue`).

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
  console.log("SKIP: wasmtime not found on PATH — the task protocol needs stack switching");
  process.exit(0);
}

/** Compiles `source` and answers the module bytes, or the diagnostic text. */
function compile(source, gc) {
  const dir = mkdtempSync(join(tmpdir(), "vt5-inline-"));
  writeFileSync(join(dir, "probe.ts"), source);
  const flags = [
    "--runtime", "stub", "--noColors", "--use", "abort=",
    "--enable", "stack-switching", "--stackful-backend", "continuation",
  ];
  if (gc) flags.push("--wasmGc");
  try {
    execFileSync(process.execPath, [CLI, "probe.ts", "-o", "probe.wasm", ...flags], {
      stdio: "pipe",
      cwd: dir,
    });
  } catch (error) {
    const output = `${error.stderr ?? ""}${error.stdout ?? ""}`;
    rmSync(dir, { recursive: true, force: true });
    return { error: output.split("\n").filter((line) => /ERROR|FAILURE/.test(line)).join(" | ") };
  }
  const bytes = readFileSync(join(dir, "probe.wasm"));
  rmSync(dir, { recursive: true, force: true });
  return { bytes };
}

/**
 * Runs an `async function main(): i32` module and answers what it returned.
 *
 * The probe's `__asyncStatus` global holds the return value; the driver asserts
 * it is the "still running" sentinel, so wasmtime prints the actual value in the
 * mismatch. That is how `tests/async/returnvalues.js` reads results, and it
 * keeps the host side from needing to speak the task protocol.
 */
function run(compiled) {
  if (compiled.error) return compiled.error;
  const dir = mkdtempSync(join(tmpdir(), "vt5-inline-run-"));
  let escaped = "";
  for (let i = 0; i < compiled.bytes.length; ++i) {
    escaped += "\\" + compiled.bytes[i].toString(16).padStart(2, "0");
  }
  const probePath = join(dir, "probe.run.wast");
  writeFileSync(probePath, [
    '(module $env (func (export "abort") (param i32 i32 i32 i32)))',
    '(register "env" $env)',
    `(module $m binary "${escaped}")`,
    '(register "m" $m)',
    '(assert_return (get $m "__asyncStatus") (i32.const 2147483647))',
    "",
  ].join("\n"));
  let output = "";
  try {
    execFileSync("wasmtime", ["wast", "-W", "stack-switching=y", probePath], { stdio: "pipe" });
  } catch (error) {
    output = `${error.stderr ?? ""}${error.stdout ?? ""}`;
  }
  rmSync(dir, { recursive: true, force: true });
  const actual = output.match(/actual\s+(-?\d+)/);
  return actual ? Number(actual[1]) : output.split("\n").slice(-2).join(" | ") || "no status";
}

/** Asserts that `source` is refused with `pattern` in the diagnostics. */
function refused(name, source, pattern) {
  for (const gc of [false, true]) {
    const tag = gc ? "wasmGc" : "ptr";
    const compiled = compile(source, gc);
    if (!compiled.error) {
      console.log(`  FAIL ${name} [${tag}]: compiled, expected a refusal`);
      ++failures;
      ++checks;
      continue;
    }
    const crashed = /AssertionError|compiler has crashed/.test(compiled.error);
    check(`${name} [${tag}]`, { crashed, named: compiled.error.includes(pattern) }, {
      crashed: false,
      named: true,
    });
  }
}

// --- 1. `Task<Res>`: the value is inline bytes in the task object ----------

const taskRes = `@inline struct Res { code: i32; size: i32; }
async function tick(): i32 { return 1; }
async function inner(): Res { await tick(); let r: Res; r.code = 7; r.size = 42; return r; }
async function work(): Res {
  let a: Res = await inner();
  let b: Res = await inner();
  let r: Res;
  r.code = a.code + b.code;
  r.size = a.size + b.size;
  return r;
}
export async function main(): i32 {
  let t: Task<Res> = work();
  let q: Res = await t;
  return q.code * 1000 + q.size;
}`;

for (const gc of [false, true]) {
  check(`Task<Res>: await into a local, fields read back [${gc ? "wasmGc" : "ptr"}]`,
    run(compile(taskRes, gc)), 14084);
}

// --- 2. `Array<Res>`: memory <-> SROA at `sizeof(Res)`, elements independent -

const arrayRes = `@inline struct Res { code: i32; size: i32; }
async function tick(): i32 { return 1; }
async function inner(): i32 { return await tick(); }
function arrayRound(): i32 {
  let arr = new Array<Res>(2);
  let r: Res; r.code = 7; r.size = 42;
  let s: Res; s.code = 1; s.size = 2;
  arr[0] = r;
  arr[1] = s;
  let q: Res = arr[0];
  let u: Res = arr[1];
  return q.code * 1000000 + q.size * 10000 + u.code * 100 + u.size;
}
export async function main(): i32 {
  let x = await inner();
  return arrayRound() + (x - 1);
}`;

for (const gc of [false, true]) {
  check(`Array<Res>: round-trip, two elements independent [${gc ? "wasmGc" : "ptr"}]`,
    run(compile(arrayRes, gc)), 7420102);
}

// --- 3. nested inline field, and a `[i32 * 4]` field, through memory --------

const shaped = `@inline struct Inner { x: i32; y: i32; }
@inline struct Outer { a: i32; inn: Inner; b: i32; }
@inline struct WithArr { head: i32; arr: [i32*4]; tail: i32; }
async function tick(): i32 { return 1; }
async function workOuter(): Outer {
  await tick();
  let o: Outer; o.a = 1; o.inn.x = 2; o.inn.y = 3; o.b = 4;
  return o;
}
async function workArr(): WithArr {
  await tick();
  let w: WithArr; w.head = 5;
  w.arr[0] = 6; w.arr[1] = 7; w.arr[2] = 8; w.arr[3] = 9;
  w.tail = 10;
  return w;
}
export async function main(): i32 {
  let to: Task<Outer> = workOuter();
  let o: Outer = await to;
  if (o.a != 1 || o.inn.x != 2 || o.inn.y != 3 || o.b != 4) return 1;
  let tw: Task<WithArr> = workArr();
  let w: WithArr = await tw;
  if (w.head != 5 || w.tail != 10) return 2;
  if (w.arr[0] != 6 || w.arr[1] != 7 || w.arr[2] != 8 || w.arr[3] != 9) return 3;
  return 0;
}`;

for (const gc of [false, true]) {
  check(`nested and [i32*4] fields copy through memory [${gc ? "wasmGc" : "ptr"}]`,
    run(compile(shaped, gc)), 0);
}

// --- 4. SROA -> SROA still copies (regression guard) ----------------------

const sroaCopy = `@inline struct Res { code: i32; size: i32; }
async function tick(): i32 { return 1; }
async function inner(): i32 { return await tick(); }
function copy(): i32 {
  let p: Res; p.code = 3; p.size = 4;
  let q: Res = p;
  q.code = 9;
  return p.code * 1000 + q.code * 100 + p.size + q.size;
}
export async function main(): i32 {
  let x = await inner();
  return copy() + (x - 1);
}`;

for (const gc of [false, true]) {
  check(`let q: Res = p copies leaf by leaf [${gc ? "wasmGc" : "ptr"}]`,
    run(compile(sroaCopy, gc)), 3908);
}

// --- 5. the refusals that remain, by name ---------------------------------

refused(
  "an @inline struct at top level is still refused",
  `@inline struct G { x: i32; y: i32; }
const g: G = new G();
export function read(): i32 { return g.x; }`,
  "an @inline struct at top level"
);

refused(
  "an Array<Res> method other than [] is refused by name",
  `@inline struct Res { code: i32; size: i32; }
export function run(): i32 {
  let arr = new Array<Res>(2);
  let r: Res; r.code = 1; r.size = 2;
  arr.push(r);
  return arr.length;
}`,
  "whose element is an @inline struct"
);

if (failures) {
  console.log(`\n[ FAILURE ] ${failures} of ${checks} checks failed`);
  process.exit(1);
} else {
  console.log(`\n[ SUCCESS ] ${checks} checks`);
}
