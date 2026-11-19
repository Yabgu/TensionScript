// Round VT3, Gate 3: the async return value, for every kind.
//
// What is under test: `await t` resolves to the task's `T`, and the value the
// body produced arrives through `Task<T>.value` — the field accessor is
// monomorphized from the declared type, so there is no cast, offset or runtime
// check to get wrong.
//
// **Every program below suspends for real.** The matrix function contains
// `await inner()`, and `inner` itself contains an `await`, so `inner` is a task
// rather than the inline call an `async` body without an `await` becomes
// (§4.4). The suite asserts that structurally (`inner$Rec#drive` exists) as well
// as by value: a body with no `await` is inlined, never becomes a task, and
// would pass the value check while testing nothing.
//
// The ten kinds are i32, i64, f32, f64, bool, void, class, array, string and an
// `@unmanaged` struct. Each runs under both class representations:
// `--runtime stub` (pointers) and `--wasmGc` (GC structs).
//
// `await t` is also checked against the *wrong* target type: for every kind but
// `i32` (and `bool`, see below), `let b: i32 = await t` must be refused with
// the awaited type named.
//
// Run: node tests/async/returnvalues.js (wired into `npm run test:returnvalues`).

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
  ++skipped;
} else {
  console.log(`# wasmtime: ${wasmtime}`);
}

/** Compiles `source`, optionally returns its WAT, and runs it for `__asyncStatus`. */
function run(source, gc) {
  const dir = mkdtempSync(join(tmpdir(), "async-return-"));
  const tsPath = join(dir, "probe.ts");
  const wasmPath = join(dir, "probe.wasm");
  const watPath = join(dir, "probe.wat");
  writeFileSync(tsPath, source);
  const flags = [
    "--runtime", "stub", "--noColors", "--use", "abort=",
    "--enable", "stack-switching", "--textFile", "probe.wat",
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
    return { error: output.split("\n").filter((line) => /ERROR|FAILURE/.test(line)).join(" | ") || "compile failed" };
  }

  const wat = readFileSync(watPath, "utf8");
  const bytes = readFileSync(wasmPath);
  let escaped = "";
  for (let i = 0; i < bytes.length; ++i) {
    escaped += "\\" + bytes[i].toString(16).padStart(2, "0");
  }
  // The allocator's OOM path names `env.abort`. Under GC its message arguments
  // are string references; under the pointer ABI they are addresses.
  const env = gc
    ? '(module $env (type $str (array (mut i16))) (func (export "abort") (param (ref null $str) (ref null $str) i32 i32)))'
    : '(module $env (func (export "abort") (param i32 i32 i32 i32)))';
  const probePath = join(dir, "probe.run.wast");
  writeFileSync(probePath, [
    env,
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
  return actual ? { value: Number(actual[1]), wat } : { error: output.split("\n").slice(-2).join(" | ") || "no status" };
}

/** Compiles `source` expecting refusal; answers the diagnostics text. */
function refusal(source) {
  const dir = mkdtempSync(join(tmpdir(), "async-return-neg-"));
  writeFileSync(join(dir, "probe.ts"), source);
  let output = "";
  try {
    execFileSync(process.execPath, [
      CLI, "probe.ts", "-o", "probe.wasm",
      "--runtime", "stub", "--noColors", "--enable", "stack-switching",
    ], { stdio: "pipe", cwd: dir });
  } catch (error) {
    output = `${error.stderr ?? ""}${error.stdout ?? ""}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return output;
}

/** The text of one top-level function, from `(func $name` to Binaryen's `\n )`. */
function functionBody(wat, name) {
  const start = wat.indexOf(`(func $${name} (type `);
  if (start < 0) return null;
  const end = wat.indexOf("\n )", start);
  return end < 0 ? wat.slice(start) : wat.slice(start, end);
}

/**
 * The shared prelude. `inner` is a task because its body contains an `await`;
 * `tick` is inline (no `await`), so nothing here suspends before the matrix
 * function does. The matrix function's `await inner()` is a park on an
 * unsettled task and therefore a real suspension of its own continuation.
 */
const PRELUDE = `
class P { x: i32 = 0; }
@unmanaged struct V { a: i32; b: i32; }
async function tick(): i32 { return 1; }
async function inner(): i32 { return await tick(); }
`;

/** One matrix entry: id, return type, body, expected status, main body. */
const CASES = [
  {
    id: "i32", type: "i32", want: 7,
    body: `return 7;`,
    main: `let v: i32 = await t; return v;`,
  },
  {
    id: "i64", type: "i64", want: 900,
    body: `return 900;`,
    main: `let v: i64 = await t; return <i32>v;`,
  },
  {
    id: "f32", type: "f32", want: 12,
    body: `return 12.0;`,
    main: `let v: f32 = await t; return <i32>v;`,
  },
  {
    id: "f64", type: "f64", want: 10,
    body: `return 10.0;`,
    main: `let v: f64 = await t; return <i32>v;`,
  },
  {
    id: "bool", type: "bool", want: 1,
    body: `return true;`,
    main: `let v: bool = await t; return v ? 1 : 0;`,
  },
  {
    id: "void", type: "void", want: 3,
    body: ``,
    main: `await t; return 3;`,
  },
  {
    id: "class", type: "P", want: 5,
    body: `let p = new P(); p.x = 5; return p;`,
    main: `let v: P = await t; return v.x;`,
  },
  {
    id: "array", type: "i32[]", want: 23,
    body: `let a = new Array<i32>(2); a[0] = 2; a[1] = 3; return a;`,
    main: `let v: i32[] = await t; return v[0] * 10 + v[1];`,
  },
  {
    id: "string", type: "string", want: 3,
    body: `return "abc";`,
    main: `let v: string = await t; return v.length;`,
  },
  {
    id: "struct", type: "V", want: 45,
    body: `let v = new V(); v.a = 4; v.b = 5; return v;`,
    main: `let v: V = await t; return v.a * 10 + v.b;`,
  },
];

function program(c) {
  return `${PRELUDE}
async function f(): ${c.type} {
  await inner();
  ${c.body}
}
export async function main(): i32 {
  let t = f();
  ${c.main}
}
`;
}

/** The same program with the await assigned to an `i32` instead of its `T`. */
function wrongTarget(c) {
  return `${PRELUDE}
async function f(): ${c.type} {
  await inner();
  ${c.body}
}
export async function main(): i32 {
  let t = f();
  let b: i32 = await t;
  return b;
}
`;
}

// ── structure: the matrix function and `inner` both became tasks ─────────────

if (wasmtime != null) {
  console.log("\n# the awaited task is a task, and the matrix body suspends");
  for (const c of CASES) {
    const pointer = run(program(c), false);
    if (pointer.error) {
      check(`${c.id}: compiles for the structure check`, pointer.error, "ok");
      continue;
    }
    const wat = pointer.wat;
    check(`${c.id}: inner is a task (inner$Rec#drive)`,
      functionBody(wat, "probe/inner$Rec#drive") != null, true);
    check(`${c.id}: f is a task (f$Rec#drive)`,
      functionBody(wat, "probe/f$Rec#drive") != null, true);
    const body = functionBody(wat, "probe/f$body") || "";
    check(`${c.id}: the body calls the task entry`,
      /call \$probe\/inner\b/.test(body), true);
    check(`${c.id}: the await site checks the task's settled flag`,
      /TaskBase#get:settled/.test(body), true);
  }
}

// ── the ten kinds, both ABIs ────────────────────────────────────────────────

if (wasmtime != null) {
  console.log("\n# ten kinds round-trip, both class representations");
  for (const c of CASES) {
    const pointer = run(program(c), false);
    check(`${c.id} (pointer ABI) = ${c.want}`,
      pointer.error ? pointer.error : pointer.value, c.want);
    const gc = run(program(c), true);
    check(`${c.id} (--wasmGc) = ${c.want}`,
      gc.error ? gc.error : gc.value, c.want);
  }
}

// ── `await t` resolves to `T`, not `i32` ────────────────────────────────────

console.log("\n# the await's type is the task's T");
for (const c of CASES) {
  if (c.id == "i32" || c.id == "bool") continue;
  const output = refusal(wrongTarget(c));
  check(`${c.id}: \`let b: i32 = await t\` is refused`,
    /ERROR (TS2322|AS200)/.test(output), true);
}

// `bool` is the one kind whose wrong-target check cannot be a refusal:
// `bool` assigns to `i32` implicitly in this language (measured separately
// below), so the assignment is legal even though the await is `bool`. The
// distinguishing pair is `bool = await t` accepted and `bool = 7` refused —
// the second proves the await did not stay `i32`.
{
  const accepted = refusal(`${PRELUDE}
async function f(): bool { await inner(); return true; }
export async function main(): i32 { let t = f(); let b: bool = await t; return b ? 1 : 0; }
`);
  check("bool: `let b: bool = await t` compiles clean", accepted, "");
  const intToBool = refusal(`export function main(): i32 { let b: bool = 7; return b ? 1 : 0; }`);
  check("bool: `let b: bool = 7` is refused (so the await is not i32)",
    /ERROR AS200/.test(intToBool), true);
}

if (failures) {
  console.error(`\nreturnvalues: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\n[ SUCCESS ] ${checks} checks${skipped ? " (wasmtime missing: execution skipped)" : ""}`);
