// `[T * N]` of a **record** — Landing 5b.1: extent-based sizing.
//
// A record's `Type.byteSize` is its 4-byte **reference** width, not the bytes it
// occupies. Landing 1 built a fixed array's size from `byteSize`, which is right
// for a scalar and wrong for a record: `[Props * 4]` over a 16-byte `Props`
// claimed 16 bytes instead of 64, and a record containing that field claimed 20
// instead of 72. Unobservable while record elements were refused outright; wrong
// the moment Landing 5a.5 made them reachable.
//
// The fix is the pair `builtin_sizeof` / `builtin_alignof` already make for
// records — `Class#nextMemoryOffset` for the extent, `Class#alignLog2` for the
// alignment — carried into `Type#inlineExtentBytes` / `#inlineAlignLog2` so the
// array's layout is built from the same numbers the record's own `sizeof` is.
//
// What this fixture pins:
//
//   1. **The extent, not the reference width** — 64 for four 16-byte records.
//   2. **The element's alignment, not the pointer's** — 8 bytes, so the field
//      lands at 8 after a `u8` head rather than at 1.
//   3. **The parent's size follows** — 8 + 64 = 72, not 20.
//   4. **A forward-declared element is sized correctly too**, which is the case
//      where a wrong answer would be easiest to hide: the block is resolved
//      before the record it contains.

@unmanaged struct Props {
  x: f64;
  y: f64;
}

@unmanaged struct Block {
  head: u8;              // 0, padded to 8 for the element's alignment
  items: [Props * 4];    // 8 .. 72
}

assert(sizeof<Props>() == 16);
assert(sizeof<[Props * 4]>() == 64);
assert(alignof<[Props * 4]>() == alignof<Props>());
assert(offsetof<Block>("items") == 8);
assert(sizeof<Block>() == 72);

// The postfix spelling is the same Type, so it must agree — the desugar is
// unchanged by the sizing fix.
assert(sizeof<Props[4]>() == sizeof<[Props * 4]>());
assert(sizeof<Block>() == 72);

// A one-field record, whose extent is smaller than its alignment would suggest
// for a wider one: 8 bytes, aligned 8. Guards against hard-coding 16.
@unmanaged struct OneF64 {
  only: f64;
}

assert(sizeof<[OneF64 * 3]>() == 24);

// A record with a sub-word field, whose extent needs padding to its own
// alignment: `{u8, f64}` is 16 bytes, not 9.
@unmanaged struct Padded {
  tag: u8;
  value: f64;
}

assert(sizeof<Padded>() == 16);
assert(sizeof<[Padded * 2]>() == 32);
assert(offsetof<Padded>("value") == 8);

export function sizes(): u32 {
  return <u32>sizeof<[Props * 4]>()
    + <u32>sizeof<Block>()
    + <u32>offsetof<Block>("items");
}
