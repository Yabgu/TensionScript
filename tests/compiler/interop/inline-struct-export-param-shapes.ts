// The two record kinds that cross an **export** boundary, and the shape they
// cross in: one `i32` pointer, borrowed by the guest for the call.
//
// The companion to `inline-struct-export-param-refusals.ts`. The point is the
// same coherence the `@external` side established: one boundary, one shape.
//
// The guest copies nothing. An `@unmanaged` struct arrives as the caller's
// pointer and the guest reads through it; a `@managed` struct arrives as the
// caller's reference and the guest reads through that. Mutating either is
// visible to the caller — that is the difference from `@inline struct`, whose
// by-value copy must not leak back.
//
// The glue plays the host: it writes the record into guest memory and passes the
// address, then checks what the export read.

@unmanaged struct U {
  a: i32;
  b: i32;
}

@managed struct M {
  a: i32;
  b: i32;
}

export function readU(u: U): i32 {
  return u.a * 100 + u.b;
}

export function readM(m: M): i32 {
  return m.a * 100 + m.b;
}

// A scalar beside the record keeps its own slot and its own type.
export function readUWithScalar(u: U, k: i32): i32 {
  return u.a * 100 + u.b + k;
}
