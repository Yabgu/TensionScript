// Round TH1: the runtime arena — one heap per thread, in one shared memory.
//
// Measured at `3238905b`, a shared-memory module compiled with
// `--runtime incremental --enable threads --sharedMemory` had **zero** atomic
// instructions anywhere, which is a defect and not a saving: `tlsf`'s free lists
// are linked structures mutated on every alloc/free, so two threads allocating
// against one heap interleave `block.next.prev = …` and `flMap`/`slMap` writes
// and corrupt the lists on the first concurrent allocation. And `itcms`'s
// `visitStack` walks `[__stack_pointer, __heap_base)`, which is *this instance's*
// stack region: a collection in A cannot see B's stack, so anything reachable
// only from B is swept while live.
//
// The fix is not atomics plus a cross-thread collector — a store's stack is not
// visible from another store, so a stop-the-world across threads is not
// implementable here. It is one heap per thread: the runtime is parametrized by
// an **arena**, a `[base, end)` span that owns its allocator state, its collector
// state and its stack region. Disjoint arenas make the allocator's lack of
// atomics correct — the same bargain a thread-local allocator makes in any C
// runtime — and they make `visitStack` correct as written, because per-instance
// globals delimit that instance's own region.
//
// What this file measures:
//
//   1  default path — no arena configured, the runtime spans the whole memory
//      and allocates above `__heap_base`, exactly as before
//   1b a build without `--sharedMemory` carries no arena machinery at all
//   2  arena bounds — `__arenaInit(base, size)`: every pointer is in
//      `[base, base+size)`, `__arenaHeapBase()` reflects the new base, and the
//      stack pointer is inside the arena below it
//   3  re-init — a second `__arenaInit` with different bounds re-initializes
//      cleanly; allocations land in the new arena
//   4  collection — a collection inside the arena writes nothing outside it
//      (guard bytes on both sides survive) and live objects survive it
//   5  two arenas in one shared memory — one `--sharedMemory --importMemory`
//      module instantiated twice, two arenas, independent allocation
//   6  the atomic count — zero in the allocator, and now correct rather than a
//      defect, with the arena bounds as the reason
//   7  the other two runtimes (`stub`, `minimal`/`tcms`) take the same bounds
//   8  `--wasmGc` allocates through the compiler's bump allocator, so it has no
//      runtime-side arena — and it exports no entry point that would pretend it had
//
// Run: node tests/rt/arena.js (wired as `npm run test:arena`).

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

/**
 * The fixture. `allocLoop` checks every pointer it gets against the runtime's own
 * idea of the arena (`__arenaHeapBase()`, `__arenaEnd()`) — the host checks
 * separately that those two reflect the bounds it passed in, so "every pointer is
 * in `[base, base+size)`" is a chain and not an assumption. `keep` is a live root
 * for the collection test, and `tag`/`getTag` are how the host reads it back.
 */
const FIXTURE = `
class K { a: i32 = 1; b: i32 = 2; }

let keep: K = new K();
let minPtr: usize = 0;
let maxPtr: usize = 0;

export function heapBase(): usize { return __arenaHeapBase(); }
export function arenaEnd(): usize { return __arenaEnd(); }
export function staticHeapBase(): usize { return __heap_base; }
export function stackPointer(): usize { return __stack_pointer; }
export function minPointer(): usize { return minPtr; }
export function maxPointer(): usize { return maxPtr; }
export function minMaxReset(): void { minPtr = 0; maxPtr = 0; }
export function tag(value: i32): void { keep.a = value; }
export function getTag(): i32 { return keep.a; }
export function resetKeep(): void { keep = new K(); }

/** Allocates \`n\` objects; answers how many landed outside the runtime's arena. */
export function allocLoop(n: i32): i32 {
  let hb = __arenaHeapBase();
  let end = __arenaEnd();
  if (!end) end = <usize>memory.size() << 16; // no arena: the runtime spans the memory
  let bad = 0;
  for (let i = 0; i < n; ++i) {
    let k = new K();
    let p = changetype<usize>(k);
    if (!minPtr || p < minPtr) minPtr = p;
    if (p > maxPtr) maxPtr = p;
    if (!(p >= hb && p + offsetof<K>() <= end)) ++bad;
    if (k.a != 1 || k.b != 2) ++bad;
  }
  return bad;
}
`;

const BASE_FLAGS = [
  "--runtime", "incremental",
  "--enable", "threads",
  "--sharedMemory",
  "--maximumMemory", "8",
  "--enable", "stack-switching", "--stackful-backend", "continuation",
  "--noColors",
  "--use", "abort=",
  "--exportRuntime",
];

/** Compiles `source` and returns the bytes and, on request, the text. */
function compile({ flags = BASE_FLAGS, source = FIXTURE, text = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "th1-arena-"));
  writeFileSync(join(dir, "probe.ts"), source);
  const args = [CLI, "probe.ts", "-o", "probe.wasm", "--textFile", "probe.wat", ...flags];
  let ok = true;
  let output = "";
  try {
    execFileSync(process.execPath, args, { stdio: "pipe", cwd: dir });
  } catch (error) {
    ok = false;
    output = `${error.stderr ?? ""}${error.stdout ?? ""}`;
  }
  let bytes = null;
  let wat = null;
  if (ok) {
    bytes = readFileSync(join(dir, "probe.wasm"));
    if (text) wat = readFileSync(join(dir, "probe.wat"), "utf8");
  }
  rmSync(dir, { recursive: true, force: true });
  return { ok, output, bytes, wat };
}

/**
 * Instantiates a module, against a host memory when it imports one.
 *
 * **A `--sharedMemory` module runs nothing at instantiation** (`docs/thread-abi.md`
 * §4a). A start section would run on every instantiation, and this module is
 * instantiated once per thread, so the boot body is the plain export
 * `__start() -> i32` and the host chooses the entry. A forgotton `__start()`
 * fails silently: `@lazy` globals never initialise, `__arenaHeapBase()` answers
 * `0`, `__asyncStatus` stays `0`, and the host waits forever. So the helper
 * calls it whenever the export exists; a non-shared build has no such export
 * and keeps its start section.
 *
 * The two thread imports are stubbed with the "no pool" answers, because since
 * the shared-memory thread surface is emitted regardless of the async shell
 * (`src/compiler.ts`, the `sharedMemory && !gcActive` gate) a `--sharedMemory`
 * module carries `env.__executorCount` and `env.__startThread` even when it only
 * wants an arena. `1` is main alone and `-1` is "no machine": the same answers a
 * host with no pool gives, and nothing in this file spawns.
 */
function instantiate(bytes, memory = null) {
  const env = { __executorCount: () => 1, __startThread: () => -1 };
  if (memory) env.memory = memory;
  const imports = { env };
  const exports = new WebAssembly.Instance(new WebAssembly.Module(bytes), imports).exports;
  if (typeof exports.__start === "function") exports.__start();
  return exports;
}

const PAGE = 0x10000;
const BASE = 0x20000; // 128 KiB, well inside 8 pages
const SIZE = 0x20000; // 128 KiB
const END = BASE + SIZE;
/** The module's default stack size (`--stackSize`'s default), which an arena mirrors. */
const STACK = 32768;

function pagesOf(exports) {
  return exports.memory.buffer.byteLength / PAGE;
}

// ---------------------------------------------------------------------------
// 1. Default path: no arena configured, nothing changes.
// ---------------------------------------------------------------------------

console.log("\n# 1 the default path spans the whole memory");
{
  const built = compile();
  check("the fixture compiles", built.ok, true);
  if (built.ok) {
    const e = instantiate(built.bytes);
    check("no arena is configured", e.arenaEnd(), 0);
    check("the heap base is still `__heap_base`", e.heapBase(), e.staticHeapBase());
    check("64 allocations, none of them outside the memory", e.allocLoop(64), 0);
    check("the first allocation is above `__heap_base`", e.minPointer() >= e.staticHeapBase(), true);
    check("a collection on the default path still works", (e.__collect(), e.getTag()), 1);
  }
}

// ---------------------------------------------------------------------------
// 1b. A build that does not share memory carries no arena at all.
// ---------------------------------------------------------------------------

console.log("\n# 1b a build without `--sharedMemory` emits no arena machinery");
{
  // A plain program — no arena entry points referenced — built without
  // `--sharedMemory`: the emitted module must contain no trace of an arena.
  const built = compile({
    flags: BASE_FLAGS.filter((f) => f !== "--sharedMemory"),
    source: "class K { a: i32 = 1; }\nexport function mk(): i32 { let k = new K(); return k.a; }\n",
    text: true,
  });
  check("the plain fixture compiles", built.ok, true);
  if (built.ok) {
    check("no `__arenaInit` export", /export "__arenaInit"/.test(built.wat), false);
    check("no arena globals", /ARENA|HEAP_BASE/.test(built.wat), false);
    check("no `ASC_ARENA` global", /ASC_ARENA/.test(built.wat), false);
    check("no `__arenaPlaceState`", /arenaPlaceState|outsideArena/.test(built.wat), false);
  }
}

// ---------------------------------------------------------------------------
// 2. Arena bounds: every pointer in `[base, base+size)`.
// ---------------------------------------------------------------------------

console.log("\n# 2 the arena is respected");
{
  const built = compile();
  if (built.ok) {
    const e = instantiate(built.bytes);
    e.memory.grow(8 - pagesOf(e)); // the host owns the pages the arena names
    check("memory covers the arena", e.memory.buffer.byteLength >= END, true);

    e.__arenaInit(BASE, SIZE);
    const hb = e.heapBase();
    check("`__arenaEnd()` is the arena's end", e.arenaEnd(), END);
    check("`__arenaHeapBase()` is inside the arena", hb > BASE && hb < END, true);
    check("`__heap_base` no longer names the heap base", hb === e.staticHeapBase(), false);
    check("the stack region is the module's 32 KiB default", hb - BASE, STACK);
    const sp = e.stackPointer();
    check("the stack pointer is inside the arena", sp >= BASE && sp < END, true);
    check("the stack is at or below the heap base", sp <= hb, true);

    // `keep` was allocated at instantiation, before the arena existed, so it is a
    // handle into a heap this instance no longer owns. Re-seat it inside the
    // arena before asking the collector about it.
    e.resetKeep();
    e.tag(99);

    check("1000 allocations, every pointer inside the arena", e.allocLoop(1000), 0);
    check("…all of them at or above the arena heap base", e.minPointer() >= hb, true);
    check("…and all below the arena end", e.maxPointer() + 4 <= END, true);
    check("a live arena object survives a collection", (e.__collect(), e.getTag()), 99);
  }
}

// ---------------------------------------------------------------------------
// 3. Re-init: a second call re-initializes cleanly.
// ---------------------------------------------------------------------------

console.log("\n# 3 a second `__arenaInit` re-initializes");
{
  const built = compile();
  if (built.ok) {
    const e = instantiate(built.bytes);
    e.memory.grow(8 - pagesOf(e));

    e.__arenaInit(BASE, SIZE);
    e.allocLoop(200);
    check("the first arena is in use", e.minPointer() >= BASE, true);

    // A different, disjoint arena later in the same memory.
    const base2 = 0x40000;
    const size2 = 0x10000;
    e.__arenaInit(base2, size2);
    check("the second call moves the arena end", e.arenaEnd(), base2 + size2);
    check("the second call moves the heap base",
      e.heapBase() > base2 && e.heapBase() < base2 + size2, true);
    check("the stack moved into the second arena",
      e.stackPointer() >= base2 && e.stackPointer() < base2 + size2, true);

    e.minMaxReset();
    check("allocations land in the new arena", e.allocLoop(200), 0);
    check("none of them is in the old arena",
      e.minPointer() >= base2 && e.maxPointer() < base2 + size2, true);

    // The collector was re-initialized too: a fresh root, fresh spaces.
    e.resetKeep();
    e.tag(3333);
    check("a collection in the re-initialized arena", (e.__collect(), e.getTag()), 3333);
    check("…and the heap still allocates", e.allocLoop(64), 0);
  }
}

// ---------------------------------------------------------------------------
// 4. A collection inside the arena touches nothing outside it.
// ---------------------------------------------------------------------------

console.log("\n# 4 a collection stays inside the arena");
{
  const built = compile();
  if (built.ok) {
    const e = instantiate(built.bytes);
    e.memory.grow(8 - pagesOf(e));
    e.__arenaInit(BASE, SIZE);

    e.allocLoop(256);

    // Guard both sides of the arena with a pattern nothing legitimate should
    // write: the span below `base` — where the default stack and the default heap
    // live, so this is where a stale handle would point — and the span above
    // `end`. `__new` churn plus a full collection then runs, and any byte of
    // either guard that changes is a write outside the arena.
    const mem = new Uint8Array(e.memory.buffer);
    mem.fill(0xa5, 0x1000, BASE);
    mem.fill(0x5a, END, mem.length);

    // The instance's `keep` global still holds the object it created at
    // instantiation, outside this arena. A collection must not follow it: it
    // would read (and colour) a header this instance does not own.
    check("a collection with a stale root does not crash", (e.__collect(), true), true);
    check("churn after the guards are set", e.allocLoop(512), 0);

    e.resetKeep();
    e.tag(4242);
    e.__collect();
    check("a full collection runs (`__collect` is exported)", typeof e.__collect, "function");
    check("churn after the collection", e.allocLoop(512), 0);

    const after = new Uint8Array(e.memory.buffer);
    let lowBad = 0;
    let highBad = 0;
    for (let i = 0x1000; i < BASE; ++i) if (after[i] !== 0xa5) ++lowBad;
    for (let i = END; i < after.length; ++i) if (after[i] !== 0x5a) ++highBad;
    check("nothing below the arena was written", lowBad, 0);
    check("nothing above the arena was written", highBad, 0);
    check("the live arena object survived the collection", e.getTag(), 4242);
    check("…and the heap still allocates", e.allocLoop(16), 0);
  }
}

// ---------------------------------------------------------------------------
// 5. Two arenas in one shared memory.
// ---------------------------------------------------------------------------

console.log("\n# 5 two arenas in one shared memory");
{
  const built = compile({ flags: [...BASE_FLAGS, "--importMemory"] });
  check("the fixture compiles with an imported shared memory", built.ok, true);
  if (built.ok) {
    // One memory, two instances: each has its own globals — so its own arena
    // state, its own stack pointer, its own collector — and they address the same
    // bytes. This is the shape a spawned thread has.
    const memory = new WebAssembly.Memory({ initial: 8, maximum: 8, shared: true });
    const a = instantiate(built.bytes, memory);
    const b = instantiate(built.bytes, memory);

    const aBase = 0x20000, aSize = 0x10000;
    const bBase = 0x30000, bSize = 0x10000;
    a.__arenaInit(aBase, aSize);
    b.__arenaInit(bBase, bSize);
    a.resetKeep();
    b.resetKeep();

    check("A's arena end", a.arenaEnd(), aBase + aSize);
    check("B's arena end", b.arenaEnd(), bBase + bSize);
    check("A's heap base is in A", a.heapBase() > aBase && a.heapBase() < aBase + aSize, true);
    check("B's heap base is in B", b.heapBase() > bBase && b.heapBase() < bBase + bSize, true);

    a.minMaxReset();
    b.minMaxReset();
    check("A allocates inside A", a.allocLoop(300), 0);
    check("B allocates inside B", b.allocLoop(300), 0);
    check("A's pointers are in A", a.minPointer() >= aBase && a.maxPointer() < aBase + aSize, true);
    check("B's pointers are in B", b.minPointer() >= bBase && b.maxPointer() < bBase + bSize, true);
    check("the two heaps do not overlap",
      a.maxPointer() < b.minPointer() || b.maxPointer() < a.minPointer(), true);

    // Independent payloads: each instance's live root is its own global, and
    // each lives in that instance's own arena.
    a.tag(1111);
    b.tag(2222);
    check("A's payload", a.getTag(), 1111);
    check("B's payload", b.getTag(), 2222);
    // A store's stack is not visible from another store, so A's collection has
    // nothing of B's to see — and B's payload must survive it untouched.
    a.__collect();
    check("A's collection leaves B's payload alone", b.getTag(), 2222);
    check("…and leaves A's payload alone", a.getTag(), 1111);
    check("both heaps still allocate after the collection",
      a.allocLoop(32) + b.allocLoop(32), 0);
  }
}

// ---------------------------------------------------------------------------
// 6. The atomic count stays zero — and now it is correct.
// ---------------------------------------------------------------------------

console.log("\n# 6 the atomic count");
{
  const built = compile({ text: true });
  if (built.ok) {
    const allocator = built.wat
      .split("\n")
      .filter((line) => /func \$~lib\/rt\/tlsf\//.test(line));
    check("the TLSF allocator is in the module", allocator.length > 0, true);
    // **The runtime, not the whole module.** This check used to count atomics in
    // everything, and that was the same statement only while a `--sharedMemory`
    // build carried no thread surface. It now does (`src/compiler.ts` emits the
    // carving half for every shared build, not just a shelled one), and
    // `~lib/thread`'s slot ring is atomics by nature — 106 of them, none of them
    // the allocator's. The claim this section has always made is about the
    // runtime's free lists, so it is asked of the runtime: each `atomic` counted
    // against the function that encloses it, not the line it sits on.
    const byOwner = new Map();
    let owner = "<none>";
    for (const line of built.wat.split("\n")) {
      const declared = /^\s*\(func \$(\S+)/.exec(line);
      if (declared) owner = declared[1];
      const hits = (line.match(/atomic/g) ?? []).length;
      if (hits) byOwner.set(owner, (byOwner.get(owner) ?? 0) + hits);
    }
    let runtimeAtomics = 0;
    let threadAtomics = 0;
    for (const [name, count] of byOwner) {
      if (name.startsWith("~lib/rt/")) runtimeAtomics += count;
      else if (name.startsWith("~lib/thread/")) threadAtomics += count;
    }
    check("atomic instructions in the runtime", runtimeAtomics, 0);
    check("atomic instructions in the allocator", (allocator.join("\n").match(/atomic/g) ?? []).length, 0);
    // …and the module's atomics are all the thread surface's, which is the other
    // half of the same statement: nothing the arena relies on is atomic.
    check("every atomic in the module belongs to the thread surface",
      (built.wat.match(/atomic/g) ?? []).length,
      threadAtomics);
    check("…and the arena is what makes that correct",
      /ARENA/.test(built.wat) && /__arenaInit/.test(built.wat), true);
  }
}

// ---------------------------------------------------------------------------
// 7. The other linear runtime: `--runtime stub`.
// ---------------------------------------------------------------------------

console.log("\n# 7 the stub runtime, the other linear ABI");
{
  const built = compile({
    flags: BASE_FLAGS.map((f) => (f === "incremental" ? "stub" : f)),
  });
  check("the fixture compiles against the stub runtime", built.ok, true);
  if (built.ok) {
    const e = instantiate(built.bytes);
    e.memory.grow(8 - pagesOf(e));
    check("the stub runtime exports the arena entry points", typeof e.__arenaInit, "function");
    e.__arenaInit(BASE, SIZE);
    check("the stub arena end", e.arenaEnd(), END);
    // The stub runtime has no stack region (`__stack_pointer == __heap_base`), so
    // the arena's stack region is empty and its heap base *is* the arena base —
    // the default layout, mirrored.
    check("the stub heap base is at the arena base", e.heapBase(), BASE);
    check("the stub stack pointer is inside the arena",
      e.stackPointer() >= BASE && e.stackPointer() < END, true);
    check("every stub allocation is inside the arena", e.allocLoop(500), 0);
    e.__arenaInit(BASE + SIZE, SIZE); // 256 KiB in, still inside 8 pages
    e.minMaxReset();
    check("the stub re-initializes", e.allocLoop(100), 0);
    check("…into the new arena", e.minPointer() >= BASE + SIZE, true);
  }
}

// ---------------------------------------------------------------------------
// 7b. The minimal runtime (`tcms`) takes the same bounds.
// ---------------------------------------------------------------------------

console.log("\n# 7b the minimal runtime (two-colour mark & sweep)");
{
  const built = compile({
    flags: BASE_FLAGS.map((f) => (f === "incremental" ? "minimal" : f)),
  });
  check("the fixture compiles against the minimal runtime", built.ok, true);
  if (built.ok) {
    const e = instantiate(built.bytes);
    e.memory.grow(8 - pagesOf(e));
    e.__arenaInit(BASE, SIZE);
    check("the minimal arena end", e.arenaEnd(), END);
    // No shadow stack under this runtime (`__stack_pointer == __heap_base`), so
    // the arena's stack region is empty and the heap starts at the arena base —
    // the default layout, mirrored.
    check("the minimal heap base is the arena base", e.heapBase(), BASE);
    e.resetKeep();
    e.tag(77);
    check("every minimal allocation is inside the arena", e.allocLoop(400), 0);
    check("a collection in the minimal arena keeps the live object",
      (e.__collect(), e.getTag()), 77);
    e.minMaxReset();
    check("…and the heap still allocates there", e.allocLoop(64), 0);
    check("still inside the arena", e.minPointer() >= e.heapBase(), true);
  }
}

// ---------------------------------------------------------------------------
// 8. `--wasmGc` cannot share memory today, so it cannot own an arena.
// ---------------------------------------------------------------------------

console.log("\n# 8 the wasm GC ABI allocates through the compiler, so it has no arena");
{
  // Under `--wasmGc` the linear allocator is the compiler's own bump allocator
  // (`~gc/linNew`), not `std/assembly/rt`, so a runtime-side arena would bound
  // nothing. The compiler therefore exports no arena entry point in that ABI: a
  // host gets "not a function" instead of a heap it thinks it configured.
  const built = compile({
    flags: [...BASE_FLAGS, "--wasmGc"],
    source: "class K { a: i32 = 1; }\nexport function mk(): i32 { let k = new K(); return k.a; }\n",
    text: true,
  });
  check("the `--wasmGc --sharedMemory` build itself compiles", built.ok, true);
  if (built.ok) {
    check("…and exports no `__arenaInit`", /export "__arenaInit"/.test(built.wat), false);
    check("…so nothing can quietly claim to have configured a heap",
      /export "__arenaHeapBase"/.test(built.wat), false);
  }
}

console.log(
  failures
    ? `\n[ FAILURE ] ${failures} of ${checks} checks failed`
    : `\n[ SUCCESS ] ${checks} checks`
);
if (failures) process.exit(1);
