// `@unmanaged @dynamic [T * n]` — Landing 4a.
//
// A header-prefixed array: `[u32 length][pad to alignof(T)][T data[n]]`, passed
// as **one i32 slot** (the pointer). The length is not in the type; it is in the
// buffer, which is what lets a caller hand over pointer and count at once.
//
// Three spellings, three nodes, decided by the token after `*`:
//
//   `[T *]`      `UnmanagedArrayTypeNode` — pointer, unknown length (Landing 1)
//   `[T * 4]`    `FixedArrayTypeNode`     — four elements inline (Landing 1)
//   `[T * n]`    `DynamicArrayTypeNode`   — runtime length, this landing
//
// The parser never asks whether `n` is a constant — it has no symbol table. That
// is the resolver's question, and a name that resolves to a compile-time const
// is refused there (`dynamic-array-refusals.ts`).
//
// What is pinned here, and in the `.wat` beside it:
//   - both parameter spellings produce the same signature: one i32 slot;
//   - `.length` is `i32.load` of the header's first word;
//   - `n` is bound at entry from that same word, so the body can use it as a
//     loop bound without a second load through `.length`;
//   - a `[T * n]` **field** is one pointer slot, so `sizeof<H>` counts 4.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

// --- parameters: explicit and inferred are the same type ----------------

export function explicit(y: @unmanaged @dynamic [BodyState * n]): i32 {
  return y.length;
}

export function inferred(y: [BodyState * n]): i32 {
  return y.length;
}

// --- `n` is a binding, not spelling -------------------------------------

export function sumN(y: [u32 * n]): i32 {
  let s: i32 = 0;
  for (let i = 0; i < n; i++) {
    s += 1;
  }
  return s;
}

// Visible in a nested block, and usable alongside `.length`.
export function bothReads(y: [u32 * n]): i32 {
  if (n > 0) {
    return y.length - n;
  }
  return 0;
}

// --- changetype: one argument, length from the header -------------------

export function fromPointer(p: usize): i32 {
  const y = changetype<@unmanaged @dynamic [u32 * n]>(p);
  return y.length;
}

// The local form binds `n` for the enclosing scope, so a loop can use it.
export function localBound(p: usize): i32 {
  const y = changetype<@unmanaged @dynamic [u32 * n]>(p);
  let s: i32 = 0;
  for (let i = 0; i < n; i++) {
    s += 1;
  }
  return s + y.length;
}

// --- field position: one pointer slot ------------------------------------

struct Holds {
  items: @unmanaged @dynamic [u32 * n];
  tail: u32 = 0;
}

assert(sizeof<Holds>() == 8);
assert(offsetof<Holds>("items") == 0);
assert(offsetof<Holds>("tail") == 4);

export function fieldSize(): usize {
  return sizeof<Holds>();
}

export function run(): i32 {
  return i32(sizeof<Holds>() == 8);
}
