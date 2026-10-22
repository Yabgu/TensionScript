// The input wire's two array-bearing records, as declarations. 0.8.0.
//
// Permanent C-interop evidence: the shapes are copied from
// `tension-input/src/input.h` -- `StateRecord` (`input.h:41-58`) and `PadRecord`
// (`input.h:64-72`) -- so the header's `static_assert`s and this module's
// `sizeof`/`offsetof` assertions check each other. `TailPadded` is the shape
// that exposed the missing trailing round-up: it ends on a `u8` in a record
// aligned to 4, which is the case every in-tree record avoids.
//
// The header's own checks, reproduced:
//   static_assert(sizeof(StateRecord) == TENSION_INPUT_STATE_SIZE)      -> 96
//   static_assert(offsetof(StateRecord, mouse_dxf) == 56, ...)          -> 56
//   static_assert(sizeof(PadRecord) == TENSION_INPUT_PAD_SIZE)          -> 48
//
// Mechanism: this suite compiles and instantiates; the offsets are pinned as
// constants in the checked-in `.debug.wat`/`.release.wat` fixtures, and the
// element access below is pinned there as `i32.load offset=32`. (The suite has
// no path to `tension-core`; the host run of the same record is cited in the
// PR body as manual evidence.)

// input.h:41-58, field for field.
@unmanaged struct StateRecord {
  version: u32;       //  0
  flags: u32;         //  4
  padsPresent: u32;   //  8
  mouseButtons: u32;  // 12
  keysHeld: u32[8];   // 16 .. 47 (256 scancodes)
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

// input.h:64-72, field for field.
@unmanaged struct PadRecord {
  version: u32;       //  0
  flags: u32;         //  4
  buttons: u32;       //  8
  reserved0: u32;     // 12
  axes: f32[6];       // 16 .. 39
  reserved1: u64;     // 40
}                     // 48

// The tail-padding shape: 37 bytes of fields in a 4-aligned record.
@unmanaged struct TailPadded {
  a: u8;              //  0
  arr: u32[8];        //  4 .. 35
  b: u8;              // 36 .. 37, rounded to 4 -> 40
}

// --- sizeof is the header's sizeof ----------------------------------------
assert(sizeof<StateRecord>() == 96);
assert(sizeof<PadRecord>() == 48);
assert(sizeof<TailPadded>() == 40);

// --- the header's static_assert offsets ------------------------------------
assert(offsetof<StateRecord>("keysHeld") == 16);
assert(offsetof<StateRecord>("mouseDx") == 48);
assert(offsetof<StateRecord>("mouseDxf") == 56);  // input.h's own static_assert
assert(offsetof<StateRecord>("seq") == 80);
assert(offsetof<PadRecord>("axes") == 16);
assert(offsetof<PadRecord>("reserved1") == 40);
assert(offsetof<TailPadded>("arr") == 4);
assert(offsetof<TailPadded>("b") == 36);

// --- the array types are inline, not references ----------------------------
assert(sizeof<u32[8]>() == 32);
assert(sizeof<f32[6]>() == 24);
assert(offsetof<StateRecord>() == sizeof<StateRecord>());
assert(offsetof<PadRecord>() == sizeof<PadRecord>());

// --- an element read addresses fieldOffset + i * elementSize --------------
// `keysHeld` at 16, so element 4 is `16 + 4*4 = 32`; the WAT fixture pins it.
export function readKeyWord(state: StateRecord, word: u32): u32 {
  return state.keysHeld[word];
}

export function readAxis(pad: PadRecord, axis: u32): f32 {
  return pad.axes[axis];
}

// `arr[7]` on the tail-padded record: `4 + 7*4 = 32`, width 4.
export function readTail7(ptr: usize): u32 {
  return changetype<TailPadded>(ptr).arr[7];
}

export function run(): i32 {
  return sizeof<StateRecord>() + sizeof<PadRecord>() + sizeof<TailPadded>();
}
