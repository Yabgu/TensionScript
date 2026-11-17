// The linear heap the flag allocates from, and whether a payload's bytes survive.
//
// ## Why this fixture writes the whole payload
//
// Through GC19 every rung here wrote `v[0]` and `v[1]` — the first two bytes — and
// read them back. That certified the ladder (a payload is no longer swept) while being
// blind to a second defect: the reservation arithmetic floored a block's end below the
// payload's, so the next block's header landed in the payload and zeroed its last four
// bytes. **A two-byte-front-of-buffer assertion is not a liveness proof**, and neither
// is a front-only check of any width: what a wrong reservation damages is the *tail*.
//
// So every rung below fills the entire payload with a sentinel, or reads its last
// byte, or both. `p8`/`p16`/`p32`/`kept*` are the tests that would have caught GC19
// before it shipped; `tailSentinel` is the one-line version a reader can check by eye.
//
// ## What each export measures
//
//   p8/p16/p32        fill every byte with 0xA5, allocate once, mask of survivors
//   kept8/16/32/64    the same, counted rather than masked (payloads beyond 31 bytes)
//   tailSentinel      write the last byte, allocate once, read it
//   bothDirections    two blocks, sentinels across both, neither clobbers the other
//   noChurn/eight/many  the GC18 ladder, now reading first, middle and last byte
//   writeThenCollect  write, force the collector, read the tail
//   firstAddressReuse / reuseBacksteps / stride   the arena's own invariants
//   pages             peak linear memory, in pages
//
// Under `--wasmGc` the allocator is a never-free bump arena emitted by the compiler
// (`~gc/linNew` in `src/compiler.ts`), so a payload is never handed to another
// allocation. Without the flag the same source runs `itcms` over `tlsf`, which
// reclaims — that is the control, and it is what makes a failure here evidence about
// the flag rather than about the fixture.

// === a sentinel pattern over the whole payload ==============================

function fillAll(a: Uint8Array, value: u8): void {
  for (let i = 0, n = a.length; i < n; ++i) a[i] = value;
}

/// Bit `i` is set when byte `i` still holds the sentinel after one more allocation.
/// All-ones is the only correct answer for every payload size.
function survivors(size: i32): i32 {
  let a = new Uint8Array(size);
  fillAll(a, 0xA5);
  // The allocation that used to clobber the tail. One is enough: no churn, no
  // threshold, no collection.
  let b = new Uint8Array(64);
  b[0] = 1;
  let mask: i32 = 0;
  for (let i = 0, n = a.length; i < n && i < 31; ++i) {
    if (a[i] == 0xA5) mask |= 1 << i;
  }
  // Byte 31 cannot fit a 32-bit mask; `honest()` below covers the long payloads by
  // counting rather than masking.
  return mask;
}

/// How many of `size` bytes survive, counted rather than masked, so payloads beyond 31
/// bytes are still measurable.
function honest(size: i32): i32 {
  let a = new Uint8Array(size);
  fillAll(a, 0xA5);
  let b = new Uint8Array(64);
  b[0] = 1;
  let kept: i32 = 0;
  for (let i = 0, n = a.length; i < n; ++i) if (a[i] == 0xA5) kept++;
  return kept;
}

export function p8(): i32 { return survivors(8); }
export function p16(): i32 { return survivors(16); }
export function p32(): i32 { return survivors(32); }
export function kept8(): i32 { return honest(8); }
export function kept16(): i32 { return honest(16); }
export function kept32(): i32 { return honest(32); }
export function kept64(): i32 { return honest(64); }

/// The last byte of a payload, written then read across one allocation. A real guest
/// writes the last element of a buffer as ordinarily as the first.
export function tailSentinel(): i32 {
  let a = new Uint8Array(16);
  a[15] = 0x5A;
  let b = new Uint8Array(64);
  b[0] = 1;
  return a[15];
}

/// Two blocks in a row, sentinels across both. Checks the direction nobody had tested:
/// not only that a new block does not write into the previous one's tail, but that the
/// previous block's own writes did not land in the new block's header.
export function bothDirections(): i32 {
  let a = new Uint8Array(16);
  let b = new Uint8Array(16);
  fillAll(a, 0x11);
  fillAll(b, 0x22);
  // Now a third allocation, which must not disturb either.
  let c = new Uint8Array(32);
  c[0] = 1;
  let good: i32 = 0;
  let allA = true, allB = true;
  for (let i = 0; i < 16; ++i) {
    if (a[i] != 0x11) allA = false;
    if (b[i] != 0x22) allB = false;
  }
  if (allA) good |= 1;
  if (allB) good |= 2;
  // And the headers of a and b are still the stdlib's: `length` reads rtSize.
  if (a.length == 16) good |= 4;
  if (b.length == 16) good |= 8;
  return good; // 15
}

// === the GC18 ladder, now reading the tail =================================

class Box {
  v: Uint8Array = new Uint8Array(16);
  tag: i32 = 0;
}

/// Module-scope, so the handle is a global: alive for the whole instance.
let box: Box = new Box();

function churn(n: i32): void {
  for (let i = 0; i < n; ++i) {
    let a = new Uint8Array(64);
    a[0] = <u8>i;
  }
}

/// Writes the first byte, the middle and the **last**, and reads all three. The tail is
/// the part a reservation bug damages, which is why it is checked on every rung rather
/// than only in `patterns()`.
function check(): i32 {
  if (box.v[0] != 42) return -1;
  if (box.v[8] != 21) return -2;
  if (box.v[15] != 7) return -3;
  return 49;
}

function setUp(): void {
  box.v[0] = 42;
  box.v[8] = 21;
  box.v[15] = 7;
}

export function noChurn(): i32 { setUp(); return check(); }

export function eight(): i32 {
  setUp();
  churn(8);
  return check();
}

export function many(): i32 {
  setUp();
  churn(200000);
  return check();
}

export function writeThenCollect(): i32 {
  setUp();
  __collect();
  return check();
}

// === the arena's own invariants ============================================

/// How often the *first* allocation's address recurs over `n` allocations of 64 bytes.
/// Under the arena it must be zero: the whole point is that a block is never reused.
export function firstAddressReuse(n: i32): i32 {
  let first: i32 = 0;
  let eq: i32 = 0;
  for (let i = 0; i < n; ++i) {
    let a = new Uint8Array(64);
    let p = <i32>a.dataStart;
    if (i == 0) first = p;
    else if (p == first) eq++;
    a[0] = <u8>i;
  }
  return eq;
}

/// Every allocation whose address is at or below its predecessor's. Also zero under the
/// arena, and it is the number that catches a reservation rounding *down*: the next
/// block would start inside the previous one, which is a backward step.
export function reuseBacksteps(n: i32): i32 {
  let prev: i32 = 0;
  let back: i32 = 0;
  for (let i = 0; i < n; ++i) {
    let a = new Uint8Array(64);
    let p = <i32>a.dataStart;
    if (i > 0 && p <= prev) back++;
    prev = p;
    a[0] = <u8>i;
  }
  return back;
}

/// The distance between two consecutive 16-byte payloads' `dataStart`. Must be at least
/// `16 + overhead`; anything less means the second block's header overlaps the first
/// payload.
export function stride(): i32 {
  let a = new Uint8Array(16);
  let b = new Uint8Array(16);
  return <i32>b.dataStart - <i32>a.dataStart;
}

/// Peak linear memory, in pages.
export function pages(): i32 { return memory.size(); }
