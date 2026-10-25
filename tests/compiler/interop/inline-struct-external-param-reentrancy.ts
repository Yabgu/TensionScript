// The `@external` temp's **lifetime under re-entry** — sret's recursion fixture,
// transposed to the host boundary.
//
// The call graph:
//
//   outer()            guest: builds `v`, calls host_cb(v)
//     host_cb(ptr)     host: reads `v` through the temp
//       callback()     guest: builds `w`, calls host_sum(w) — its own temp
//     host_cb resumes  host: reads `v` through the **same** ptr again
//
// `host_cb` is a synchronous host call, and the adapter's rule 6
// (`tension_adapter.h:57-58`) lets it borrow the pointer for the duration of the
// call without retaining it. Re-entry is therefore allowed to happen *inside* the
// borrow, which is the case a single fixed slot would get wrong: if the temp were
// one per call site rather than one per call frame, `callback`'s external call
// would overwrite the bytes `host_cb` is still holding.
//
// The mark is a WASM local, so `callback`'s frame gets its own: it allocates
// above `outer`'s block and its restore puts the bump back to `outer`'s
// post-bump value, leaving `outer`'s slot intact. The glue reads `v` before and
// after the nested call and returns both; if the second read differed from the
// first, this fixture's arithmetic would be wrong.
//
// The nested call is deliberately made by the host, not by the guest, because an
// `@inline struct` argument must be a local — a guest cannot nest an external
// call inside another external call's argument expression.

@inline struct V {
  a: f32;
  b: f32;
}

@external("env", "host_cb")
declare function host_cb(v: V): f32;

@external("env", "host_sum")
declare function host_sum(v: V): f32;

// Called by the host, from inside `host_cb`. Its own temp, its own mark.
export function callback(): f32 {
  let w: V = new V();
  w.a = 100;
  w.b = 1;
  return host_sum(w); // 101
}

export function outer(): f32 {
  let v: V = new V();
  v.a = 1;
  v.b = 2;
  return host_cb(v); // 3 + 101 + 3 = 107
}
