// Round VT1, Gate 2: the five measured task bugs, as regressions.
//
// Each program below failed on `b5994479` (the record/arena design) and must
// pass on the one-object design. The "before" column is what was measured with
// `--runtime stub --enable stack-switching` on `b5994479`; the "after" column
// is the required answer. The whole point of the round is that these are not
// merely fixed but *stay* fixed, so each is compiled and executed here.
//
// Program shape matters: `f` must contain an `await`, or the transform clears
// `async` and the call is inline (§4.4), which is not a task at all.
//
//   #  shape                                       before        required
//   1  two tasks x 5 params, await the second      24            12345
//   2  f(0,0,0,1) then await g(900)                24            900
//   3  three tasks x 5 params, sum                 17076         66666
//   4  a suspending task awaited twice             mem fault     777777
//   5  16,400 sequential tasks                     unreachable   16400
//
// The suite runs each program under **both** class representations:
// `--runtime stub` (pointers) and `--wasmGc` (structs). The task object is one
// object either way; only the allocation and the field reads differ.
//
// Run: node tests/async/regressions.js (wired into `npm run test:async`).

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
} else {
  console.log(`# wasmtime: ${wasmtime}`);
}

/** Compile `source`, run it, and answer `__asyncStatus` (or an error string). */
function run(source, gc) {
  const dir = mkdtempSync(join(tmpdir(), "async-regress-"));
  const tsPath = join(dir, "probe.ts");
  const wasmPath = join(dir, "probe.wasm");
  writeFileSync(tsPath, source);
  const flags = ["--runtime", "stub", "--noColors", "--enable", "stack-switching"];
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
  // The module's start function runs the shell; `__asyncStatus` is the answer.
  // The assertion asks for an impossible value so the failure text carries the
  // actual word; a matching run is a plain `assert_trap`-free success.
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
  return actual ? { value: Number(actual[1]) } : { error: output.split("\n").slice(-2).join(" | ") || "no status" };
}

if (wasmtime != null) {
  const programs = [
    {
      id: "1",
      want: 12345,
      source: `
async function leaf(): i32 { return 0; }
async function f(a: i32, b: i32, c: i32, d: i32, e: i32): i32 {
  let z = await leaf();
  return z + a * 10000 + b * 1000 + c * 100 + d * 10 + e;
}
export async function main(): i32 {
  let t0 = f(9, 9, 9, 9, 9);
  let t1 = f(1, 2, 3, 4, 5);
  return await t1;
}
`,
    },
    {
      id: "2",
      want: 900,
      source: `
async function leaf(): i32 { return 0; }
async function f(a: i32, b: i32, c: i32, d: i32): i32 {
  let z = await leaf();
  return z + a * 1000 + b * 100 + c * 10 + d;
}
async function g(x: i32): i32 {
  let z = await leaf();
  return z + x;
}
export async function main(): i32 {
  let t = f(0, 0, 0, 1);
  return await g(900);
}
`,
    },
    {
      id: "3",
      want: 66666,
      source: `
async function leaf(): i32 { return 0; }
async function f(a: i32, b: i32, c: i32, d: i32, e: i32): i32 {
  let z = await leaf();
  return z + a * 10000 + b * 1000 + c * 100 + d * 10 + e;
}
export async function main(): i32 {
  let t0 = f(1, 1, 1, 1, 1);
  let t1 = f(2, 2, 2, 2, 2);
  let t2 = f(3, 3, 3, 3, 3);
  return (await t0) + (await t1) + (await t2);
}
`,
    },
    {
      id: "4",
      want: 777777,
      source: `
async function leaf(): i32 { return 0; }
async function f(): i32 {
  await leaf();
  return 777777;
}
export async function main(): i32 {
  let t = f();
  let a = await t;
  let b = await t;
  return b;
}
`,
    },
    {
      id: "5",
      want: 16400,
      source: `
async function leaf(): i32 { return 0; }
async function f(x: i32): i32 {
  await leaf();
  return x;
}
export async function main(): i32 {
  let n = 0;
  for (let i = 0; i < 16400; i++) {
    let t = f(1);
    n += await t;
  }
  return n;
}
`,
    },
  ];

  for (const program of programs) {
    const pointer = run(program.source, false);
    check(`bug ${program.id} (pointer ABI) = ${program.want}`,
      pointer.error ? pointer.error : pointer.value, program.want);
    const gc = run(program.source, true);
    check(`bug ${program.id} (--wasmGc) = ${program.want}`,
      gc.error ? gc.error : gc.value, program.want);
  }
}

if (failures) {
  console.error(`\nregressions: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\n[ SUCCESS ] ${checks} checks`);
