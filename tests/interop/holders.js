// Round VT4: the blob holders, measured in both class representations.
//
// Three shapes were refused in a plain GC class, and none of the refusals was a
// design choice: an `@inline struct` field, an `@unmanaged [T * N]` field, and a
// fixed array of inline structs. This file compiles and **runs** each accepted
// shape under `--runtime stub` (pointers) and `--wasmGc` (structs), and pins the
// refusals that remain. Every case forces materialization (`new C()`,
// `sizeof`, `offsetof`): a type nothing instantiates never reaches the layout
// path, so it would "compile" whether or not it is supported.
//
// The gate numbers:
//
//   class C { s: S; }          offsets 0/8, round-trip 112233, independent 12,
//                              fresh instance reads 0
//   @unmanaged / @managed      same layout, fresh instance reads 0
//   class C { a: @unmanaged
//             [u32 * 4]; }     accepted without `!`, pointer slot is zero
//   managed leaf in inline     refused at the record's **declaration** since
//                              round VT6 (`a struct cannot hold a GC reference`),
//                              and the positional backstops still fire for a
//                              leaf the declaration check cannot name
//   class B { s: [S * 2]; }    offsets 0/16, two elements 134332211,
//                              three elements 123456
//   [[i32 * 4] * 2]            round-trip 1040508; every other position is a
//                              diagnostic, never an assertion
//
// Run: node tests/interop/holders.js (wired as `npm run test:holders`).

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

/** Compiles `source` with the real CLI; answers the bytes and the diagnostics. */
function compile(source, gc) {
  const dir = mkdtempSync(join(tmpdir(), "vt4-holders-"));
  writeFileSync(join(dir, "probe.ts"), source);
  const flags = [
    "--runtime", "stub", "--noColors", "--use", "abort=",
    "--enable", "stack-switching", "--stackful-backend", "continuation"
  ];
  if (gc) flags.push("--wasmGc");
  let stderr = "";
  let ok = true;
  try {
    execFileSync(process.execPath, [CLI, "probe.ts", "-o", "probe.wasm", ...flags], {
      stdio: "pipe",
      cwd: dir,
    });
  } catch (error) {
    ok = false;
    stderr = `${error.stderr ?? ""}${error.stdout ?? ""}`;
  }
  let bytes = null;
  if (ok) bytes = readFileSync(join(dir, "probe.wasm"));
  rmSync(dir, { recursive: true, force: true });
  return { ok, stderr, bytes };
}

/** Instantiates `compiled` and calls `entry`; answers its number or an error. */
function run(compiled, entry, ...args) {
  const imports = {};
  for (const needed of WebAssembly.Module.imports(new WebAssembly.Module(compiled.bytes))) {
    imports[needed.module] ??= {};
    imports[needed.module][needed.name] =
      needed.kind === "memory"
        ? new WebAssembly.Memory({ initial: 1 })
        : (globalThis[needed.name] ?? (() => 0));
  }
  const instance = new WebAssembly.Instance(new WebAssembly.Module(compiled.bytes), imports);
  try {
    return { value: instance.exports[entry](...args) };
  } catch (error) {
    return { error: String(error) };
  }
}

/** Asserts a refusal by name (one of `expected`), under both ABIs, and that
 *  nothing crashed. An array of names is allowed because under `--wasmGc` a
 *  record that cannot be a struct is refused at the record, one hop earlier and
 *  still by name. */
function refused(name, source, expected) {
  const names = Array.isArray(expected) ? expected : [expected];
  for (const gc of [false, true]) {
    const tag = gc ? "wasmGc" : "ptr";
    const compiled = compile(source, gc);
    if (compiled.ok) {
      console.log(`  FAIL ${name} [${tag}]: compiled, expected a refusal`);
      ++failures;
      ++checks;
      continue;
    }
    const crashed = /AssertionError|compiler has crashed/.test(compiled.stderr);
    const named = names.some((text) => compiled.stderr.includes(text));
    check(`${name} [${tag}]`, { crashed, named }, { crashed: false, named: true });
  }
}

// --- 1. an inline struct as a plain-class field --------------------------

const plainClass = `@inline struct S { a: i32; b: i32; }
class C { s: S; tail: i32; }
export function valueSize(): i32 { return sizeof<S>(); }
export function offsetS(): i32 { return offsetof<C>("s"); }
export function offsetTail(): i32 { return offsetof<C>("tail"); }
export function roundTrip(): i32 { const c = new C(); c.s.a = 11; c.s.b = 22; c.tail = 33; return c.s.a * 10000 + c.s.b * 100 + c.tail; }
export function independent(): i32 { const a = new C(); const b = new C(); a.s.a = 1; b.s.a = 2; return a.s.a * 10 + b.s.a; }
export function fresh(): i32 { const c = new C(); return c.s.a + c.s.b + c.tail; }`;

for (const gc of [false, true]) {
  const tag = gc ? "wasmGc" : "ptr";
  const compiled = compile(plainClass, gc);
  if (!compiled.ok) { console.log(`  FAIL plain class [${tag}] did not compile`); ++failures; ++checks; continue; }
  check(`plain class: sizeof<S> [${tag}]`, run(compiled, "valueSize").value, 8);
  check(`plain class: offsetof s [${tag}]`, run(compiled, "offsetS").value, 0);
  check(`plain class: offsetof tail [${tag}]`, run(compiled, "offsetTail").value, 8);
  check(`plain class: round-trip [${tag}]`, run(compiled, "roundTrip").value, 112233);
  check(`plain class: instances independent [${tag}]`, run(compiled, "independent").value, 12);
  check(`plain class: fresh reads 0 [${tag}]`, run(compiled, "fresh").value, 0);
}

// --- 2. the record forms, and the view-form array field ------------------

const recordForms = `@inline struct S { a: i32; b: i32; }
@unmanaged class R { s: S; tail: i32; }
@managed struct M { s: S; tail: i32; }
export function recordOffset(): i32 { return offsetof<R>("s") * 10 + offsetof<R>("tail"); }
export function structOffset(): i32 { return offsetof<M>("s") * 10 + offsetof<M>("tail"); }
export function recordFresh(): i32 { const r = new R(); return r.s.a + r.s.b + r.tail; }
export function structFresh(): i32 { const m = new M(); return m.s.a + m.s.b + m.tail; }
export function recordRound(): i32 { const r = new R(); r.s.a = 11; r.s.b = 22; return r.s.a * 100 + r.s.b; }
export function structRound(): i32 { const m = new M(); m.s.a = 11; m.s.b = 22; return m.s.a * 100 + m.s.b; }`;

for (const gc of [false, true]) {
  const tag = gc ? "wasmGc" : "ptr";
  const compiled = compile(recordForms, gc);
  if (!compiled.ok) { console.log(`  FAIL record forms [${tag}] did not compile\n${compiled.stderr.split("\n").filter(l => /ERROR/.test(l)).join("\n")}`); ++failures; ++checks; continue; }
  check(`@unmanaged record: offsets 0/8 [${tag}]`, run(compiled, "recordOffset").value, 8);
  check(`@managed struct: offsets 0/8 [${tag}]`, run(compiled, "structOffset").value, 8);
  check(`@unmanaged record: fresh reads 0 [${tag}]`, run(compiled, "recordFresh").value, 0);
  check(`@managed struct: fresh reads 0 [${tag}]`, run(compiled, "structFresh").value, 0);
  check(`@unmanaged record: round-trip [${tag}]`, run(compiled, "recordRound").value, 1122);
  check(`@managed struct: round-trip [${tag}]`, run(compiled, "structRound").value, 1122);
}

// The view-form array field is a 4-byte pointer slot; its zero is the null
// pointer, read back through the record's own bytes so the check is about the
// constructor's fill, not about the allocator's fresh page.
const viewArrayField = `class C { a: @unmanaged [u32*4]; tail: i32; }
export function slot(): i32 { const c = new C(); return load<u32>(changetype<usize>(c) + offsetof<C>("a")); }
export function tail(): i32 { const c = new C(); return c.tail; }
export function round(): i32 { const c = new C(); c.a[0] = 7; c.a[3] = 9; return c.a[0] * 100 + c.a[3]; }`;

for (const gc of [false, true]) {
  const tag = gc ? "wasmGc" : "ptr";
  const compiled = compile(viewArrayField, gc);
  if (!compiled.ok) { console.log(`  FAIL view array field [${tag}] did not compile\n${compiled.stderr.split("\n").filter(l => /ERROR/.test(l)).join("\n")}`); ++failures; ++checks; continue; }
  check(`@unmanaged [T*N] field: accepted, slot zeroed [${tag}]`, run(compiled, "slot").value, 0);
  check(`@unmanaged [T*N] field: tail zeroed [${tag}]`, run(compiled, "tail").value, 0);
  check(`@unmanaged [T*N] field: round-trip [${tag}]`, run(compiled, "round").value, 709);
}

// --- 3. the guarantee that makes the plain-class arm safe --------------
//
// Round VT4 pinned three *positions*. Round VT6 moved the refusal one hop
// earlier — to the record's own declaration — so every position below now
// reports the same message, at the record, once: there is no type left to
// place. The positional arms are kept as the net and are pinned at the end of
// this section with a leaf the declaration check cannot name (a function type:
// `isManaged`, but with no class reference).

refused(
  "GC-reference leaf: refused at the declaration, in a plain-class inline field",
  `class M { v: i32; }
@inline struct S { m: M; }
class C { s: S; }
export function run(): i32 { const c = new C(); return c.s.m.v; }`,
  "a struct cannot hold a GC reference"
);
refused(
  "GC-reference leaf: refused at the declaration, in an @unmanaged record's inline field",
  `class M { v: i32; }
@inline struct S { m: M; }
@unmanaged class R { s: S; }
export function run(): i32 { const r = new R(); return r.s.m.v; }`,
  "a struct cannot hold a GC reference"
);
refused(
  "GC-reference leaf: refused at the declaration, in an inline array element",
  `class M { v: i32; }
@inline struct S { m: M; }
class B { s: [S * 2]; }
export function run(): i32 { const b = new B(); return b.s[0].m.v; }`,
  "a struct cannot hold a GC reference"
);
refused(
  "GC-reference leaf: refused at the declaration, in a bare inline-struct local",
  `class M { v: i32; }
@inline struct S { m: M; }
export function run(): i32 { let s: S = { m: new M() }; return s.m.v; }`,
  "a struct cannot hold a GC reference"
);
// The backstops, still reachable: a leaf the declaration check cannot name.
refused(
  "backstop: a function leaf in a plain-class inline field",
  `@inline struct S { f: () => void; }
class C { s: S; }
export function run(): i32 { const c = new C(); return 0; }`,
  "an @inline struct field 'f' of 'S' is a GC reference"
);
refused(
  "backstop: a function leaf in a bare inline-struct local",
  `@inline struct S { f: () => void; }
export function run(): i32 { let s: S; return 0; }`,
  "a GC-reference field in an @inline struct"
);

// --- 4. a fixed array of inline structs ----------------------------------

const arrayOfStructs = `@inline struct S { a: i32; b: i32; }
class B { s: [S * 2]; tail: i32; }
class T3 { s: [S * 3]; }
export function arraySize(): i32 { return sizeof<[S * 2]>(); }
export function offsetS(): i32 { return offsetof<B>("s"); }
export function offsetTail(): i32 { return offsetof<B>("tail"); }
export function twoElements(): i32 { const b = new B(); b.s[0].a = 13; b.s[0].b = 43; b.s[1].a = 32; b.s[1].b = 211; return b.s[0].a * 10000000 + b.s[0].b * 100000 + b.s[1].a * 1000 + b.s[1].b; }
export function threeElements(): i32 { const t = new T3(); t.s[0].a = 1; t.s[0].b = 2; t.s[1].a = 3; t.s[1].b = 4; t.s[2].a = 5; t.s[2].b = 6; return t.s[0].a * 100000 + t.s[0].b * 10000 + t.s[1].a * 1000 + t.s[1].b * 100 + t.s[2].a * 10 + t.s[2].b; }
export function fresh(): i32 { const b = new B(); return b.s[0].a + b.s[0].b + b.s[1].a + b.s[1].b + b.tail; }`;

for (const gc of [false, true]) {
  const tag = gc ? "wasmGc" : "ptr";
  const compiled = compile(arrayOfStructs, gc);
  if (!compiled.ok) { console.log(`  FAIL [S*2] [${tag}] did not compile\n${compiled.stderr.split("\n").filter(l => /ERROR/.test(l)).join("\n")}`); ++failures; ++checks; continue; }
  check(`[S * 2]: sizeof is 16 [${tag}]`, run(compiled, "arraySize").value, 16);
  check(`[S * 2]: offsets 0/16 [${tag}]`, run(compiled, "offsetS").value * 100 + run(compiled, "offsetTail").value, 16);
  check(`[S * 2]: two elements are two slots (134332211) [${tag}]`, run(compiled, "twoElements").value, 134332211);
  check(`[S * 2]: three elements are three slots [${tag}]`, run(compiled, "threeElements").value, 123456);
  check(`[S * 2]: fresh reads 0 [${tag}]`, run(compiled, "fresh").value, 0);
}

// --- 5. nested fixed arrays ---------------------------------------------

const nested = `class C { g: [[i32 * 4] * 2]; tail: i32; }
export function arraySize(): i32 { return sizeof<[[i32 * 4] * 2]>(); }
export function offsetTail(): i32 { return offsetof<C>("tail"); }
export function roundTrip(): i32 { const c = new C(); c.g[0][0] = 1; c.g[0][3] = 4; c.g[1][0] = 5; c.g[1][3] = 8; return c.g[0][0] * 1000000 + c.g[0][3] * 10000 + c.g[1][0] * 100 + c.g[1][3]; }
export function fresh(): i32 { const c = new C(); return c.g[0][0] + c.g[0][3] + c.g[1][0] + c.g[1][3] + c.tail; }`;

for (const gc of [false, true]) {
  const tag = gc ? "wasmGc" : "ptr";
  const compiled = compile(nested, gc);
  if (!compiled.ok) { console.log(`  FAIL nested [${tag}] did not compile\n${compiled.stderr.split("\n").filter(l => /ERROR/.test(l)).join("\n")}`); ++failures; ++checks; continue; }
  check(`nested: sizeof is 32 [${tag}]`, run(compiled, "arraySize").value, 32);
  check(`nested: tail offset is 32 [${tag}]`, run(compiled, "offsetTail").value, 32);
  check(`nested: round-trip 1040508 [${tag}]`, run(compiled, "roundTrip").value, 1040508);
  check(`nested: fresh reads 0 [${tag}]`, run(compiled, "fresh").value, 0);
}

// A nested array in a position that needs leaves stays a diagnostic -- the
// point is that it is *named*, not that the compiler asserts.
refused(
  "nested array as a parameter",
  `function takes(x: [[i32 * 4] * 2]): i32 { return x[0][0]; }
export function run(): i32 { return takes([[1, 2, 3, 4], [5, 6, 7, 8]]); }`,
  "a nested `[T * N]` value as a parameter"
);
refused(
  "nested array as a return type",
  `function makes(): [[i32 * 4] * 2] { return [[1, 2, 3, 4], [5, 6, 7, 8]]; }
export function run(): i32 { return makes()[0][0]; }`,
  "a nested `[T * N]` value as a return type"
);
refused(
  "nested array as a local",
  `export function run(n: i32): i32 { if (n == 1) { let a: [[i32 * 4] * 2]; } return 0; }`,
  "a `[T * N]` value with an element that cannot live in one WASM local"
);

// --- 6. the fronts this round leaves closed ------------------------------

refused(
  "`@managed [T * N]` as a field stays Landing 5c",
  `@managed struct M { a: @managed [u32 * 4]; }
export function run(): i32 { const m = new M(); return 0; }`,
  "heap fixed-extent is Landing 5c"
);

// --- result -------------------------------------------------------------

if (failures) {
  console.log(`\nFAILURE: ${failures} of ${checks} checks failed`);
  process.exit(1);
} else {
  console.log(`\n[ SUCCESS ] ${checks} checks`);
}
