// `@unmanaged @dynamic [T * n]` — indexing, reads. Landing 4b.
//
// The buffer is `[u32 length][pad to alignof(T)][T data[n]]`, so an element
// lives at `ptr + headerSize + i*sizeof(T)` and the index is checked against the
// length in the header before the access.
//
// Two constants are pinned by the `.wat` beside this fixture, and each was a bug
// somewhere else in this family:
//
//   - **headerSize = align_up(4, alignof(T))** — 4 for a `u32` element, 8 for a
//     two-`f64` record. Omitting it would read the length word as the first
//     element.
//   - **stride = sizeof(T), a multiply** — 4 for `u32`, 16 for the record. A
//     shift by `alignof` would have given 8 for the record.
//
// The bounds check is `(u32)i >= (u32)length → trap`: unsigned, so one
// comparison covers both ends and `y[-1]` cannot walk backwards out of the
// buffer. Its message is a literal, because nothing in this compiler formats an
// index and a length into one string.
//
// A record element reads to the **address** typed as the element, so
// `y[i].field` composes through the record's own getter — the same shape as
// `[T *]` (Landing 2).

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

assert(sizeof<BodyState>() == 16);

// --- scalar elements -------------------------------------------------------

export function readU32(p: usize, i: i32): u32 {
  const a = changetype<@unmanaged @dynamic [u32 * n]>(p);
  return a[i];
}

export function readF64(p: usize, i: i32): f64 {
  const a = changetype<@unmanaged @dynamic [f64 * n]>(p);
  return a[i];
}

export function readI8(p: usize, i: i32): i8 {
  const a = changetype<@unmanaged @dynamic [i8 * n]>(p);
  return a[i];
}

// --- record elements: the header offset and the stride -------------------

export function readX(p: usize, i: i32): f64 {
  const y = changetype<@unmanaged @dynamic [BodyState * n]>(p);
  return y[i].x;
}

export function readY(p: usize, i: i32): f64 {
  const y = changetype<@unmanaged @dynamic [BodyState * n]>(p);
  return y[i].y;
}

// The element as a first-class value: the resolver types `y[i]` as the element,
// so a local can hold the address.
export function viaLocal(p: usize, i: i32): f64 {
  const y = changetype<@unmanaged @dynamic [BodyState * n]>(p);
  const b = y[i];
  return b.x;
}

// A loop over the length, which is what the form exists for.
export function sumX(p: usize): f64 {
  const y = changetype<@unmanaged @dynamic [BodyState * n]>(p);
  let s: f64 = 0;
  for (let i = 0; i < n; i++) {
    s = s + y[i].x;
  }
  return s;
}

export function run(): i32 {
  return i32(sizeof<BodyState>() == 16);
}
