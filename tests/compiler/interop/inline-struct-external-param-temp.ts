// `@inline struct` at the `@external` boundary — **the temp**, and the
// three-way the phase turns on.
//
//   refuse  (before this phase): the import was declared with one WASM
//           parameter per field — `(param f32 f32)` for this two-field record —
//           so the record's field list became the host ABI. Nothing recorded
//           it: `layout_hash` folds arena geometry, and the host never sees the
//           record, only the flattened scalars. Measured in the phase's
//           pre-work, not assumed. The first commit refused the position; see
//           `inline-struct-external-param-refusals.ts`.
//
//   partial (a temp restored before the host reads, or one slot reused per call
//           site): the host reads a slot the caller has already unwound, or one
//           a nested call has since overwritten. The value comes back wrong
//           without crashing.
//
//   fixed   (this): the caller marks the bump pointer into a WASM local, bumps
//           by the record's rounded size, guards, stores the fields into
//           `(base + mark)`, passes that address, calls, and restores **after**
//           the call. The import is `(param i32)` — the same shape `@unmanaged`
//           and `@managed` cross in.
//
// **The contract the restore position rests on.** The host borrows the pointer
// for the call: `tension_adapter.h` rule 6 says an adapter "never caches a
// pointer into guest memory and never holds a slice across a call" (`:57-58`),
// and the only way it reaches guest bytes is `guest_read(user, uint32_t ptr,
// void *dst, uint32_t len)` (`:184`). Restoring after the call is therefore
// safe *because the host is synchronous*. A host that retained the pointer
// would need a different contract — that is what would change, not this code.
//
// The glue plays the host: it reads the record through the pointer, so the
// assertion is behavioural rather than a signature check.

@inline struct V {
  a: f32;
  b: f32;
}

@external("env", "host_sum")
declare function host_sum(v: V): f32;

@external("env", "host_scaled")
declare function host_scaled(v: V, k: f32): f32;

export function oneRecord(): f32 {
  let v: V = new V();
  v.a = 1.5;
  v.b = 2.5;
  return host_sum(v);
}

// A scalar beside the record: the record is the only indirection.
export function recordWithScalar(): f32 {
  let v: V = new V();
  v.a = 1.5;
  v.b = 2.5;
  return host_scaled(v, 10);
}

// Two calls from the same function: each gets its own mark, and the second
// starts where the first did (the restore is not optional).
export function twice(): f32 {
  let v: V = new V();
  v.a = 4;
  v.b = 6;
  return host_sum(v) + host_sum(v);
}
