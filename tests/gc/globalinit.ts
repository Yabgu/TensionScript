// A module-scope global whose initialiser is not a constant.
//
// `const app = new Editor()` is in every app (`apps/editor/src/main.ts:2051`,
// `apps/docs/src/main.ts:1335`) and four `new AtlasFrame(...)` in
// `examples/2d/stiff-boxes/src/atlas_info.ts:27-30`. The init expression cannot be
// a wasm global's init, so the global is zeroed and assigned in the start function.
//
// Two shapes are covered: a class the slice emits as a GC struct, and a class it
// leaves pointer-shaped because one of its fields is a `String` — the fallback that
// lets real programs compile at all.
class Frame {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) { this.x = x; this.y = y; }
}

class Named {
  name: string;
  n: i32;
  constructor(name: string) { this.name = name; this.n = 3; }
}

const GROUND = new Frame(0, 768);
const RAMP = new Frame(64, 768);
const named = new Named("hello");

export function groundX(): i32 { return GROUND.x; }
export function rampX(): i32 { return RAMP.x; }
/** A class held by a global, whose own field is a `String`. */
export function namedLen(): i32 { return named.name.length + named.n; }
