// Compound assignment and in/decrement on a wasm GC array's element.
//
// `a[i] = v` was intercepted (GC7/GC10) but `a[i] += v`, `a[i]++` and `--a[i]`
// were not: those compile the operator first and then *store*, and the store takes
// a different route (`lookupExpression` → `Array#__set`), so the intercept on
// `compileAssignment` never ran. Measured consequence: the store resolved
// `Array#__set`, whose body is
// `ensureCapacity(changetype<usize>(this), …)` — and `changetype<usize>` of a GC
// reference is exactly what cannot exist under the flag, so the program failed to
// compile at all.
//
// Every export answers `i32`, and the values are chosen so that a wrong store
// (writing the old value, or writing to the wrong index) changes the answer.

class Cell { n: i32; constructor(n: i32) { this.n = n; } }

/// `a[0] += 1` on a dynamic array.
export function plusEquals(): i32 {
  let a = new Array<i32>(0);
  a.push(10);
  a[0] += 5;
  return a[0];
}

/// `a[0] -= 3`, `a[0] *= 2`, `a[0] /= 4` — all four arithmetic compounds.
export function compounds(): i32 {
  let a = new Array<i32>(0);
  a.push(20);
  a[0] -= 3;
  a[0] *= 2;
  a[0] /= 4;
  return a[0]; // (20 - 3) * 2 / 4 = 8
}

/// `a[i]++` as a statement: the element changes, the result is discarded.
export function postIncStatement(): i32 {
  let a = new Array<i32>(0);
  a.push(7);
  a[0]++;
  a[0]++;
  return a[0];
}

/// `return a[0]++`: the *old* value is the result, and the element still changes.
export function postIncValue(): i32 {
  let a = new Array<i32>(0);
  a.push(5);
  let old = a[0]++;
  return old * 100 + a[0]; // 5 * 100 + 6
}

/// `--a[0]`: the *new* value is the result.
export function preDecValue(): i32 {
  let a = new Array<i32>(0);
  a.push(9);
  return --a[0]; // 8
}

/// A compound write on a slot that growth has already materialised.
///
/// Deliberately **not** `a[3] += 2` on a one-element array: `+=` reads the element
/// first, so a compound write past the used length is an out-of-range *read* and
/// aborts — the stdlib's own rule for `a[i]`, not something this arm changes.
export function compoundAfterGrowth(): i32 {
  let a = new Array<i32>(0);
  for (let i = 0; i < 4; ++i) a.push(i); // 0,1,2,3
  a[2] += 10;
  let total = 0;
  for (let i = 0; i < a.length; ++i) total += a[i];
  return total * 10 + a.length; // (0+1+12+3) * 10 + 4
}

/// The same on `StaticArray<i32>`, which has fixed storage.
export function staticArrayCompound(): i32 {
  let s = new StaticArray<i32>(3);
  s[1] = 4;
  s[1] += 6;
  return s[1]++; // 10, then the slot is 11
}

/// A managed element through a compound-free but postfix write.
export function managedPostInc(): i32 {
  let a = new Array<Cell>(0);
  a.push(new Cell(1));
  let first = a[0];
  a[0] = new Cell(first.n + 41);
  return a[0].n; // 42
}