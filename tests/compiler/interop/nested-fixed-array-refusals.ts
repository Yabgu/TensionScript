// Round VT4, item 4: the **storage positions** a nested `[T * N]` value still
// cannot take, refused by name instead of reaching `Type#toRef`'s assert.
//
// A nested array element is several leaves, so binding it is the deep-SROA
// phase. Before this check a parameter of `[[i32 * 4] * 2]` was accepted and
// then crashed in `bindSroaArrayParameterLeaves`; the type was accepted by
// `isMemory` and the crash came later, from a path that could no longer say
// which declaration was at fault. Every position that needs a slot reports
// instead:
//
//   - a parameter
//   - a return type
//   - a global
//   - a local (reported by the SROA local path, which owns the leaves)
//
// The field-embedded form **works** -- see `nested-fixed-array.ts`.

class C {
  g: [[i32 * 4] * 2];
  tail: i32;
}

function takes(x: [[i32 * 4] * 2]): i32 {
  return x[0][0];
}

function returns(): [[i32 * 4] * 2] {
  return [[1, 2, 3, 4], [5, 6, 7, 8]];
}

let globalNested: [[i32 * 4] * 2];

function localNested(n: i32): i32 {
  if (n == 9) {
    let a: [[i32 * 4] * 2];
  }
  return 0;
}

export function run(): i32 {
  // Every refusal has to be reachable: a declaration nothing resolves never
  // fires. `sizeof`/`new` materialise the field form that does compile.
  const c = new C();
  c.g[0][0] = 7;
  if (takes(c.g) == 1) return 1;
  if (returns()[0][0] == 2) return 2;
  if (globalNested[0][0] == 3) return 3;
  if (localNested(9) == 4) return 4;
  return c.g[0][0];
}
