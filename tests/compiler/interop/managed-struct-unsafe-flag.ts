// `DecoratorFlags` bit assignment: an `@managed struct` is not `@unsafe`.
//
// `DecoratorFlags.ManagedStruct` and `DecoratorFlags.Unsafe` were both `1 << 11`.
// Nothing observable came of it, because every gate that consults `Unsafe`
// inspects a *function*, *variable* or *index-signature* element -- never the
// class element that carries `ManagedStruct` -- and a method's `Function`
// instance copies its **function prototype's** flags (`program.ts:3980`), so a
// class-level bit never reaches a member. The nine sites are
// `compiler.ts:5897/5929/5958/6467/6633/8173/9229/9676/9704`.
//
// That makes this fixture a **regression guard, not a cell that distinguishes
// the old bit from the new one**: a build with the collision compiles this file
// clean too. What it pins is the property that must stay true -- constructing,
// calling, reading, writing and globally storing an `@managed struct` under
// `--noUnsafe` must not be reported as unsafe -- so that if a future gate starts
// consulting class flags, the collision (or a bad flag choice) shows up here
// first. The control that the gate still *works* is `tests/compiler/unsafe.ts`,
// which expects 25 `AS101` errors under the same flag.
//
// The distinguishing evidence for the assignment itself is the enum: after the
// fix every `DecoratorFlags` value is a distinct bit (0..13), and `InlineStruct`
// is reserved at `1 << 12` for the 1.0 value type without being wired into any
// path.

@managed struct M {
  x: u32 = 0;
  y: u64 = 0;

  doubled(): u32 { return this.x * 2; }
  bump(): void { this.x += 1; }
}

@managed struct Other {
  x: u32 = 0;
}

// A global of a record type: the global-write gate (`compiler.ts:9704`, `:5897`)
// is reached through `VariableLikeElement`, not the class.
let G: Other = new Other();

// --- construction + method call + field read/write, all under --noUnsafe ----
export function exercise(): u32 {
  let m: M = new M();          // constructor gate (`:9676`)
  m.x = 5;                     // setter gate (`:5929`)
  m.y = 7;
  let read = m.x;              // field read (`:9704` through the property path)
  m.bump();                    // instance-call gate (`:6633`)
  return m.doubled() + read;   // method gate again
}

// --- a global of a record type ---------------------------------------------
export function globalWrite(): u32 {
  G = new Other();
  G.x = 9;
  return G.x;
}

// --- the values are what the code says, so the module really ran ------------
assert(<u32>exercise() == 17); // doubled() == 10, read == 5, + 1 from bump()

export function run(): i32 {
  return <i32>(exercise() + globalWrite());
}
