// TypedArray views as wasm GC structs (GC16).
//
// The rule is the user's: **a byte buffer holds no GC references**, so its storage
// needs no tracing, so its storage may stay in **linear memory** — addressable —
// while the *view object* becomes a GC struct of scalars. The GC object is the
// handle, not the payload. `ArrayBufferView` and `DataView` are the two classes
// that declare this shape, and the eleven typed arrays inherit it.
//
// Synthesised layout, field order fixed by the base prefix:
//
//     { <brand> i32, buffer (mut i32), dataStart (mut i32), byteLength (mut i32) }
//
// `buffer` is the one field whose declared type is not the type it is stored as:
// it is `ArrayBuffer`, a linear-memory block, and a view's hold on it is the
// block's *address*. Storing the address as an `i32` is what keeps `dataStart` an
// address every ABI site (`load<u8>(this.dataStart + i)`, `memory.copy`, the
// atomics) can use without changing a line of `std/assembly`.
//
// Every export answers an `i32`/`bool`; the values are chosen so a wrong field
// index, a lost address or a swapped view changes the answer.

export function writeRead(): i32 {
  let a = new Uint8Array(4);
  a[0] = 7;
  a[3] = 200;
  return a[0] + a[3] + a.length; // 211
}

export function byteOffsetAndLength(): i32 {
  let v = new Uint8Array(8);
  return v.byteOffset + v.byteLength; // 0 + 8
}

/// A `Uint16Array` walks two bytes per element, so a broken `dataStart` shows up
/// as a wrong value rather than a wrong length.
export function wideElements(): i32 {
  let a = new Uint16Array(2);
  a[1] = 1000;
  return a[1] + a.length; // 1002
}

export function floatElements(): i32 {
  let a = new Float64Array(2);
  a[0] = 2.5;
  a[1] = 1.5;
  return <i32>(a[0] * a[1] * 4); // 15
}

/// The payload is shared with the buffer that owns it: writing through the view is
/// visible at the buffer's own address. That is the property that makes the whole
/// design worth anything — the view is a handle, and its `dataStart` is the real
/// address of the blob, so `load<u32>` here reads what `store<u8>` there wrote.
///
/// (Aliasing one buffer with *two views* needs `TypedArray.wrap`, which still builds
/// a view through `__new` + `offsetof` stores — `typedarray.ts:1878-1881`. Named, not
/// fixed: it is a function-shaped blocker, and this round is the view layout.)
export function payloadSharedWithBuffer(): i32 {
  let a = new Uint8Array(4);
  a[0] = 0x11;
  a[1] = 0x22;
  a[2] = 0x33;
  a[3] = 0x44;
  // Read the same bytes as a u32 at the address the view reports.
  let word = load<u32>(a.dataStart);
  return <i32>(word >>> 24) + <i32>((word >>> 16) & 0xFF); // 0x44 + 0x33 = 119 + 51
}

/// `DataView` declares the same shape but is *not* an `ArrayBufferView` subclass —
/// so it is the second class the shape test has to find.
export function dataView(): i32 {
  let v = new DataView(new ArrayBuffer(4));
  v.setUint32(0, 0x11223344);
  return v.getUint8(0) + v.getUint8(3); // 0x11 + 0x44 = 85
}

/// `instanceof` is a brand compare, so the brand has to differ per view class.
export function isView(): i32 {
  let a = new Int32Array(1);
  return ArrayBuffer.isView(a) ? 1 : 0;
}

export function viewBrands(): bool {
  let u8 = new Uint8Array(1);
  let i32a = new Int32Array(1);
  // **The load-bearing case.** Every view class declares the same four fields, so
  // wasm canonicalises them into ONE struct type — `Uint8Array` and `DataView` *are*
  // the same type at the wasm level. Only the brand value separates them, which is
  // exactly why `instanceof` is a brand compare and never `ref.test`.
  let dv = new DataView(new ArrayBuffer(1));
  return (u8 instanceof Uint8Array)
    && !(u8 instanceof Int32Array)
    && (i32a instanceof Int32Array)
    && (dv instanceof DataView)
    && !(dv instanceof Uint8Array)
    && !(u8 instanceof DataView);
}

/// A class **holding** a view. Before this round a `TypedArray` field made a class
/// ineligible, and `gcUniform` is all-or-nothing, so one such field put the whole
/// program back on the pointer ABI.
class HoldsView {
  data: Uint16Array;
  n: i32;
  constructor(n: i32) {
    this.data = new Uint16Array(n);
    this.n = n;
  }
  poke(i: i32, v: u16): void { this.data[i] = v; }
  peek(i: i32): i32 { return this.data[i]; }
}

export function viaClass(): i32 {
  let h = new HoldsView(3);
  h.poke(1, 1000);
  return h.peek(1) + h.n; // 1000 + 3
}

/// `fill` and `sort` go through the stdlib's byte helpers (`FILL`, `SORT`) with
/// `this.dataStart`, which is the address-keeping property again.
export function stdlibOnPayload(): i32 {
  let a = new Int32Array(4);
  a.fill(3);
  a[2] = 9;
  let sum = 0;
  for (let i = 0; i < a.length; ++i) sum += a[i];
  return sum; // 3 + 3 + 9 + 3 = 18
}
