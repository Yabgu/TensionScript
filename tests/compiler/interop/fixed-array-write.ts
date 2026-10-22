// `T[N]` — Commit 13: writing an element. 0.8.0.
//
// `foo.arr[i] = v` uses the same address arithmetic as the read and then a
// store of the element's width, so a read and a write cannot disagree about
// which bytes they address.
//
// Three-way:
//   refuse  (before this commit): `foo.arr[2] = v` did not compile -- the
//           resolver's index-signature lookup reported `TS2329 Index signature
//           is missing in type 'f32[4]'` for a target that is perfectly
//           writable.
//   partial (arithmetic without the field offset): the store lands at
//           `i * 4`, so writing `arr[2]` clobbers `arr[1]` and the element
//           keeps its old value. Both assertions below fail.
//   fixed: writes at 4 + i*4, the round trip returns what was written, and the
//           scalar fields on either side are untouched.

@unmanaged struct Mixed {
  a: i32;
  arr: f32[4];
  b: i32;
}

function setup(): Mixed {
  let p = changetype<Mixed>(heap.alloc(24));
  p.a = 111;
  p.b = 222;
  return p;
}

{
  let p = setup();

  // --- fixed: a constant index writes at fieldOffset + i*4 ---------------
  p.arr[0] = 1.5;
  p.arr[1] = 2.5;
  p.arr[2] = 3.5;
  p.arr[3] = 4.5;

  assert(load<f32>(changetype<usize>(p) + 4) == 1.5);
  assert(load<f32>(changetype<usize>(p) + 8) == 2.5);
  assert(load<f32>(changetype<usize>(p) + 12) == 3.5);
  assert(load<f32>(changetype<usize>(p) + 16) == 4.5);

  // --- the round trip through the read path ------------------------------
  assert(p.arr[2] == 3.5);
  assert(p.arr[3] == 4.5);

  // --- the partial would clobber arr[1] here ----------------------------
  p.arr[2] = 7.25;
  assert(p.arr[2] == 7.25);
  assert(p.arr[1] == 2.5);       // untouched by the write to index 2
  assert(load<f32>(changetype<usize>(p) + 12) == 7.25);

  // --- a dynamic index takes the same arithmetic ------------------------
  let i = 3;
  p.arr[i] = 8.5;
  assert(p.arr[3] == 8.5);
  assert(p.arr[2] == 7.25);

  // --- the scalar fields are not the array's bytes ----------------------
  assert(p.a == 111);
  assert(p.b == 222);

  // --- an assignment used as a value yields what was written ------------
  let captured: f32 = 0;
  assert((captured = (p.arr[0] = 9.5)) == 9.5);
  assert(captured == 9.5);
  assert(p.arr[0] == 9.5);
}

export function run(): i32 { return 0; }
