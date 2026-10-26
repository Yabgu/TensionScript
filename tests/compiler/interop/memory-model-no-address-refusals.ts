// `@unmanaged` / `@managed` over an `@inline` declaration — **refused everywhere**
// (`TS6395`).
//
// An `@inline` struct is a **value**: it has no WASM local of its own, its fields
// live in one local each (SROA), and there is therefore no address to hand out.
// The two overrides ask for exactly the thing that does not exist:
//
// - `@unmanaged` asks to *lend* the value's address as a pointer. There is no
//   address. On an export this is worse than useless — with the byval predicate
//   off, `paramRefs` falls through to one ref per field, so the record's field
//   list becomes the host ABI, which is the leak PR #14 refused.
// - `@managed` asks for a GC reference to it. A value has neither a header nor a
//   handle; the collector would be asked to trace a local.
//
// Both are the same missing thing, so both are one code with one message. The
// fix is the one the message names: use the value (SROA already gives a copy per
// assignment), or keep it `@inline`.
//
// Each shape is refused at four positions — `@external` parameter, export
// parameter, guest parameter, local declaration. The declarations are forced to
// resolve from `forceResolution` below, because this compiler builds a signature
// only when the function is used.

@inline struct V {
  a: i32;
  b: i32;
}

// --- `@unmanaged` over `@inline` ---------------------------------------------------

// (1) `@external` parameter.
@external("host", "lendUnmanaged")
declare function lendUnmanaged(v: @unmanaged V): i32;

// (2) export parameter.
export function exportUnmanaged(v: @unmanaged V): i32 {
  return v.a;
}

// (3) guest parameter.
function guestUnmanaged(v: @unmanaged V): i32 {
  return v.a;
}

// (4) local declaration. Refused at the annotation, so no assignment can follow.
export function localUnmanaged(): i32 {
  let u: @unmanaged V;
  return 0;
}

// --- `@managed` over `@inline` -----------------------------------------------------

// (5) `@external` parameter.
@external("host", "lendManaged")
declare function lendManaged(v: @managed V): i32;

// (6) export parameter.
export function exportManaged(v: @managed V): i32 {
  return v.a;
}

// (7) guest parameter.
function guestManaged(v: @managed V): i32 {
  return v.a;
}

// (8) local declaration with an initializer — the shape a "make me a reference to
// this value" reading would write.
export function localManaged(v: V): i32 {
  let m: @managed V = v;
  return m.a;
}

// Forces (1), (3), (5) and (7) to resolve.
export function forceResolution(v: V): i32 {
  return lendUnmanaged(v) + guestUnmanaged(v) + lendManaged(v) + guestManaged(v);
}
