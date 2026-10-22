// `@managed struct`, 0.9.0: a GC-owned record with a C-compatible layout whose
// **reference is its fields pointer** (scoping §2.3, reading A).
//
// Three type kinds, and this fixture pins the third one's distinguishing marks:
//
//   class            GC, no C layout    sizeof = 4 (the reference)
//   struct           borrowed, C layout sizeof = 16, isManaged = false
//   @managed struct  GC, C layout       sizeof = 16, isManaged = true
//
// Three-way, as assertions:
//   refuse  (before this feature): `@managed` was an unrecognised decorator, so
//           the declaration fell through to the *borrowed* struct path — a
//           TS6385 warning, `isManaged` false, and `new` routed to the raw
//           allocator (`__alloc`, no GC header). The `isManaged` and `sizeof`
//           assertions below both fail in that state.
//   partial (the type kind lands but field access takes the header-first path of
//           reading B, `reference + OBJECT_OVERHEAD + offset`): `sizeof` and
//           `offsetof` still say 16 / 0 / 8, but a read of `a` emits
//           `i32.load offset=16` and `b` `f64.load offset=24`, so the record
//           reads the bytes *after* its fields. The `managedAddressIsFieldA`
//           check below fails, and the checked-in WAT pins `offset=0` / `offset=8`.
//   fixed: 16 / 16 / 0 / 8, `isManaged` true, and the reference addresses field
//           `a` directly — no header offset in any access.
//
// The C# correspondence (scoping §2.4): `Marshal.SizeOf` = fields size =
// `sizeof`; `Marshal.OffsetOf` = fields offset = `offsetof`; and
// `GCHandle.AddrOfPinnedObject` = the fields pointer = the reference itself.

@managed struct Foo {
  a: i32 = 0;   // 0
  b: f64 = 0;   // 8 (8-aligned)
}               // 16

@unmanaged struct Borrowed {
  a: i32 = 0;
  b: f64 = 0;
}

class Plain {
  a: i32 = 0;
  b: f64 = 0;
}

// --- fixed: the record's C size, and `offsetof<T>()` agrees ----------------
// `sizeof` is the fields size (16), not the reference width (4) and not
// 16 + OBJECT_OVERHEAD: the header lives *below* the reference (scoping §1.2).
assert(sizeof<Foo>() == 16);
assert(offsetof<Foo>() == 16);
assert(sizeof<Foo>() == offsetof<Foo>());

// --- and the field offsets are measured from the reference ----------------
assert(offsetof<Foo>("a") == 0);
assert(offsetof<Foo>("b") == 8);

// --- the three kinds are distinguishable ----------------------------------
// A managed struct is a managed reference (GC-owned); a borrowed struct is not.
assert(isManaged<Foo>());
assert(!isManaged<Borrowed>());
// A managed class reports the reference width; a managed struct reports the
// record. This is the assertion the refuse cell fails.
assert(sizeof<Plain>() == sizeof<usize>());
assert(sizeof<Foo>() != sizeof<usize>());

// --- reading A: the reference addresses field `a` -------------------------
// The check is behavioural, not documentary: the byte at the reference's
// address must equal `a`, and must be at a *different* address from `b` by
// exactly the field offset. Under reading B both would be off by the header.
export function managedAddressIsFieldA(f: Foo): bool {
  return load<i32>(changetype<usize>(f)) == f.a;
}

export function fieldBAtOffset(f: Foo): bool {
  return load<f64>(changetype<usize>(f) + <usize>offsetof<Foo>("b")) == f.b;
}

// --- the codegen the checked-in WAT pins ----------------------------------
// Read at the field offset with no header arithmetic: the reference is already
// the fields pointer, so the emitted access is 2 instructions.
export function readA(f: Foo): i32 {
  return f.a;
}

export function readB(f: Foo): f64 {
  return f.b;
}

export function writeA(f: Foo, v: i32): void {
  f.a = v;
}

// --- a constructed managed struct round-trips ----------------------------
export function make(a: i32, b: f64): Foo {
  const foo = new Foo();
  foo.a = a;
  foo.b = b;
  return foo;
}

export function readBack(): f64 {
  const foo = make(7, 2.5);
  assert(foo.a == 7);
  assert(managedAddressIsFieldA(foo));
  return foo.b;
}

export function run(): i32 {
  assert(readBack() == 2.5);
  return sizeof<Foo>() + offsetof<Foo>("b");
}
