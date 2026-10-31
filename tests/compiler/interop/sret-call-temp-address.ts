// The sret call-temp slot address must be the mark alone.
//
// `ensureSretStack` initialises the bump global to the region's base, so a mark
// saved from it is already absolute; `makeSretGuard` relies on that when it
// tests `mark + size > base + SIZE`. An address built as `base + mark` therefore
// points at `2 * base + ...`, past the region and often past linear memory.
//
// This fixture is the shape that caught it: a factory returns a record by sret
// and the result is read back immediately. The record is deliberately larger
// than the region's base (32-byte slot vs base 16) so the two numbers in the
// pinned `.wat` cannot be confused: `i32.const 32` is the slot size in the bump
// and the guard, and no `i32.const 16` / `i32.add` pair may appear in front of
// the destination. The `.js` runs the exports and asserts the values, so a
// reintroduced add is both a text diff and a runtime fault.

@inline struct Point {
  x: i32 = 0;
  y: i32 = 0;
  z: i32 = 0;
  w: i32 = 0;
  v: i32 = 0;
}

function makePoint(x: i32, y: i32): Point {
  const p = new Point();
  p.x = x;
  p.y = y;
  p.z = 1;
  p.w = 2;
  p.v = 3;
  return p;
}

export function sumAxes(x: i32, y: i32): i32 {
  // The call returns by sret: the slot is written by the callee and read back
  // here. Both the destination and the read-back go through makeSretAddress.
  const p = makePoint(x, y);
  return p.x + p.y + p.z + p.w + p.v;
}

export function discarded(x: i32): i32 {
  // The result is unused, which takes the *discard* path — the second site that
  // built `base + mark` independently.
  makePoint(x, x);
  return x;
}
