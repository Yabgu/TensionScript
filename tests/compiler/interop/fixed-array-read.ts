// `T[N]` — Commit 12: reading an element. 0.8.0.
//
// `foo.arr[i]` compiles to `base + fieldOffset + i * sizeof(element)`, then a
// load of the element's width. The setup writes through raw `store`s so this
// fixture exercises the *read* path only; the write path is the next commit.
//
// Three-way:
//   refuse  (before this commit): `foo.arr[2]` did not compile -- the target's
//           type had no index signature and no element access path.
//   partial (i * elementSize without the field offset): `arr[2]` reads offset 8
//           instead of 12, i.e. `arr[1]`. The assertions below fail, because
//           each slot holds a distinct value.
//   fixed: reads at 4 + i*4, and the fields on either side are untouched.

@unmanaged struct Mixed {
  a: i32;
  arr: f32[4];
  b: i32;
}

function setup(): Mixed {
  let p = changetype<Mixed>(heap.alloc(24));
  let base = changetype<usize>(p);
  p.a = 111;
  p.b = 222;
  // Distinct values per slot, at the layout the previous commits measured.
  store<f32>(base + 4, 1.5);
  store<f32>(base + 8, 2.5);
  store<f32>(base + 12, 3.5);
  store<f32>(base + 16, 4.5);
  return p;
}

{
  let p = setup();

  // --- fixed: constant indices, each at fieldOffset + i*4 -----------------
  assert(p.arr[0] == 1.5);
  assert(p.arr[1] == 2.5);
  assert(p.arr[2] == 3.5);
  assert(p.arr[3] == 4.5);

  // A read at `i*4` with no field offset would return the previous slot's
  // value here, so the four-way discrimination is what catches the partial.
  assert(p.arr[2] != p.arr[1]);
  assert(p.arr[2] == 3.5);

  // --- and a dynamic index takes the same arithmetic ----------------------
  let i = 3;
  assert(p.arr[i] == 4.5);
  let j = 0;
  assert(p.arr[j] == 1.5);

  // --- the neighbours are not the array's bytes --------------------------
  assert(p.a == 111);
  assert(p.b == 222);

  // --- a record with no leading field starts the array at 0 --------------
  let q = changetype<Holder>(heap.alloc(16));
  store<f32>(changetype<usize>(q), 9.5);
  assert(q.arr[0] == 9.5);
}

@unmanaged struct Holder {
  arr: f32[4];
}

export function run(): i32 { return 0; }
