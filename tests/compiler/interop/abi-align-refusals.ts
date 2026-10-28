// `@abi.align(N)` — the values it refuses, and why each is a refusal rather
// than a clamp.
//
// Every case below names one defect and **recovers to the field's natural
// alignment**, keeping the field. That is deliberate: dropping the field would
// turn one mistake into a cascade of "type has no property" errors at every
// use, and the first error already said what was wrong.
//
// The parser refusal (the post-type spelling) aborts before resolution, so it
// lives in its own fixture (`interop/abi-align-post-type`) — a parse error
// here would mask every case below it.
//
// Each record is made reachable through `offsetof`: a refusal on a field of a
// record nothing resolves never fires.

const ALIGNMENT: i32 = 16;

// 1. Not a power of two: 3 bytes is not an alignment any layout can honour.
@unmanaged struct NotPowerOfTwo {
  a: u8;
  @abi.align(3) b: u32;
}

// 2. Less than one: zero is not an alignment at all.
@unmanaged struct UnderOne {
  a: u8;
  @abi.align(0) b: u32;
}

// 3. Less than natural: a u32 is already 4-byte aligned, so asking for 2 is a
//    lie about storage that is stronger than the request.
@unmanaged struct LessThanNatural {
  a: u8;
  @abi.align(2) b: u32;
}

// 4. Not a literal: the layout is decided at resolve time, before any constant
//    is evaluated, so a computed alignment cannot be read there. Accepted, it
//    would be silently ignored — the trap this whole feature exists to close.
@unmanaged struct NonLiteral {
  a: u8;
  @abi.align(ALIGNMENT) b: u32;
}

export function touch(x: i32): i32 {
  let a = <i32>offsetof<NotPowerOfTwo>("b");
  let b = <i32>offsetof<UnderOne>("b");
  let c = <i32>offsetof<LessThanNatural>("b");
  let d = <i32>offsetof<NonLiteral>("b");
  return x + a + b + c + d;
}

export function run(): i32 {
  return touch(0);
}
