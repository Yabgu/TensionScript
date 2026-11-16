class Point { x: i32; }
export function addr(p: Point): usize { return changetype<usize>(p); }
