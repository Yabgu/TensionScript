// The linear heap the flag leaves unrooted (GC18).
//
// Every runtime assertion this suite had before GC18 read its values *immediately*
// after writing them, which is why 278 green checks did not notice that a live
// payload gets overwritten: no collection happens between a write and its read. The
// suite proved values **current**, never values **live**.
//
// The ladder is that gap, made measurable. A `Box` lives in a module-scope global,
// so the handle itself is reachable; its `Uint8Array` payload is linear memory that
// `__new` allocated and that `dataStart` points at. Write two bytes, allocate enough
// to make the collector run, read them back.
//
// Measured under `--wasmGc`: the third rung is wrong. Measured without the flag:
// all three are right. The mechanism is in `docs/memory-model.md`; the short version
// is that under the flag the root set is provably empty, so every `__new` object is
// garbage at the next collection and a payload a live handle still points at is
// swept and reused.
//
// These exports answer `i32` and the expected value is 49 (`42 + 7`) on every rung.
class Box {
  v: Uint8Array = new Uint8Array(16);
  tag: i32 = 0;
}

/// Module-scope, so the handle is a global: alive for the whole instance.
let box: Box = new Box();

function churn(n: i32): void {
  for (let i = 0; i < n; ++i) {
    let a = new Uint8Array(64);
    a[0] = <u8>i;
  }
}

/// Rung 1: no churn. No collection can happen, so this must be 49.
export function noChurn(): i32 {
  box.v[0] = 42;
  box.v[1] = 7;
  return box.v[0] + box.v[1];
}

/// Rung 2: eight allocations — below the collector's threshold. Must be 49.
export function eight(): i32 {
  box.v[0] = 42;
  box.v[1] = 7;
  churn(8);
  return box.v[0] + box.v[1];
}

/// Rung 3: 200 000 allocations — enough to collect many times over. **Wrong today
/// under the flag**, and the reason this fixture exists.
export function many(): i32 {
  box.v[0] = 42;
  box.v[1] = 7;
  churn(200000);
  return box.v[0] + box.v[1];
}

/// Write, ask the collector to run to completion, read. `__collect` is the runtime's
/// own function (not a host import) when the program does not declare it locally.
export function writeThenCollect(): i32 {
  box.v[0] = 42;
  box.v[1] = 7;
  __collect();
  return box.v[0] + box.v[1];
}

/// Allocation-address reuse, counted two ways, over `n` allocations of 64 bytes.
///
/// `backsteps` is the robust one: every allocation whose address is at or below its
/// predecessor's means tlsf handed back a block some earlier allocation had. A
/// fixed-slot arena would give a fixed `backsteps` whatever the allocation size; a
/// collector's free list gives a period of `GRANULARITY / size`.
///
/// `eqFirst` counts how often the *first* churn allocation's address recurs, which is
/// the number that looks most like a wrap. It is **not** a reliable indicator — it is
/// 18 181 in one run and 0 in another depending on what was allocated before, which is
/// itself evidence against a fixed-period arena. Both are returned so the test can
/// report them instead of asserting a story.
export function reuseBacksteps(n: i32): i32 {
  let prev: i32 = 0;
  let back: i32 = 0;
  for (let i = 0; i < n; ++i) {
    let a = new Uint8Array(64);
    let p = <i32>a.dataStart;
    if (i > 0 && p <= prev) back++;
    prev = p;
    a[0] = <u8>i;
  }
  return back;
}

export function firstAddressReuse(n: i32): i32 {
  let first: i32 = 0;
  let eq: i32 = 0;
  for (let i = 0; i < n; ++i) {
    let a = new Uint8Array(64);
    let p = <i32>a.dataStart;
    if (i == 0) first = p;
    else if (p == first) eq++;
    a[0] = <u8>i;
  }
  return eq;
}

/// Peak linear memory, in pages, so growth can be ruled out as an explanation.
export function pages(): i32 { return memory.size(); }
