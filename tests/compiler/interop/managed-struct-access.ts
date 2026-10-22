// `@managed struct` field access — the codegen, pinned at debug and release.
//
// A managed struct's reference is its fields pointer, so the access path is the
// managed-class path with no header arithmetic (scoping §2.3, reading A). This
// fixture exists so the counts are checked rather than remembered: four
// accessors, each doing exactly one field touch, with the same bodies for a
// managed struct and a borrowed struct so the two can be compared in the
// checked-in WAT.
//
// Measured from the emitted code (both `.debug.wat` and `.release.wat` are
// checked in; the numbers below are what they contain):
//
//                       read                      write
//   @managed struct     local.get; i32.load        local.get; local.get; i32.store   (2 / 3)
//   @unmanaged struct   local.get; i32.load        local.get; local.get; i32.store   (2 / 3)
//
// `-O0` puts the same 2/3 instructions in a `Foo#get:a` / `Foo#set:a` accessor
// and calls it; `-O3` inlines the accessor, and the only instructions added
// around it are the shadow-stack grounding of the reference (a managed
// reference must stay visible to the collector across a call) — not part of the
// field access.
//
// The partial cell this rules out: a header-first access (`reference +
// OBJECT_OVERHEAD + offset`) would emit `i32.load offset=16` / `f64.load
// offset=24` for this record, and both fixtures would show it.

@managed struct M {
  a: i32 = 0;   // 0
  b: f64 = 0;   // 8
}

@unmanaged struct U {
  a: i32 = 0;
  b: f64 = 0;
}

// One field touch each, so the WAT counts are unambiguous.
export function readM(m: M): i32 {
  return m.a;
}

export function readMLast(m: M): f64 {
  return m.b;
}

export function writeM(m: M, v: i32): void {
  m.a = v;
}

export function readU(u: U): i32 {
  return u.a;
}

export function readULast(u: U): f64 {
  return u.b;
}

export function writeU(u: U, v: i32): void {
  u.a = v;
}

// A read through a managed struct the collector must keep alive: the result
// equals the value written, which is only true if both touch the same address.
export function roundTrip(v: i32): i32 {
  const m = new M();
  m.a = v;
  return m.a;
}

export function run(): i32 {
  assert(roundTrip(41) == 41);
  return roundTrip(1);
}
