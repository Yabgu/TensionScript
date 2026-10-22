// `T[N]` end to end. 0.8.0.
//
// The shape the capability exists for: the two C records in the input wire that
// have array members and that a guest has had to address by hand.
//
//   tension-input/src/input.h:41-58   StateRecord, 96 bytes
//       keys_held[8] u32 at 16, next field at 48
//   tension-input/src/input.h:64-72   PadRecord, 48 bytes
//       axes[6] f32 at 16, next field at 40
//
// Those byte tables are reproduced here as `offsetof` assertions, so the
// declaration and the header check each other instead of a constant list doing
// it by hand.
//
// Three-way, with the numbers each state produces:
//   refuse  (before commit 9): `keysHeld: u32[8]` was `TS1005 ']' expected`.
//   partial (naive layout -- the state commit 9 shipped): the array's size was
//           used as its alignment, so `{a:i32; arr:f32[4]; b:i32}` was **36
//           bytes with `arr` at 16 and `b` at 32**, and a 24-byte `f32[6]`
//           crashed the layout assert. A record of one array looked right
//           (16 bytes), which is what makes it a partial rather than a refusal.
//   fixed (commits 10-13): 24/4/20, offsets and accesses as asserted below.
//
// At -O3 a constant-index access is two instructions; the claim is checked in
// the emitted fixtures of the read and write commits, and the arithmetic is
// `fieldOffset + i * elementSize` in every case.

@unmanaged struct StateRecord {
  version: u32;       //  0
  flags: u32;         //  4
  padsPresent: u32;   //  8
  mouseButtons: u32;  // 12
  keysHeld: u32[8];   // 16 .. 47   (32 bytes)
  mouseDx: i32;       // 48
  mouseDy: i32;       // 52
  mouseDxf: f32;      // 56
  mouseDyf: f32;      // 60
  mouseX: i32;        // 64
  mouseY: i32;        // 68
  wheelX: f32;        // 72
  wheelY: f32;        // 76
  seq: u64;           // 80
  reserved: u64;      // 88
}                     // 96

@unmanaged struct PadRecord {
  version: u32;       //  0
  flags: u32;         //  4
  buttons: u32;       //  8
  reserved0: u32;     // 12
  axes: f32[6];       // 16 .. 39   (24 bytes)
  reserved1: u64;     // 40
}                     // 48

// --- the header's byte tables, as assertions -------------------------------
assert(offsetof<StateRecord>() == 96);
assert(offsetof<StateRecord>("keysHeld") == 16);
assert(offsetof<StateRecord>("mouseDx") == 48);
assert(offsetof<StateRecord>("mouseDxf") == 56);
assert(offsetof<StateRecord>("seq") == 80);

assert(offsetof<PadRecord>() == 48);
assert(offsetof<PadRecord>("axes") == 16);
assert(offsetof<PadRecord>("reserved1") == 40);

// --- and the array types themselves ---------------------------------------
assert(sizeof<u32[8]>() == 32);
assert(sizeof<f32[6]>() == 24);
assert(offsetof<u32[8]>() == 32);
assert(offsetof<f32[6]>() == 24);

// --- a bit-set read through the declared array ----------------------------
// The input wire's `keys_held` is a 256-bit set: bit `scancode & 31` of word
// `scancode >> 5`. This is the operation `input.ts` hand-rolls today.
function keyHeld(state: StateRecord, scancode: u32): bool {
  return (state.keysHeld[scancode >> 5] & (1 << (scancode & 31))) != 0;
}

function setKey(state: StateRecord, scancode: u32): void {
  state.keysHeld[scancode >> 5] |= 1 << (scancode & 31);
}

{
  let state = changetype<StateRecord>(heap.alloc(96));
  memory.fill(changetype<usize>(state), 0, 96);

  // Word 0 bit 3, word 1 bit 0, word 7 bit 31 -- the boundaries of the set.
  setKey(state, 3);
  setKey(state, 32);
  setKey(state, 255);

  assert(keyHeld(state, 3));
  assert(keyHeld(state, 32));
  assert(keyHeld(state, 255));
  assert(!keyHeld(state, 4));
  assert(!keyHeld(state, 31));
  assert(!keyHeld(state, 254));

  // The words land where the header says: 16 + (scancode >> 5) * 4.
  assert(load<u32>(changetype<usize>(state) + 16) == 1 << 3);
  assert(load<u32>(changetype<usize>(state) + 20) == 1);
  assert(load<u32>(changetype<usize>(state) + 16 + 28) == 1 << 31);

  // And the scalars on either side are untouched by any of it.
  state.version = 1;
  state.mouseDx = -7;
  assert(state.version == 1);
  assert(state.mouseDx == -7);
  assert(load<u32>(changetype<usize>(state) + 16 + 28) == 1 << 31);
}

// --- the pad record's axes ------------------------------------------------
{
  let pad = changetype<PadRecord>(heap.alloc(48));
  memory.fill(changetype<usize>(pad), 0, 48);

  for (let i = 0; i < 6; i++) pad.axes[i] = <f32>i + 0.5;

  assert(pad.axes[0] == 0.5);
  assert(pad.axes[5] == 5.5);
  for (let i = 0; i < 6; i++) assert(pad.axes[i] == <f32>i + 0.5);

  // `axes` is 24 bytes at 16; `reserved1` starts at 40 and is still zero.
  assert(load<f32>(changetype<usize>(pad) + 16) == 0.5);
  assert(load<f32>(changetype<usize>(pad) + 36) == 5.5);
  assert(load<u64>(changetype<usize>(pad) + 40) == 0);

  pad.reserved1 = 0x1122334455667788;
  assert(pad.reserved1 == 0x1122334455667788);
  assert(pad.axes[5] == 5.5);
}

// --- compound operators go through the same store -------------------------
// `|=` is the input idiom (`keysHeld[w] |= bit`); `++` is the other compound
// path in the compiler and needed the same intercept.
{
  let p = changetype<Counters>(heap.alloc(20));
  memory.fill(changetype<usize>(p), 0, 20);
  p.n[1] = 5;
  p.n[1]++;
  assert(p.n[1] == 6);
  assert(p.n[0] == 0);
  p.n[1] += 10;
  assert(p.n[1] == 16);
  assert(load<i32>(changetype<usize>(p) + 4 + 4) == 16);
}

@unmanaged struct Counters {
  head: i32;
  n: i32[4];
}

export function run(): i32 { return 0; }
