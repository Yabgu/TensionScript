// `struct`, 0.8.0: `struct Foo { … }` is `@unmanaged class Foo { … }`, exactly.
//
// The keyword injects the same `@unmanaged` decorator the explicit spelling
// produces (`parser.ts`, the `Token.Struct` arm and `withUnmanaged`), so the
// resolver and every layout rule see one form. There is no second code path,
// and therefore nothing that can drift between the two spellings.
//
// The three cells, as assertions:
//   refuse  (before): `struct Foo { … }` was TS1109 at the type position.
//   partial (a keyword that parses but does not imply @unmanaged): the record
//           would lay out as a managed class — `sizeof` 4, `offsetof` still the
//           field sum, and `isManaged` true. The assertions below pin the
//           unmanaged layout, so that half-fix fails here.
//   fixed:   the same layout as `@unmanaged class`, identical to the byte.

struct Record_ {
  a: i32;   // 0
  b: f64;   // 8 (8-aligned, so 4 bytes of interior padding after `a`)
  c: i32;   // 16 -> 20 (no trailing pad: `offsetof` is layout bytes)
}

@unmanaged class RecordExplicit {
  a: i32;
  b: f64;
  c: i32;
}

// The explicit spelling of the same declaration is accepted, not a duplicate
// error (`withUnmanaged` returns the author's decorator rather than adding a
// second one).
@unmanaged struct RecordBoth {
  a: i32;
  b: f64;
  c: i32;
}

// --- fixed: `struct` and `@unmanaged class` are the same record -------------
assert(sizeof<Record_>() == sizeof<RecordExplicit>());
assert(offsetof<Record_>() == offsetof<RecordExplicit>());
assert(offsetof<Record_>("a") == offsetof<RecordExplicit>("a"));
assert(offsetof<Record_>("b") == offsetof<RecordExplicit>("b"));
assert(offsetof<Record_>("c") == offsetof<RecordExplicit>("c"));

// --- and the explicit-both spelling is the same record ----------------------
assert(sizeof<RecordBoth>() == sizeof<Record_>());
assert(offsetof<RecordBoth>("b") == offsetof<Record_>("b"));

// --- the layout is the unmanaged one, not a reference ----------------------
// A managed class would report the pointer width here. The partial cell (a
// `struct` that parses but does not imply `@unmanaged`) fails these.
assert(sizeof<Record_>() == 20);        // 4 + pad4 + 8 + 4, no trailing pad
assert(offsetof<Record_>() == 20);
assert(offsetof<Record_>("a") == 0);
assert(offsetof<Record_>("b") == 8);
assert(offsetof<Record_>("c") == 16);
assert(sizeof<Record_>() != sizeof<usize>());

// --- the record is reachable through a raw pointer like any wire type ------
export function writeB(ptr: usize, v: f64): void {
  changetype<Record_>(ptr).b = v;
}
export function readB(ptr: usize): f64 {
  return changetype<Record_>(ptr).b;
}
export function readC(ptr: usize): i32 {
  return changetype<Record_>(ptr).c;
}

export function run(): i32 {
  return sizeof<Record_>() + offsetof<Record_>("b");
}
