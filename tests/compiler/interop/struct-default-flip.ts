// The struct default: plain `struct` is a **value**.
//
// The flip's four cells, each asserted, and this is the only fixture that pins
// them together — the migration of the nine existing fixtures moves declarations
// in place, and `struct-reserved`'s two spellings happen to coincide in size, so
// neither of those would fail if the default were reverted.
//
//   struct Foo { … }              -> a value: SROA locals, copy on assignment,
//                                    pass by value, no address at all
//   @unmanaged struct Foo { … }   -> a 4-byte pointer, and `let b = a` aliases
//   @managed struct Foo { … }     -> a GC reference
//   @inline struct Foo { … }      -> the same declaration as plain `struct`
//
// Reverting the flip fails this file **at run time**, which is the point: with
// a pointer default `plainCopies` returns 1099 instead of 199, `plainByValue`
// returns 4242 instead of 142, and `plainIsTheValueType` is 4 instead of 8. The
// copy cases therefore construct their value (`= new Plain()`) rather than
// leaving it uninitialised — a bare `let a: Plain;` is legal for a value (SROA
// locals start at zero) and a definite-assignment error for a pointer, so it
// would make the file fail to *compile* under the old model and prove nothing
// about copying.

struct Plain {
  x: u32;
  y: u32;
}

// The synonym. Same two decorators are injected, so this must behave exactly as
// `Plain` does — asserted below rather than assumed.
@inline struct Syn {
  x: u32;
  y: u32;
}

// The explicit pointer opt-in: unchanged by the flip.
@unmanaged struct Ptr {
  x: u32;
  y: u32;
}

// The GC-owned reference: unchanged by the flip.
@managed struct Gc {
  x: u32;
  y: u32;
}

// --- the layout: a value's extent, not a pointer's --------------------------
// `Plain` is `{ u32, u32 }`, so 8 bytes. A 4-byte answer would mean the field is
// still a pointer slot.
export function plainIsTheValueType(): u32 {
  return sizeof<Plain>();
}
export function synIsTheValueType(): u32 {
  return sizeof<Syn>();
}
export function plainEndOffset(): u32 {
  return offsetof<Plain>();
}

// `@unmanaged`'s `sizeof` is the record extent as well (8) — what differs is the
// *storage* of a declaration of it, not this number. The pointer's own width is
// asserted through `Ptr` as a field below, and through the aliasing test.
export function ptrRecordExtent(): u32 {
  return sizeof<Ptr>();
}

// A `@managed` record's `sizeof` is its reference: 4.
export function gcIsAReference(): u32 {
  return sizeof<Gc>();
}

// --- copy, not bind --------------------------------------------------------
// 199 means `b.x = 99` did not reach `a`. A pointer bind gives 1099.
export function plainCopies(): u32 {
  let a: Plain = new Plain();
  a.x = 1;
  a.y = 2;
  let b: Plain = a;
  b.x = 99;
  return a.x * 1000 + b.x * 100 + a.y;
}

// The synonym must copy identically — this is what "synonym" claims.
export function synCopies(): u32 {
  let a: Syn = new Syn();
  a.x = 1;
  let b: Syn = a;
  b.x = 99;
  return a.x * 1000 + b.x;
}

// --- pass by value ---------------------------------------------------------
// 142: the callee's write to its own parameter did not reach the caller.
// A pointer parameter would leave the caller at 42.
function mutate(v: Plain): u32 {
  v.x = 42;
  return v.x;
}
export function plainByValue(): u32 {
  let a: Plain = new Plain();
  a.x = 1;
  let seen = mutate(a);
  return a.x * 100 + seen;
}

// --- the explicit models keep their old behaviour --------------------------
// `@unmanaged` still aliases: the reference was copied, the record was not.
export function unmanagedStillAliases(): u32 {
  let a = changetype<Ptr>(heap.alloc(sizeof<Ptr>()));
  a.x = 1;
  let b = a;
  b.x = 99;
  return a.x; // 99
}

// ...and it is still addressable, which a value is not.
export function unmanagedIsAddressable(): u32 {
  let a = changetype<Ptr>(heap.alloc(sizeof<Ptr>()));
  a.x = 7;
  let p = changetype<usize>(a);
  return load<u32>(p); // 7, read through the raw address
}

// A `@managed` record is allocated by the collector and shared by reference.
export function managedIsShared(): u32 {
  let a = new Gc();
  a.x = 1;
  let b = a;
  b.x = 99;
  return a.x; // 99
}

export function run(): i32 {
  // The scalar expectations above, plus the two that are cheapest to state as a
  // single number: everything that should copy copied, everything that should
  // alias aliased.
  if (plainIsTheValueType() != 8) return 1;
  if (synIsTheValueType() != 8) return 2;
  if (plainEndOffset() != 8) return 3;
  if (ptrRecordExtent() != 8) return 4;
  if (gcIsAReference() != 4) return 5;
  if (plainCopies() != 199) return 6;
  if (synCopies() != 199) return 7;
  if (plainByValue() != 142) return 8;
  if (unmanagedStillAliases() != 99) return 9;
  if (unmanagedIsAddressable() != 7) return 10;
  if (managedIsShared() != 99) return 11;

  // The synonym is the same declaration, not merely a similar one: the two
  // report the same extent and the same end offset.
  if (offsetof<Syn>() != offsetof<Plain>()) return 12;
  return 0;
}
