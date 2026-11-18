// One flat class, no inheritance, no std containers — the slice's scope.
class Point {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) { this.x = x; this.y = y; }
}

export function make(a: i32, b: i32): Point { return new Point(a, b); }
export function getX(p: Point): i32 { return p.x; }
export function setY(p: Point, v: i32): void { p.y = v; }
// Construct, read, write, read back, pass as an argument, return it.
export function roundTrip(a: i32, b: i32): i32 {
  let p = make(a, b);
  let before = getX(p);
  setY(p, b * 10);
  return before * 1000 + p.y * 10 + p.x - a;
}
