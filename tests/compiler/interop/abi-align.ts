// `@abi.align(N)` — a field's alignment, forced.
//
// The attribute goes on the **field declaration** (prefix position), because
// alignment is a property of the slot the field occupies:
//
//     @unmanaged struct S { a: u8; @abi.align(16) b: u32; c: u8; }
//
// and the record inherits the maximum, so one aligned field aligns the record.
// The post-type spelling (`b: u32 @abi.align(16)`) is refused by name
// (`parser.ts`, the post-type attribute loop): a type attribute travels into
// parameters, locals and return types, where there is no slot to align.
//
// Three-way, as assertions:
//   refuse (before this feature): the attribute parsed in both positions and was
//           inert — `{a:u8; @abi.align(16) b:u32; c:u8}` reported b at 4, c at
//           8, size 12, align 4, byte-identical to the no-attribute control
//           below. The `Middle` assertions fail there.
//   partial (half-fix): the parser accepts it but the resolver never reads it —
//           same layout as refuse, so the same assertions fail. That is the
//           failure mode if the attribute is wired to a site the layout loop
//           does not consult; this compiler reads it at the one place that
//           decides a field's offset (`resolver.ts`, the `alignLog2` site).
//   fixed: the offsets below.
//
// The values are asserted as literals rather than derived from anything, so a
// regression cannot agree with itself.

// --- the reference shape, and the control it is measured against ------------
@unmanaged struct Control {
  a: u8;
  b: u32;
  c: u8;
}

@unmanaged struct Middle {
  a: u8;
  @abi.align(16) b: u32;
  c: u8;
}

// --- a last field: the alignment moves the record's own extent --------------
@unmanaged struct Last {
  a: u8;
  @abi.align(16) b: u32;
}

// --- a no-op: asking for exactly the natural alignment changes nothing ------
@unmanaged struct NoOpAligned {
  a: u8;
  @abi.align(4) b: u32;
}

@unmanaged struct NoOpPlain {
  a: u8;
  b: u32;
}

// --- a value type carries the alignment into whatever nests it --------------
// An `@inline struct` is SROA'd, so on its own it is one local per field and
// its alignment is only a *reported* number. When it is nested into a
// pointer-layout record it is laid out inline, and this alignment is exactly
// what the outer's layout consumes (`resolver.ts`: `inlineFieldClass.alignLog2`)
// — so a value twin can carry the alignment its C twin has.
@inline struct ValueAligned {
  @abi.align(16) x: f32;
}

@unmanaged struct HoldsValue {
  a: u8;
  v: ValueAligned;
}

// --- the contrast: an `@unmanaged` field is a pointer, so nothing transfers -
// `PtrInner` is align-16 because of its own field, but `PtrOuter` holds it as a
// 4-byte reference at offset 8 and keeps the alignment `pad0: u64` gives it.
// Alignment crosses into a record only by *inlining* the aligned thing.
@unmanaged struct PtrInner {
  a: u8;
  @abi.align(16) b: u32;
}

@unmanaged struct PtrOuter {
  pad0: u64;
  inner: PtrInner;
}

// --- refuse: the attribute is inert before this change ----------------------
// These are the numbers the pre-feature compiler produced for `Middle`.
assert(offsetof<Control>("b") == 4);        // refuse: 4 (unchanged, and it must stay 4)
assert(sizeof<Control>() == 12);

// --- fixed: the field moves to 16, the next field follows it ----------------
assert(offsetof<Middle>("b") == 16);
assert(offsetof<Middle>("c") == 20);        // 16 + 4, immediately after
assert(sizeof<Middle>() == 32);             // rounded to the record's new alignment
assert(alignof<Middle>() == 4);             // log2 -> 16 bytes

// --- partial: without the override the middle field sits at 4 ---------------
assert(offsetof<Middle>("b") != 4);
assert(offsetof<Middle>("b") != offsetof<Control>("b"));

// --- a last field carries the trailing pad ----------------------------------
assert(offsetof<Last>("b") == 16);
assert(sizeof<Last>() == 32);               // 16 + 4 = 20, rounded up to 32
assert(alignof<Last>() == 4);

// --- asking for the natural alignment is a no-op ----------------------------
assert(offsetof<NoOpAligned>("b") == 4);
assert(sizeof<NoOpAligned>() == 8);
assert(alignof<NoOpAligned>() == 2);
assert(offsetof<NoOpAligned>("b") == offsetof<NoOpPlain>("b"));
assert(sizeof<NoOpAligned>() == sizeof<NoOpPlain>());
assert(alignof<NoOpAligned>() == alignof<NoOpPlain>());

// --- a value type's alignment reaches the record that nests it inline --------
assert(alignof<ValueAligned>() == 4);       // the value reports 16-byte alignment
assert(sizeof<ValueAligned>() == 16);       // one f32, extent rounded to 16
assert(offsetof<HoldsValue>("v") == 16);    // placed at 16 by the value's alignment
assert(alignof<HoldsValue>() == 4);         // the outer inherits the max
assert(sizeof<HoldsValue>() == 32);         // a multiple of 16, as it must be

// --- a pointer field does not transfer alignment -----------------------------
assert(alignof<PtrInner>() == 4);           // the record itself is align-16
assert(sizeof<PtrInner>() == 32);
assert(offsetof<PtrOuter>("inner") == 8);   // a 4-byte reference after pad0
assert(alignof<PtrOuter>() == 3);           // 8 bytes, from pad0: u64 -- not 16
assert(sizeof<PtrOuter>() == 16);

export function run(): i32 {
  // Sum a few so the assertions sit in a module with a real entry point (the
  // harness instantiates and invokes `_start`, which is where the top-level
  // assertions above run).
  return <i32>(
    offsetof<Middle>("b") + offsetof<HoldsValue>("v") + offsetof<PtrOuter>("inner")
  );
}
