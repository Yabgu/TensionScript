// `@managed @dynamic [T * n]` — construction, indexing and return. Landing 4d.2.
//
// The descriptor is a GC reference to `DynamicArray<T>` (`dataPtr: usize`,
// `length: u32`). Two things distinguish it from the unmanaged form, and the
// `.wat` beside this fixture pins both:
//
//   1. **The data buffer is bare.** `@unmanaged @dynamic` keeps the length in
//      the buffer it points at (`[u32 length][pad][data...]`); the descriptor
//      form keeps it in the descriptor, so the address is `dataPtr +
//      i*sizeof(T)` with **no header offset**. Deliberate, not an oversight —
//      the unmanaged form is self-describing so C can build one, and this one is
//      described by an object the collector traces.
//
//   2. **The base and the length come from field loads**, not from the pointer's
//      own header: `i32.load(gcRef + offsetof(dataPtr))` and
//      `i32.load(gcRef + offsetof(length))`.
//
// `changetype<...>(p, len)` allocates the descriptor and validates the length:
// a negative `i32` would land in a `u32` field as a huge count, and every bounds
// check against it would pass.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

// --- construction ---------------------------------------------------------

export function wrap(p: usize, len: i32): @managed @dynamic [BodyState * n] {
  return changetype<@managed @dynamic [BodyState * n]>(p, len);
}

// --- indexing -------------------------------------------------------------

export function readX(y: @managed @dynamic [BodyState * n], i: i32): f64 {
  return y[i].x;
}

export function readY(y: @managed @dynamic [BodyState * n], i: i32): f64 {
  return y[i].y;
}

export function writeX(y: @managed @dynamic [BodyState * n], i: i32, v: f64): void {
  y[i].x = v;
}

export function addX(y: @managed @dynamic [BodyState * n], i: i32, v: f64): void {
  y[i].x += v;
}

export function postIncX(y: @managed @dynamic [BodyState * n], i: i32): f64 {
  return y[i].x++;
}

// A scalar element: no record getter, so the load is at the element's own width.
export function readU32(y: @managed @dynamic [u32 * n], i: i32): u32 {
  return y[i];
}

export function writeU32(y: @managed @dynamic [u32 * n], i: i32, v: u32): void {
  y[i] = v;
}

// --- the return path ------------------------------------------------------
//
// The descriptor is a GC reference, so returning it hands the caller the same
// object. The data buffer's lifetime is the caller's, not the descriptor's.

export function wrapThrough(p: usize, len: i32): @managed @dynamic [BodyState * n] {
  const y = wrap(p, len);
  return y;
}

// --- the descriptor fields ------------------------------------------------

export function lengthOf(y: @managed @dynamic [BodyState * n]): i32 {
  return i32(y.length);
}

export function dataPtrOf(y: @managed @dynamic [BodyState * n]): usize {
  return y.dataPtr;
}
