// `ArrayBuffer` as a GC handle (GC21).
//
// The last stdlib class whose migration unblocks more than itself: once a buffer is a
// GC struct, `Map` and `Set` hold no managed class other than `ArrayBuffer`, so their
// own fields become storable and they migrate for free.
//
// The shape is forced rather than chosen. `ArrayBuffer` declares **zero** instance
// fields: `byteLength` reads `rtSize` out of the object header at `-TOTAL_OVERHEAD`, and
// the object pointer *is* the payload start. So the GC object can only be the **handle**,
// and the payload stays in linear memory:
//
//     ArrayBuffer  { <brand> i32, dataStart i32, byteLength i32 }
//
// Which puts the weight on two addresses: `changetype<usize>(buf)` must yield
// `dataStart` (every consumer that hands a buffer to a host verb depends on it), and
// `dataStart` must not move when the arena grows.
//
// ## What each export measures
//
//   abLength        `new ArrayBuffer(64).byteLength` — a field read, not a header read
//   abSlice         `slice(0, 8)` lengths and content
//   bufferSentinel  fill the whole payload through its address, churn, count survivors
//   addressStable   `dataStart` across an allocation and across a page-adding growth
//   inClass         a class holding an `ArrayBuffer` reads its bytes back after churn
//   mapRoundTrip    `Map`'s own behaviour, now that a buffer is a GC handle
//
// The sentinel is written through `changetype<usize>(buf)` and read back the same way,
// which is deliberate: it exercises the address the ABI uses rather than a view's
// cached copy, so a handle whose `dataStart` drifted would fail here.

function fillAt(p: usize, n: i32, value: u8): void {
  for (let i = 0; i < n; ++i) store<u8>(p + <usize>i, value);
}

function countAt(p: usize, n: i32, value: u8): i32 {
  let kept: i32 = 0;
  for (let i = 0; i < n; ++i) if (load<u8>(p + <usize>i) == value) kept++;
  return kept;
}

function churn(n: i32, size: i32): void {
  for (let i = 0; i < n; ++i) {
    let a = new Uint8Array(size);
    a[0] = <u8>i;
  }
}

export function abLength(): i32 {
  return new ArrayBuffer(64).byteLength; // 64
}

export function abSlice(): i32 {
  let buf = new ArrayBuffer(64);
  let p = changetype<usize>(buf);
  for (let i = 0; i < 64; ++i) store<u8>(p + <usize>i, <u8>i);
  let out = buf.slice(0, 8);
  if (out.byteLength != 8) return -1;
  if (buf.slice(48).byteLength != 16) return -2;
  // Content, not just length: byte `i` of the slice is byte `i` of the source.
  let q = changetype<usize>(out);
  let sum: i32 = 0;
  for (let i = 0; i < 8; ++i) {
    if (load<u8>(q + <usize>i) != <u8>i) return -3;
    sum += load<u8>(q + <usize>i);
  }
  return sum; // 0+1+..+7 = 28
}

/// Fill the whole payload, allocate a lot, count what survives. The GC20 lesson
/// applied to a buffer: a two-byte check would certify a reservation that loses the
/// tail.
function survivors(size: i32, churnCount: i32): i32 {
  let buf = new ArrayBuffer(size);
  let p = changetype<usize>(buf);
  fillAt(p, size, 0xA5);
  churn(churnCount, 64);
  return countAt(p, size, 0xA5);
}

export function sentinel8(): i32 { return survivors(8, 1); }
export function sentinel16(): i32 { return survivors(16, 1); }
export function sentinel64(): i32 { return survivors(64, 1); }
export function sentinel1024(): i32 { return survivors(1024, 1); }
export function sentinelChurn(): i32 { return survivors(64, 200000); }

/// `dataStart` must not move when the arena grows. The growth is forced by allocating
/// more than a page, so this is the case where a handle caching an address would break.
export function addressStable(): i32 {
  let buf = new ArrayBuffer(16);
  let before = changetype<usize>(buf);
  let small = new Uint8Array(64);
  small[0] = 1;
  let afterAlloc = changetype<usize>(buf);
  // More than a page: the arena must grow.
  let big = new Uint8Array(70000);
  big[69999] = 1;
  let afterGrowth = changetype<usize>(buf);
  let acc = 0;
  if (before == afterAlloc) acc |= 1;
  if (before == afterGrowth) acc |= 2;
  store<u8>(before, 0x5A);
  if (load<u8>(afterGrowth) == 0x5A) acc |= 4;
  return acc; // 7
}

class BufferHolder {
  b: ArrayBuffer = new ArrayBuffer(16);
  tag: i32 = 0;
}

let holder: BufferHolder = new BufferHolder();

/// A class holding a buffer: its bytes survive a churn, its length is a field read, and
/// the address it reports is the one the payload is at.
export function inClass(): i32 {
  let p = changetype<usize>(holder.b);
  fillAt(p, 16, 0x3C);
  churn(200000, 64);
  if (countAt(p, 16, 0x3C) != 16) return -1;
  if (holder.b.byteLength != 16) return -2;
  if (changetype<usize>(holder.b) != p) return -3;
  return 49;
}

/// `Map`'s own behaviour, now that a buffer is a GC handle. `i32` keys first: a `string`
/// key routes through `hashStr`, which reads `load<u32>` at a raw address and is a
/// separate question.
class MapHolder {
  m: Map<i32, i32> = new Map<i32, i32>();
}

export function mapRoundTrip(): i32 {
  let h = new MapHolder();
  h.m.set(1, 10);
  h.m.set(2, 20);
  h.m.set(3, 30);
  if (h.m.get(2) != 20) return -1;
  if (h.m.size != 3) return -2;
  return h.m.get(1) + h.m.get(2) + h.m.get(3); // 60
}

/// A `Set` is the same storage with `value` only.
class SetHolder {
  s: Set<i32> = new Set<i32>();
}

export function setRoundTrip(): i32 {
  let h = new SetHolder();
  h.s.add(4);
  h.s.add(5);
  if (!h.s.has(4)) return -1;
  if (h.s.has(9)) return -2;
  return h.s.size; // 2
}
