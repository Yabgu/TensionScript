// The other side of VT7's array-member rule: the shapes it must **not** reach.
//
// `resolveFixedArrayType` deliberately accepts an ordinary class element in the
// value form, because a *local* `Foo[4]` is four pointer slots with an address
// of its own — coherent, and out of scope. Only the member position of a record
// refuses it, and only when the element is a GC reference. Everything below
// keeps compiling:
//
//   [i32 * 4] / [u8 * 8]   scalar slot runs — the C form the message names
//   @unmanaged [Foo * 4]   a pointer, not a slot run (one 4-byte field)
//   @unmanaged records     same scalar slot runs in a pointer-layout record
//   local Foo[4]           a non-member array of pointers, untouched
//
// `stderr: []` in the sidecar means "must compile clean": no golden `.wat`, so
// the file is a gate rather than a snapshot.

class Foo {
  v: i32 = 1;
}

struct Ints {
  a: [i32 * 4];
  tail: i32;
}

struct Chars {
  name: [u8 * 8];
  len: i32;
}

struct ViewHolder {
  a: @unmanaged [Foo * 4];
}

@unmanaged class RawInts {
  a: [i32 * 4];
}

@unmanaged struct RawChars {
  name: [u8 * 8];
}

export function sizes(): i32 {
  return sizeof<Ints>() + sizeof<Chars>() + sizeof<ViewHolder>()
    + sizeof<RawInts>() + sizeof<RawChars>();
}

export function localPointerArray(): i32 {
  let a: Foo[4];
  let f = new Foo();
  a[0].v = f.v;
  return a[0].v;
}
