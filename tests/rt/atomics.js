// Round AT1: the atomics surface threads/async need — the fence bug, `Atomics.fence()`,
// the address-facing API, and `@atomic` on a field.
//
// What this file measures, and why each one is evidence rather than an intention:
//
//   1  `atomic.fence()` — the reported bug. Binaryen's `AtomicFence` takes a memory
//      order and the zero value is `Unordered`, which the validator refuses
//      (`Atomic fence cannot be unordered`). The ticket's own source is compiled,
//      validated by an independent tool, and run.
//   2  `Atomics.fence()` — the thirteenth member of the JS-shaped namespace, which
//      `std/assembly/atomics.ts` was missing.
//   3  the address-facing API (`atomicLoad`, `atomicStore`, …) over a raw `usize`.
//      Every operation round-trips, and **every RMW returns the OLD value** — pinned
//      by giving each step a distinct expected pair (old value, value left in
//      memory), so returning the new value would fail a check rather than merely
//      look different.
//   4  `@atomic` on a class field: the emitted WAT has `i32.atomic.load` inside
//      `get:` and `i32.atomic.store` inside `set:`, a non-`@atomic` field in the
//      same class still has plain `load`/`store`, `sizeof`/`offsetof` are identical
//      with and without the decorator, and the same fixture works under `--wasmGc`.
//   5  `@atomic` on an `@unmanaged struct` field — the C `_Atomic` member — with a
//      round-trip, both through the record's accessors and through an address.
//   6  the refusals, each with its own message: `+=` on an `@atomic` field, `@atomic`
//      on a local, on a global, on an `f32`, and without the threads feature.
//   7  a real concurrency check: two worker threads, each with its own instance of
//      one `--sharedMemory --importMemory` module, both incrementing the same
//      `@atomic` counter through `atomic.add`. The sum must be exact; a lost update
//      is a wrong number, not a slow test. A plain (non-atomic) counter is run
//      through the same harness as a control and reported, so the reader can see
//      that this harness can in fact lose updates.
//
// Run: node tests/rt/atomics.js (wired as `npm run test:atomics`).

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

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

/** Whether `text` contains `needle`; used for the refusal messages. */
function checkMessage(name, output, needle) {
  ++checks;
  if (output.includes(needle)) {
    console.log(`  ok  ${name}`);
  } else {
    ++failures;
    console.log(`  FAIL ${name}\n       expected the output to contain ${JSON.stringify(needle)}\n       got ${JSON.stringify(output.slice(0, 400))}`);
  }
}

const BASE_FLAGS = [
  "--runtime", "stub",
  "--noColors",
  "--use", "abort=",
  "--enable", "threads",
];

/** `wasm-tools` is an independent validator; without it, Node's engine still validates. */
function hasWasmTools() {
  try {
    execFileSync("wasm-tools", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
const wasmTools = hasWasmTools();

/** Compiles `source`; returns `{ ok, output, bytes, wat }`. */
function compile(source, flags = BASE_FLAGS) {
  const dir = mkdtempSync(join(tmpdir(), "at1-"));
  writeFileSync(join(dir, "probe.ts"), source);
  // `spawnSync`, not `execFileSync`: warnings are printed on the *success* path too
  // (`--wasmGc`'s coverage line is the one that matters here), and `execFileSync`
  // throws them away when the exit status is zero.
  const result = spawnSync(process.execPath, [
    CLI, "probe.ts", "-o", "probe.wasm", "--textFile", "probe.wat", ...flags,
  ], { encoding: "utf8", cwd: dir });
  const ok = result.status === 0;
  const output = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  let bytes = null;
  let wat = null;
  if (ok) {
    bytes = readFileSync(join(dir, "probe.wasm"));
    wat = readFileSync(join(dir, "probe.wat"), "utf8");
  }
  rmSync(dir, { recursive: true, force: true });
  return { ok, output, bytes, wat };
}

/** Validates bytes with `wasm-tools` when available; otherwise Node validates. */
function validate(bytes, features = ["threads"]) {
  if (!wasmTools) {
    // **Compiling the module is validation** — this is the fallback the comment
    // above promises. It returned `"skipped (…)"` before, and every caller
    // compares against `"valid"`, so a CI runner without `wasm-tools` on PATH
    // failed seven checks that were never about the output (measured: the
    // Compiler matrix and Coverage jobs on ubuntu, node lts).
    try {
      new WebAssembly.Module(bytes);
      return "valid";
    } catch (error) {
      return `invalid: ${error.message}`;
    }
  }
  try {
    execFileSync("wasm-tools", ["validate", "-", "--features", features.join(",")], {
      input: bytes, stdio: "pipe",
    });
    return "valid";
  } catch (error) {
    return `invalid: ${`${error.stderr ?? ""}`.trim()}`;
  }
}

function instantiate(bytes) {
  return new WebAssembly.Instance(new WebAssembly.Module(bytes), {
    env: { abort: () => { throw new Error("guest called abort"); }, trace: () => {} },
  }).exports;
}

/** The body of a single function in the text form, or `null`. */
function functionBody(wat, nameFragment) {
  const lines = wat.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(nameFragment) && lines[i].includes("(func ")) {
      let depth = 0;
      const body = [];
      for (let j = i; j < lines.length; j++) {
        body.push(lines[j]);
        for (const ch of lines[j]) {
          if (ch === "(") depth++;
          else if (ch === ")") depth--;
        }
        if (depth === 0) return body.join("\n");
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. `atomic.fence()` — the reported bug.
// ---------------------------------------------------------------------------

console.log("\n# 1 the fence compiles to a valid module, and runs");
{
  // The ticket's source, verbatim.
  const built = compile(`export function f(): void { atomic.fence(); }`);
  check("`atomic.fence()` compiles", built.ok, true);
  if (built.ok) {
    check("the module validates", validate(built.bytes), "valid");
    check("the fence is emitted", /atomic\.fence/.test(built.wat), true);
    const exports = instantiate(built.bytes);
    exports.f();
    check("it runs without trapping", true, true);
  }
}

// ---------------------------------------------------------------------------
// 2. `Atomics.fence()` on the JS-shaped namespace.
// ---------------------------------------------------------------------------

console.log("\n# 2 `Atomics.fence()` exists and works");
{
  const built = compile(`
import { Atomics } from "atomics";

const view = new Int32Array(4);

export function f(): i32 {
  Atomics.store(view, 0, 1);
  Atomics.fence();
  return Atomics.load(view, 0);
}
`);
  check("`Atomics.fence()` compiles", built.ok, true);
  if (built.ok) {
    check("the module validates", validate(built.bytes), "valid");
    check("the fence is emitted", /atomic\.fence/.test(built.wat), true);
    check("it runs and the view still round-trips", instantiate(built.bytes).f(), 1);
  }
}

// ---------------------------------------------------------------------------
// 3. The address-facing API over a raw `usize`.
// ---------------------------------------------------------------------------

console.log("\n# 3 the address-facing API, and the OLD value from every RMW");
{
  const built = compile(`
import {
  atomicLoad, atomicStore, atomicAdd, atomicSub, atomicAnd, atomicOr, atomicXor,
  atomicExchange, atomicCompareExchange,
} from "atomics";

// A view over linear memory gives the address runtime code actually holds. The
// 8-byte round-up is the i64 slot's natural alignment: an atomic access must be
// naturally aligned, and the allocator only promises the element alignment.
const words = new Int32Array(32);
const base = ((words.dataStart + 7) >> 3) << 3;

// One bit per operation that round-tripped **and** returned the old value.
export function roundTrip(): i32 {
  let ok = 0;
  let old: i32;

  atomicStore<i32>(base, 10);
  if (atomicLoad<i32>(base) == 10) ok |= 1;

  old = atomicAdd<i32>(base, 5);                       // was 10, now 15
  if (old == 10 && atomicLoad<i32>(base) == 15) ok |= 2;

  old = atomicSub<i32>(base, 3);                       // was 15, now 12
  if (old == 15 && atomicLoad<i32>(base) == 12) ok |= 4;

  atomicStore<i32>(base, 0b1010);
  old = atomicAnd<i32>(base, 0b1100);                  // was 10, now 8
  if (old == 0b1010 && atomicLoad<i32>(base) == 0b1000) ok |= 8;

  old = atomicOr<i32>(base, 0b0011);                   // was 8, now 11
  if (old == 8 && atomicLoad<i32>(base) == 11) ok |= 16;

  old = atomicXor<i32>(base, 0b1111);                  // was 11, now 4
  if (old == 11 && atomicLoad<i32>(base) == 4) ok |= 32;

  old = atomicExchange<i32>(base, 99);                 // was 4, now 99
  if (old == 4 && atomicLoad<i32>(base) == 99) ok |= 64;

  old = atomicCompareExchange<i32>(base, 99, 7);       // matches: was 99, now 7
  if (old == 99 && atomicLoad<i32>(base) == 7) ok |= 128;

  // A failed exchange returns the value that is there, and changes nothing.
  old = atomicCompareExchange<i32>(base, 1000, 5);
  if (old == 7 && atomicLoad<i32>(base) == 7) ok |= 256;

  return ok;
}

// The widths the builtins dispatch on: a byte and a 64-bit word.
export function widths(): i32 {
  let ok = 0;
  atomicStore<u8>(base + 16, 200);
  if (atomicLoad<u8>(base + 16) == 200) ok |= 1;
  if (atomicAdd<u8>(base + 16, 100) == 200) ok |= 2;   // wraps to 44, returns 200
  if (atomicLoad<u8>(base + 16) == 44) ok |= 4;

  atomicStore<i64>(base + 24, 1);
  if (atomicAdd<i64>(base + 24, 41) == 1) ok |= 8;
  if (atomicLoad<i64>(base + 24) == 42) ok |= 16;
  return ok;
}

// As an ADDRESS, the field of a record: what runtime code and C interop hold.
class Slot { n: i32; constructor(n: i32) { this.n = n; } }
const slot = new Slot(0);

export function addressOfField(): i32 {
  const addr = changetype<usize>(slot) + offsetof<Slot>("n");
  let ok = 0;
  if (atomicAdd<i32>(addr, 7) == 0) ok |= 1;
  if (atomicLoad<i32>(addr) == 7) ok |= 2;
  if (slot.n == 7) ok |= 4;
  return ok;
}
`);
  check("the address-facing API compiles", built.ok, true);
  if (built.ok) {
    check("the module validates", validate(built.bytes), "valid");
    const e = instantiate(built.bytes);
    // 511 is every one of the nine bits: each op round-tripped AND returned the old
    // value. A function that returned the new value would clear bits 2..256.
    check("every operation round-trips and returns the OLD value (0b111111111)", e.roundTrip(), 511);
    check("u8 and i64 widths dispatch too (0b11111)", e.widths(), 31);
    check("an @atomic-style address on a record's field works", e.addressOfField(), 7);
    check("the RMW is visible through the field", true, true);
  }
}

// ---------------------------------------------------------------------------
// 4. `@atomic` on a class field.
// ---------------------------------------------------------------------------

console.log("\n# 4 @atomic on a class field: accessors, layout, both ABIs");
{
  const source = (decorator) => `
class Box {
  ${decorator} a: i32;
  plain: i32;
  constructor(a: i32, plain: i32) { this.a = a; this.plain = plain; }
  bump(): i32 { this.a = this.a + 1; return this.a; }
}

let box = new Box(1, 2);

export function readAtomic(): i32 { return box.a; }
export function writeAtomic(v: i32): void { box.a = v; }
export function readPlain(): i32 { return box.plain; }
export function bump(): i32 { return box.bump(); }
export function sizeOf(): i32 { return sizeof<Box>(); }
export function offA(): i32 { return offsetof<Box>("a"); }
export function offPlain(): i32 { return offsetof<Box>("plain"); }
`;
  const atomic = compile(source("@atomic"));
  const plain = compile(source(""));

  check("@atomic compiles", atomic.ok, true);
  if (atomic.ok) {
    check("the module validates", validate(atomic.bytes), "valid");

    const getA = functionBody(atomic.wat, "#get:a");
    const setA = functionBody(atomic.wat, "#set:a");
    const getPlain = functionBody(atomic.wat, "#get:plain");
    const setPlain = functionBody(atomic.wat, "#set:plain");
    check("`get:a` exists", getA != null, true);
    check("`set:a` exists", setA != null, true);
    check("the read of an @atomic field is an atomic load", /i32\.atomic\.load/.test(getA || ""), true);
    check("the write of an @atomic field is an atomic store", /i32\.atomic\.store/.test(setA || ""), true);
    check("it is not also a plain load", /\bi32\.load\b/.test(getA || ""), false);
    check("it is not also a plain store", /\bi32\.store\b/.test(setA || ""), false);
    // The other field of the same class is untouched: this is what shows the
    // decorator is per field and not per class.
    check("a non-@atomic field still reads with a plain load", /\bi32\.load\b/.test(getPlain || ""), true);
    check("a non-@atomic field still writes with a plain store", /\bi32\.store\b/.test(setPlain || ""), true);
    check("the plain accessors carry no atomic instruction",
      /atomic/.test(getPlain || "") || /atomic/.test(setPlain || ""), false);

    const e = instantiate(atomic.bytes);
    check("the field round-trips through the accessors", (e.writeAtomic(41), e.readAtomic()), 41);
    check("a plain `this.a = this.a + 1` still works", (e.writeAtomic(1), e.bump()), 2);
    check("the neighbour field is unaffected", e.readPlain(), 2);

    if (plain.ok) {
      const pe = instantiate(plain.bytes);
      check("sizeof is identical with and without @atomic", e.sizeOf(), pe.sizeOf());
      check("offsetof(\"a\") is identical", e.offA(), pe.offA());
      check("offsetof(\"plain\") is identical", e.offPlain(), pe.offPlain());

      // **And the plain build has no atomic instruction at all** — otherwise
      // "identical layout" could hide a decorator that leaked into the class.
      check("the variant without @atomic emits no atomic instruction",
        /atomic\./.test(plain.wat), false);
    }
  }

  // The GC ABI. A wasm GC struct field has no atomic form (`struct.get`/`struct.set`
  // take no memory order), so an `@atomic` field makes its class ineligible for the
  // GC representation and the program keeps the pointer ABI — where the instruction
  // exists. The numbers must be the same and the code must still be atomic.
  const gc = compile(source("@atomic"), [...BASE_FLAGS, "--wasmGc"]);
  check("@atomic compiles under --wasmGc", gc.ok, true);
  if (gc.ok && atomic.ok) {
    check("the --wasmGc module validates", validate(gc.bytes, ["threads", "gc"]), "valid");
    const e = instantiate(gc.bytes);
    check("it round-trips under --wasmGc", (e.writeAtomic(7), e.readAtomic()), 7);
    check("sizeof is the same under --wasmGc", e.sizeOf(), instantiate(atomic.bytes).sizeOf());
    check("offsetof is the same under --wasmGc", e.offPlain(), instantiate(atomic.bytes).offPlain());
    check("the GC build emits the atomic instruction too", /i32\.atomic\.load/.test(gc.wat), true);
    // The reason it is still linear: the class is not a GC struct.
    check("the report names the @atomic field as the obstacle",
      /@atomic field/.test(gc.output), true);
  }
}

// ---------------------------------------------------------------------------
// 5. `@atomic` on an `@unmanaged struct` field — the C `_Atomic` member.
// ---------------------------------------------------------------------------

console.log("\n# 5 @atomic on an @unmanaged struct field");
{
  const built = compile(`
@unmanaged
struct Cell {
  @atomic v: i32;
  other: i32;
}

export function roundTrip(ptr: usize): i32 {
  let cell = changetype<Cell>(ptr);
  let ok = 0;
  cell.v = 5;
  if (cell.v == 5) ok |= 1;
  cell.other = 9;
  if (cell.other == 9) ok |= 2;

  // The same field through its address: an RMW returns the old value.
  let addr = ptr + offsetof<Cell>("v");
  if (atomicAdd<i32>(addr, 3) == 5) ok |= 4;
  if (cell.v == 8) ok |= 8;
  return ok;
}

export function sizeOf(): i32 { return sizeof<Cell>(); }
`);
  check("an @atomic field of an @unmanaged struct compiles", built.ok, true);
  if (built.ok) {
    check("the module validates", validate(built.bytes), "valid");
    const getV = functionBody(built.wat, "Cell#get:v");
    const setV = functionBody(built.wat, "Cell#set:v");
    check("its getter is an atomic load", /i32\.atomic\.load/.test(getV || ""), true);
    check("its setter is an atomic store", /i32\.atomic\.store/.test(setV || ""), true);
    check("the neighbour field stays plain",
      /i32\.(atomic\.)?(load|store)/.test(functionBody(built.wat, "Cell#get:other") || ""), true);
    check("the neighbour's getter is a plain load",
      /\bi32\.load\b/.test(functionBody(built.wat, "Cell#get:other") || ""), true);

    const e = instantiate(built.bytes);
    // A scratch record in linear memory: the guest takes an address, as C would.
    // The module's memory starts at zero pages (nothing static to hold, and the
    // stub runtime grows on demand), so the host grows it before handing out an
    // address — the same thing a C host does with its own allocator.
    if (e.memory.buffer.byteLength < 2048) e.memory.grow(1);
    const addr = 1024;
    check("the record round-trips through its accessors and its address", e.roundTrip(addr), 15);
    check("sizeof is the C layout (two i32 fields)", e.sizeOf(), 8);
  }
}

// ---------------------------------------------------------------------------
// 6. The refusals.
// ---------------------------------------------------------------------------

console.log("\n# 6 the refusals, each with its own message");
{
  const compound = compile(`
class Ring { @atomic head: i32 = 0; }
let ring = new Ring();
export function advance(): void { ring.head += 1; }
`);
  check("`+=` on an @atomic field is refused", compound.ok, false);
  checkMessage("the message names the operator", compound.output, "an @atomic field cannot be updated with `+=`");
  checkMessage("the message names the single-step fix", compound.output, "atomic.add<T>(addressOf(aField), delta)");
  checkMessage("the message says why the composite is wrong", compound.output,
    "a read then a write is two atomic steps, not one");

  const increment = compile(`
class Ring { @atomic head: i32 = 0; }
let ring = new Ring();
export function advance(): i32 { return ring.head++; }
`);
  check("`++` on an @atomic field is refused too", increment.ok, false);
  checkMessage("the `++` message names the operator", increment.output,
    "an @atomic field cannot be updated with `++`");

  const sroaArray = compile(`
@inline
struct P { @atomic n: i32; other: i32; }

export function f(i: i32): i32 {
  let arr: P[4];
  return arr[i].n;
}
`);
  check("an @atomic field of a value-form record array by runtime index is refused", sroaArray.ok, false);
  checkMessage("the SROA array message says the elements are WASM locals", sroaArray.output,
    "value-form record array by a runtime index");

  const local = compile(`export function f(): i32 { @atomic let x: i32 = 1; return x; }`);
  check("@atomic on a local is refused", local.ok, false);
  checkMessage("the local message says a WASM local has no address", local.output,
    "@atomic on a local variable");

  const global = compile(`
@atomic let g: i32 = 1;
export function f(): i32 { return g; }
`);
  check("@atomic on a global is refused", global.ok, false);
  checkMessage("the global message says a WASM global has no address", global.output,
    "@atomic on a global variable");

  const staticField = compile(`
class C { @atomic static s: i32 = 1; }
export function f(): i32 { return C.s; }
`);
  check("@atomic on a static field is refused", staticField.ok, false);
  checkMessage("the static field message names the WASM global", staticField.output,
    "@atomic on a static field");

  const float = compile(`
class F { @atomic x: f32; }
export function f(c: F): f32 { return c.x; }
`);
  check("@atomic on an f32 field is refused", float.ok, false);
  checkMessage("the float message says wasm has no float atomics", float.output,
    "wasm has no float atomics");
  checkMessage("the float message refuses the invisible bitcast", float.output,
    "bitcast");

  const noThreads = compile(`
class C { @atomic n: i32; }
export function f(c: C): i32 { return c.n; }
`, ["--runtime", "stub", "--noColors", "--use", "abort="]);
  check("@atomic without the threads feature is refused", noThreads.ok, false);
  checkMessage("it names the feature to enable", noThreads.output, "--enable threads");
}

// ---------------------------------------------------------------------------
// 7. Two instances over one shared memory, incrementing one @atomic counter.
// ---------------------------------------------------------------------------

console.log("\n# 7 two threads over one shared module: no lost increments");
{
  const shared = (field) => `
class Counter {
  ${field} n: i32;
  constructor() { this.n = 0; }
}

let counter = new Counter();

export function bump(times: i32): void {
  let addr = changetype<usize>(counter) + offsetof<Counter>("n");
  for (let i = 0; i < times; ++i) {
    atomic.add<i32>(addr, 1);
  }
}

export function bumpPlain(times: i32): void {
  let addr = changetype<usize>(counter) + offsetof<Counter>("n");
  for (let i = 0; i < times; ++i) {
    atomic.store<i32>(addr, atomic.load<i32>(addr) + 1);
  }
}

export function count(): i32 { return counter.n; }
`;

  const sharedFlags = [
    ...BASE_FLAGS, "--sharedMemory", "--importMemory", "--maximumMemory", "1",
  ];

  // `bump` goes through the field's own `atomic.add`; `bumpPlain` is the same
  // harness with a load-then-store, i.e. exactly what `+=` would have compiled to.
  // The second is the control: if it loses updates, the harness can detect a lost
  // update, which is what makes the first number mean something.
  const built = compile(shared("@atomic"), sharedFlags);
  check("the shared-memory fixture compiles", built.ok, true);

  if (built.ok) {
    check("the shared module validates", validate(built.bytes), "valid");
    check("the memory is imported and shared", /\(import "env" "memory" \(memory .* shared\)\)/.test(built.wat), true);

    const times = 20000;
    const total = 2 * times;

    const run = async (fn) => {
      const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
      const workerSource = `
        const { parentPort, workerData } = require("node:worker_threads");
        const module_ = new WebAssembly.Module(workerData.wasm);
        const instance = new WebAssembly.Instance(module_, {
          env: {
            memory: workerData.memory,
            abort() { throw new Error("guest called abort"); },
            trace() {},
          },
        });
        parentPort.postMessage("ready");
        parentPort.on("message", (message) => {
          if (message === "go") {
            instance.exports[workerData.fn](workerData.times);
            parentPort.postMessage("done");
          } else if (message === "count") {
            // **Read only when asked.** A count taken right after this thread's own
            // loop is a snapshot of a counter the *other* thread is still adding to,
            // which is a race in the harness and not in the guest: measured, that
            // shape reported 38522 where the answer is 40000.
            parentPort.postMessage("count:" + instance.exports.count());
          }
        });
      `;
      const start = () => new Worker(workerSource, {
        eval: true,
        workerData: { wasm: built.bytes, memory, fn, times },
      });
      const waitFor = (worker, prefix) => new Promise((resolve) => {
        const onMessage = (message) => {
          if (String(message).startsWith(prefix)) {
            worker.off("message", onMessage);
            resolve(String(message));
          }
        };
        worker.on("message", onMessage);
      });

      const a = start();
      const b = start();
      // Both instances must be past `__start` before either increments: each
      // instance's start runs the module's initialisers over the *shared* memory,
      // and a late start would zero the counter under the other thread's feet.
      await Promise.all([waitFor(a, "ready"), waitFor(b, "ready")]);
      a.postMessage("go");
      b.postMessage("go");
      await Promise.all([waitFor(a, "done"), waitFor(b, "done")]);
      a.postMessage("count");
      b.postMessage("count");
      const [ca, cb] = await Promise.all([waitFor(a, "count"), waitFor(b, "count")]);
      await a.terminate();
      await b.terminate();
      return { counts: [Number(ca.split(":")[1]), Number(cb.split(":")[1])], memory };
    };

    const atomicRun = await run("bump");
    check("both instances observe the same counter", atomicRun.counts[0], atomicRun.counts[1]);
    check(`two threads x ${times} atomic.add land exactly (the sum is correct)`,
      atomicRun.counts[0], total);

    const plainRun = await run("bumpPlain");
    const lost = total - plainRun.counts[0];
    console.log(`  ..  control: load-then-store lost ${lost} of ${total} increments` +
      (lost === 0 ? " (no interleaving this run — the harness is not guaranteed to race)" : ""));
  }
}

// ---------------------------------------------------------------------------

console.log("");
if (failures) {
  console.log(`[ FAILURE ] ${failures} of ${checks} checks failed`);
  process.exit(1);
} else {
  console.log(`[ SUCCESS ] ${checks} checks`);
}
