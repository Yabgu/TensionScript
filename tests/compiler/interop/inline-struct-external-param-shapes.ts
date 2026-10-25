// The two record kinds that **do** cross the `@external` boundary, and the
// shape they cross in: one borrowed `i32` pointer.
//
// This is the companion to `inline-struct-external-param-refusals.ts`. The
// point is coherence, not novelty — before this phase an `@inline struct`
// parameter flattened to one WASM parameter per field while `@unmanaged` and
// `@managed` both crossed as `(param i32)`. Two shapes for one boundary is how
// an ABI gets lost, so the value type is refused until it can use the same one.
//
// The host side has no per-field expectation at all: the adapter reaches guest
// bytes only through `guest_read(user, uint32_t ptr, void *dst, uint32_t len)`
// (`tension-core/include/tension_adapter.h:184`), a `(ptr, len)` pair, and rule
// 6 makes it borrow — "An adapter never caches a pointer into guest memory and
// never holds a slice across a call" (`:57-58`). So "the temp is valid for the
// call" is the contract that already exists; it is not one this phase invents.
//
// **Why the assertions live in the glue.** They run at instantiation if written
// here, and the module's own memory is not reachable from JS until the instance
// is linked — so a host stub that reads through the pointer would run before it
// could read anything. The glue calls the exports after linking and asserts
// there instead; a wrong value throws and fails the fixture.

@unmanaged struct U {
  a: f32;
  b: f32;
}

@managed struct M {
  a: i32;
  b: i32;
}

@external("env", "host_sum_u")
declare function host_sum_u(u: U): f32;

@external("env", "host_sum_m")
declare function host_sum_m(m: M): i32;

// A scalar beside a record keeps its own slot and its own type.
@external("env", "host_u_and_scalar")
declare function host_u_and_scalar(u: U, k: i32, j: f32): f32;

export function unmanagedSum(): f32 {
  let u = new U();
  u.a = 1.5;
  u.b = 2.5;
  return host_sum_u(u);
}

export function managedSum(): i32 {
  let m = new M();
  m.a = 40;
  m.b = 2;
  return host_sum_m(m);
}

export function recordBesideScalars(): f32 {
  let u = new U();
  u.a = 1.5;
  u.b = 2.5;
  return host_u_and_scalar(u, 10, 0.25);
}
