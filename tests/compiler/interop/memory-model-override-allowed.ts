// The memory-model spellings that are **honourable** — every one of these must
// keep compiling, at every position the parser accepts a pre-type decorator.
//
// This file exists to keep the two refusals (`TS6394`, `TS6395`) honest from the
// other side. A refusal that over-reaches shows up here as a missing compile
// rather than as a surprise in someone else's program.
//
// Three groups:
//
//   1. **Same model as the declaration** — a no-op, and the thing a reader writes
//      when they want to be explicit.
//   2. **`@unmanaged` over an `@managed` declaration** — the identity cell from
//      10.0a. Both are one `i32` to the same record; the object stays GC-managed
//      and stays rooted, because rooting keys on what the value *is*.
//   3. **`@inline` over a pointer declaration** (`@managed` or `@unmanaged`) —
//      the copy cell. A pointer can be addressed, so a value can be materialised
//      from it: the `@external` temp fills from memory, and an export's byval
//      prologue loads the fields at entry. `memory-model-boundary-cells.ts`
//      pins the emitted shapes.
//
// `@inline` over `@managed` is the one that reads oddly at first: the record is
// GC-owned, but the *use* takes it by value, so it does not escape into the copy.
// The declaration still owns the allocation; the copy owns nothing.

@unmanaged struct U {
  a: i32;
  b: i32;
}

@managed struct M {
  a: i32;
  b: i32;
}

@inline struct V {
  a: i32;
  b: i32;
}

// --- 1. same model as the declaration ----------------------------------------------

export function sameUnmanaged(u: U): i32 {
  let v: @unmanaged U = u;
  return v.a;
}

export function sameManaged(m: M): i32 {
  let v: @managed M = m;
  return v.a;
}

export function sameInline(v: V): i32 {
  let w: @inline V = v;
  return w.a;
}

// --- 2. `@unmanaged` over an `@managed` declaration (the identity cell) ------------

export function identityLocal(m: M): i32 {
  let u: @unmanaged M = m;
  return u.a;
}

function identityParam(m: @unmanaged M): i32 {
  return m.a;
}

export function identityCall(m: M): i32 {
  // Sourced from a `changetype` so the operand is a managed temporary: the
  // shadow stack must root it across the call (10.0a's fix).
  return identityParam(changetype<M>(m));
}

// --- 3. `@inline` over a pointer declaration (the copy cell) ------------------------

// local — the value materialises from the pointer's fields
export function inlineOverUnmanagedLocal(u: U): i32 {
  let v: @inline U = u;
  return v.a + v.b;
}

export function inlineOverManagedLocal(m: M): i32 {
  let v: @inline M = m;
  return v.a + v.b;
}

// guest parameter
function inlineOverUnmanagedParam(v: @inline U): i32 {
  return v.a;
}

export function callInlineOverUnmanaged(u: U): i32 {
  return inlineOverUnmanagedParam(u);
}

// `@external` parameter — the host boundary
@external("host", "takeInlineViewOfU")
declare function takeInlineViewOfU(v: @inline U): i32;

@external("host", "takeInlineViewOfM")
declare function takeInlineViewOfM(v: @inline M): i32;

export function viaExternal(u: U, m: M): i32 {
  return takeInlineViewOfU(u) + takeInlineViewOfM(m);
}

// export parameter — the mirror boundary
export function exportInlineOverUnmanaged(v: @inline U): i32 {
  return v.a + v.b;
}

export function exportInlineOverManaged(v: @inline M): i32 {
  return v.a + v.b;
}

// field and return type
struct Holder {
  v: @inline U;
}

export function returnInlineOverUnmanaged(u: U): @inline U {
  let v: @inline U = u;
  return v;
}
