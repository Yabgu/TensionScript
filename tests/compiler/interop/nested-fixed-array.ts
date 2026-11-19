// Round VT4, item 4: a fixed array whose element is a fixed array.
//
// `Type#isMemory` enumerated scalar kinds and answered `false` for
// `TypeKind.FixedArray`, so `[[i32 * 4] * 2]` was refused as "a fixed-size array
// of '[i32 * 4]'" even though the inner array is exactly 16 inline bytes. With
// the kind admitted the field lays out (32 bytes) and element access indexes it:
// a nested array element is **storage**, so `g[i]` compiles to its address --
// the same rule a record element follows -- and `g[i][j]` indexes from there.
//
// Positions where a nested array would need SROA leaves stay refused by name
// (parameter, return, global, local); the diagnostics are pinned in
// `nested-fixed-array-refusals.ts`. This fixture is the field-embedded form.

class C {
  g: [[i32 * 4] * 2];
  tail: i32;
}

export function arraySize(): i32 {
  return sizeof<[[i32 * 4] * 2]>();         // 32
}

export function offsetG(): i32 {
  return offsetof<C>("g");                  // 0
}

export function offsetTail(): i32 {
  return offsetof<C>("tail");               // 32
}

export function roundTrip(): i32 {
  const c = new C();
  c.g[0][0] = 1;
  c.g[0][3] = 4;
  c.g[1][0] = 5;
  c.g[1][3] = 8;
  return c.g[0][0] * 1000000
    + c.g[0][3] * 10000
    + c.g[1][0] * 100
    + c.g[1][3];                            // 1040508
}

export function fresh(): i32 {
  const c = new C();
  return c.g[0][0] + c.g[0][3] + c.g[1][0] + c.g[1][3] + c.tail;  // 0
}
