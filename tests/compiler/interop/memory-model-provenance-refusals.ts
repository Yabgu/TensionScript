// `@managed` over an `@unmanaged` declaration — **refused everywhere a use can
// write it** (`TS6394`).
//
// The claim is impossible, not merely unimplemented. An `@unmanaged` record is a
// plain pointer to bytes: there is no GC header in front of it, so the collector
// has nothing to mark and nothing to trace. A use-site model names *storage*, and
// a use cannot confer storage the value does not have — no emitter can invent a
// header, because the bytes belong to whoever allocated them.
//
// This is one rule with one code. `changetype<@managed U>(u)` reaches the same
// cell from the escape hatch and is refused with the same `TS6394` (10.0a used
// `TS2322` there; it is the same claim, so it is now the same number).
//
// Every position below is refused, because the check lives at the single type
// chokepoint every position goes through (`Resolver#resolveType`) rather than at
// each emitter. Seven probes, seven diagnostics — the count is the assertion.
//
// The spellings that *are* honourable live in `memory-model-override-cells.ts`:
// `@unmanaged` over an `@managed` declaration (the identity cell, 10.0a) and
// `@inline` over either pointer declaration (the copy cell, 10.0b).

@unmanaged struct U {
  a: i32;
  b: i32;
}

// (1) `@external` parameter — the host boundary.
@external("host", "takeManagedView")
declare function takeManagedView(v: @managed U): i32;

// (2) export parameter — the mirror boundary.
export function exportParam(v: @managed U): i32 {
  return v.a;
}

// (3) guest parameter — the callee's signature is refused, so the function does
// not exist. Refusing here rather than at each call site is deliberate: the
// invalid claim is on the parameter declaration, and one refusal covers every
// caller without duplicating the diagnostic.
function guestParam(v: @managed U): i32 {
  return v.a;
}

// (4) local declaration with an initializer.
export function localWithInit(u: U): i32 {
  let m: @managed U = u;
  return m.a;
}

// (5) local declaration without an initializer. Refused at the annotation, which
// is what makes a later assignment unreachable: there is no declared place for a
// managed view to be assigned *into*.
export function localBare(): i32 {
  let m: @managed U;
  return 0;
}

// (6) field type. Fields are resolved only when the enclosing record is used, so
// this one is refused from `initializeClass`, not from a function body.
struct Holder {
  m: @managed U;
}
export function buildHolder(): Holder {
  return new Holder();
}

// (7) the escape hatch: same cell, same code.
export function viaChangetype(u: U): i32 {
  let m = changetype<@managed U>(u);
  return m.a;
}

// The declarations above are resolved lazily, like every other declaration in
// this compiler: an unused function's signature is never built, so an impossible
// claim on an unused parameter goes unreported — the same way an unused function
// with any other type error does. These two calls are what force (1) and (3) to
// resolve, and they are the reason the count above is seven rather than five.
export function forceResolution(u: U): i32 {
  return takeManagedView(u) + guestParam(u);
}
