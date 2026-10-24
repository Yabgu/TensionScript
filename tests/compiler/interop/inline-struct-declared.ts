// `@inline struct` — the type itself. Commit 1 of the 1.0 value-type phase.
//
// What this pins: an `@inline struct` **declares**, and it is a C record for
// every type-level question — `sizeof`, `offsetof`, `alignof` — because it takes
// the parser's `@unmanaged` injection and therefore the same resolver layout
// branch as every other record (scoping §7). What it does *not* yet do is any
// storage: locals, parameters, returns, fields, `T[N]` and captures each refuse
// by name (`interop/inline-struct-refusals.ts`), because compiling one as a
// pointer would alias — the bug the value type exists to remove.
//
// `@abi.alias` on a field works, measured rather than assumed: the alias path is
// field-level and ungated (`builtin_abiNameOf` reads the field type node's
// attributes, with no record-kind test), and `@inline struct` parses field
// attributes through the same code path `@managed struct` does.

@inline struct Vec2 {
  x: f32 @abi.alias("c_x");
  y: f32 @abi.alias("c_y");
}

// The probe of the phase: `u32` at 0, `u64` at 8, so the record is 16 bytes with
// alignment 8. The same numbers `@unmanaged struct` gives — that is the point of
// sharing the layout path.
@inline struct Mixed {
  a: u32;
  b: u64;
}

// A record of scalars only, to show the extent and alignment are the fields'.
@inline struct Tail {
  a: u8;
  b: u16;
}

// --- the type is a C record for sizeof/alignof/offsetof --------------------
assert(sizeof<Mixed>() == 16);
assert(alignof<Mixed>() == 3);          // log2 of 8
assert(offsetof<Mixed>() == 16);        // alias of sizeof, as everywhere
assert(offsetof<Mixed>("a") == 0);
assert(offsetof<Mixed>("b") == 8);

assert(sizeof<Tail>() == 4);            // a:u8 at 0, b:u16 at 2, rounded to 2
assert(alignof<Tail>() == 1);           // 2 bytes
assert(offsetof<Tail>("b") == 2);

assert(sizeof<Vec2>() == 8);
assert(alignof<Vec2>() == 2);           // f32 -> 4 bytes

// --- the values match `@unmanaged struct`, field for field -----------------
// The strongest form of the claim above: a parallel `@unmanaged struct` with the
// same fields must agree on every number, because they share the layout code.
@unmanaged struct MixedUnmanaged {
  a: u32;
  b: u64;
}
assert(sizeof<Mixed>() == sizeof<MixedUnmanaged>());
assert(alignof<Mixed>() == alignof<MixedUnmanaged>());
assert(offsetof<Mixed>("b") == offsetof<MixedUnmanaged>("b"));

// --- `@abi.alias` is honored on a field ------------------------------------
// The alias names the field for the far side of an ABI without moving a byte, so
// the layout above must be unchanged by it (`sizeof<Vec2>` is 8 either way).
assert(abiNameOf<Vec2>("x") == "c_x");
assert(abiNameOf<Vec2>("y") == "c_y");

export function run(): i32 {
  return <i32>(
    sizeof<Mixed>() + alignof<Mixed>() + offsetof<Mixed>("b") + sizeof<Tail>()
  );
}
