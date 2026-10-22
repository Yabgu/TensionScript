// `struct` and `@managed struct`: the two record spellings, and what each means.
//
// The 0.8.x deprecation warning is gone as of 0.9.0: the flip it announced is
// cancelled, so `struct` is the borrowed form permanently. `@managed struct` is
// the third type kind — a GC-owned record — and it must NOT take the
// `@unmanaged` decorator the borrowed form injects.
//
// What this pins, as AST round-trip:
//   struct            -> `@unmanaged class`, unchanged from 0.8.x
//   @unmanaged struct -> `@unmanaged class`, explicit and now redundant
//   @managed struct   -> `@managed class` in the dump: no `@unmanaged`
//   @inline struct    -> `@unmanaged @inline class` (the AS100 reservation)

struct Borrowed {
  x: f32;
}

@unmanaged struct Explicit {
  x: f32;
}

@managed struct Managed {
  x: f32;
}

@inline struct Reserved {
  x: f32;
}
