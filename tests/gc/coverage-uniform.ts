// A uniform program, so the coverage report says so: INFO TS6413 `N of N`.
//
// Two classes, not one, because the line is `N of N` and a single-class program
// cannot distinguish "counted everything" from "counted the first".
class Point { x: i32; y: i32; constructor(x: i32, y: i32) { this.x = x; this.y = y; } }

class Shape {
  origin: Point;
  samples: Array<i32>;
  constructor() {
    this.origin = new Point(1, 2);
    this.samples = new Array<i32>(0);
    this.samples.push(10);
  }
  total(): i32 { return this.origin.x + this.origin.y + this.samples[0]; }
}

export function probe(): i32 { return new Shape().total(); } // 13
