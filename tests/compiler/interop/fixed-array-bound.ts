// `T[N]` with a non-literal bound is still refused, and the refusal is the same
// `TS1005 ']' expected` the empty-bracket form gave before `T[N]` existed.
//
// The bound is a compile-time literal by construction: an inline array's size is
// its record's layout, and there is no runtime length to read. `N` as a const or
// a type parameter is therefore not a disambiguation problem to solve here -- it
// is a different feature, and it stays unbuilt.

const FOUR = 4;

struct ConstBound {
  arr: f32[FOUR];
}

export function run(): i32 { return 0; }
