// `@unmanaged @dynamic [T * n]` — the bounds check, exercised at module init.
//
// The check is `(u32)i >= (u32)length → trap`. This fixture cannot *expect* that
// trap — the compiler harness requires instantiation to succeed, and a `.json`
// beside a fixture carries compile-time stderr only — so it does the two things
// a fixture can:
//
//   1. runs the whole path at instantiation over a real header (below), proving
//      the address arithmetic and that valid indices do **not** trap; and
//   2. leaves the check in the `.wat` beside it, where the `i32.ge_u` / `abort`
//      sequence is pinned against removal.
//
// The trap itself was measured out of band: with the header declaring 10, index
// 10 traps, and index -1 traps too (as `0xFFFFFFFF` in the unsigned compare). See
// the landing's report.
//
// The header is written with `store<u32>` because there is no constructor for a
// dynamic array yet — producing a buffer is the part Landing 4a left refused
// (return position) and later landings own. Writing the header by hand is
// exactly what a C caller does, so this is the ABI as an external producer sees
// it.

@unmanaged struct BodyState {
  x: f64;
  y: f64;
}

// The address arithmetic, end to end: a header written by hand, elements written
// through `y[i].field = v`, then read back through `y[i].field`.
export function roundTrip(): f64 {
  const length: i32 = 4;
  const headerSize: usize = 8;    // align_up(4, alignof(BodyState) == 8)
  const stride: usize = sizeof<BodyState>();
  const base = heap.alloc(headerSize + <usize>length * stride);
  store<u32>(base, length);
  const y = changetype<@unmanaged @dynamic [BodyState * n]>(base);
  for (let i = 0; i < length; i++) {
    y[i].x = <f64>i * 10.0 + 0.5;
    y[i].y = <f64>i * 10.0 + 1.5;
  }
  let sum: f64 = 0;
  for (let i = 0; i < length; i++) {
    sum += y[i].x + y[i].y;
  }
  return sum;
}

// 0.5+1.5 + 10.5+11.5 + 20.5+21.5 + 30.5+31.5 = 128.0
assert(roundTrip() == 128.0);

// The scalar path over the same header shape: headerSize 4, stride 4.
export function scalarRoundTrip(): u32 {
  const length: i32 = 3;
  const base = heap.alloc(4 + <usize>length * 4);
  store<u32>(base, length);
  const a = changetype<@unmanaged @dynamic [u32 * n]>(base);
  for (let i = 0; i < length; i++) {
    a[i] = <u32>(i + 1) * 7;
  }
  return a[0] + a[1] + a[2];
}

assert(scalarRoundTrip() == 42);

export function run(): i32 {
  return i32(roundTrip() == 128.0);
}
