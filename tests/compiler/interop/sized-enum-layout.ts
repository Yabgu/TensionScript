// Sized enums — `enum Foo: T { … }`. The enum's `Type` *is* its underlying
// type, so every layout and codegen reader follows from the one answer:
// `sizeof`, `offsetof`, `alignof`, field offsets, `T[N]` strides, and the
// load/store width of a field all come from `Type` and need no enum special
// case. This fixture is what proves that, shape by shape.
//
// Three-way, as assertions:
//   refuse  (before the parser arm): `enum Small: u8 { … }` is
//           `TS1005: '{' expected.` at the colon — the file does not parse.
//   partial (the parser arm without the type repoint): the declaration parses
//           but the enum is still i32, so `sizeof<Small>()` is 4 and every
//           `== 1` assertion below fails. This is the cell that ships if the
//           resolver is not repointed.
//   fixed:   `sizeof<Small>() == 1`, the field is one byte wide, and a store
//           through the enum field leaves the neighbouring byte alone.
//
// Plain `enum Plain { … }` stays i32 — the 68 declarations in `src/`+`std/` and
// the 40 in `tests/` are all this form, and none of them change size.

enum Small: u8 { A, B, C }
enum Signed: i8 { A = -1, B = 127 }
enum Medium: u16 { A = 600, B }
enum Plain { A, B, C }

@unmanaged struct Rec {
  tag: u8;
  kind: Small;
}

@unmanaged struct RecArray {
  n: u8;
  kinds: Small[3];
}

@unmanaged struct RecPlain {
  tag: u8;
  kind: Plain;
}

struct Value {
  tag: u8;
  kind: Small;
}

@managed struct GcRec {
  kind: Small;
}

// --- the storage class is the underlying type ------------------------------
assert(sizeof<Small>() == 1);
assert(alignof<Small>() == 0);
assert(sizeof<Signed>() == 1);
assert(sizeof<Medium>() == 2);
assert(alignof<Medium>() == 1);

// --- and the default is unchanged: a plain enum is i32 ---------------------
assert(sizeof<Plain>() == 4);
assert(alignof<Plain>() == 2);

// --- a record field's offset follows from that, with zero enum code -------
assert(sizeof<Rec>() == 2);
assert(offsetof<Rec>("tag") == 0);
assert(offsetof<Rec>("kind") == 1);
assert(sizeof<RecPlain>() == 8);
assert(offsetof<RecPlain>("kind") == 4);

// --- `T[N]` stride: no `shl 2`, 3 bytes instead of 12 ---------------------
assert(sizeof<RecArray>() == 4);
assert(offsetof<RecArray>("kinds") == 1);

// --- an `@inline` struct is a value: SROA keeps one narrow local per field -
assert(sizeof<Value>() == 2);
assert(offsetof<Value>("kind") == 1);

// --- a GC record shrinks by the same layout code (measured, not predicted) --
assert(sizeof<GcRec>() == 1);

// --- a wire record: the assignment the enum cost is gone ------------------
// Before this phase `r.kind = Small.B` into a `u8`-typed field was
// `AS200: Conversion from type 'i32' to 'u8' requires an explicit cast.`
{
  let r = changetype<Rec>(heap.alloc(8));
  r.tag = 0xFF;
  r.kind = Small.B; // no cast: the enum is u8, the field is u8

  // The store is one byte. A 4-byte store would clobber `tag`, which sits
  // directly before it at offset 0.
  assert(load<u8>(changetype<usize>(r)) == 0xFF);
  assert(load<u8>(changetype<usize>(r) + 1) == 1);
  assert(r.kind == Small.B);
  assert(<i32>r.kind == 1);
}

// --- the same round trip, elements of a `T[N]` ----------------------------
{
  let r = changetype<RecArray>(heap.alloc(8));
  r.n = 0xAB;
  r.kinds[0] = Small.A;
  r.kinds[1] = Small.C;
  r.kinds[2] = Small.B;
  assert(load<u8>(changetype<usize>(r)) == 0xAB);
  assert(r.n == 0xAB);
  assert(<i32>r.kinds[0] == 0);
  assert(<i32>r.kinds[1] == 2); // stride 1: no `shl 2`
  assert(<i32>r.kinds[2] == 1);
  assert(load<u8>(changetype<usize>(r) + 3) == 1);
}

// --- SROA: an `@inline` struct with an enum field is a narrow local -------
{
  let v: Value = new Value();
  v.tag = 7;
  v.kind = Small.C;
  assert(v.tag == 7);
  assert(<i32>v.kind == 2);
}

// --- switch: the operand's width, not the switch's -------------------------
// A u8-typed discriminant is masked at each use (`i32.and 255`) and compared
// with `i32.eq`; the comparison form is unchanged from an i32-backed enum.
function classify(k: Small): i32 {
  switch (k) {
    case Small.A: return 10;
    case Small.B: return 20;
    case Small.C: return 30;
    default: return 99;
  }
}
assert(classify(Small.A) == 10);
assert(classify(Small.B) == 20);
assert(classify(Small.C) == 30);
assert(classify(<Small>5) == 99);

// --- casts: the width of the target, as any scalar -------------------------
function widen(k: Small): u32 { return <u32>k; }
function narrow(k: Small): u8 { return <u8>k; }
function toI32(g: Plain): i32 { return <i32>g; }
assert(widen(Small.C) == 2);
assert(narrow(Small.C) == 2);
assert(toI32(Plain.C) == 2);

// --- an assignment that needed a cast is now conversion-free --------------
{
  let k: Small = Small.B;
  let x: u8 = k; // no cast
  assert(x == 1);
}

// --- `const enum`: the member inlines at the underlying width -------------
// The overflow that would make this path mask (300 -> 44) is refused at the
// declaration; see `sized-enum-refusals`. Here the value is in range, so the
// inlined constant is the value.
const enum ConstSmall: u8 { A = 5, B }
function inlined(): u8 { return ConstSmall.A; }
assert(inlined() == 5);
assert(<i32>ConstSmall.B == 6);

// --- a signed narrow enum keeps its sign ----------------------------------
assert(<i32>Signed.A == -1);
assert(<i32>Signed.B == 127);
assert(sizeof<Signed>() == 1);

// --- the enum-to-string path is untouched by the width --------------------
// `E[value]` is the member-name lookup (`ensureEnumToString`), not
// `Number#toString`: the generated function compares the value as i32 against
// each member's i32-slot global, so a u8-backed enum needs no change there.
assert(Small[Small.B] == "B");
assert(Plain[Plain.B] == "B");
