// Function values as GC structs (GC22).
//
// `std/assembly/function.ts` declares exactly two fields, and the compiler already
// treats their layout as a contract (`FUNCTION_INDEX_OFFSET = 0`, with
// `assertFunctionLayout` verifying `_index` at 0 and `_env` at pointer width wherever a
// `Function<T>` instance is materialised):
//
//     Function<T>  { _index: u32, _env: usize }
//
// Under the flag that becomes a GC struct `{ <brand>, _index i32, _env i32 }`:
//
// - **`_index` stays an `i32` table index.** `call_indirect` is unchanged — a function
//   value's identity genuinely is an integer and always was.
// - **`_env` stays an `i32` address.** The arena is never-free (GC19/GC20), so an
//   environment block cannot be stolen, and linear memory whose lifetime is the arena's
//   is the right lifetime for a sandbox guest.
//
// Neither field is a reference, so the struct is untraced — which is right rather than
// convenient: `_env` points at linear memory nothing traces, and pretending otherwise
// would be a lie the collector would act on.
//
// ## What each export measures
//
//   singleCall      a function value in a field: assign, call, get the answer
//   twoFields       two independent function fields, so a wrong index shows
//   capturedEnv     an arrow capturing a local, called after its frame returns
//   capturedThis    an arrow capturing `this`, called after its frame returns
//   afterChurn      a stored function value called after 200 000 allocations
//   resumeShape     `resume!: (s: X) => void` — the shape `TaskState` needs
//   holderReport    the coverage line for a class holding one of these
//
// The last is the assertion that GC17 could not make: a class with a function-typed
// field was *reported* on the GC ABI and then killed the compiler at `gcFieldTypeRef`.

class Caller {
  cb: (x: i32) => i32 = (x: i32): i32 => x + 1;
  apply(x: i32): i32 { return this.cb(x); }
}

export function singleCall(): i32 {
  let c = new Caller();
  return c.cb(41); // 42
}

class TwoFields {
  a: (x: i32) => i32 = (x: i32): i32 => x + 100;
  b: (x: i32) => i32 = (x: i32): i32 => x + 200;
  sum(x: i32): i32 { return this.a(x) + this.b(x); }
}

export function twoFields(): i32 {
  let t = new TwoFields();
  return t.sum(1); // 101 + 201 = 302
}

/// An arrow capturing a **local**. The creating frame returns before the call, so the
/// environment has to outlive it — which is exactly what `_env` is for, and what a bare
/// table index would break.
export function capturedEnv(): i32 {
  let base = 40;
  let f = (x: i32): i32 => x + base;
  return f(2); // 42
}

/// An arrow capturing **`this`**. This is the other environment shape: `_env` holds the
/// receiver of the creating function rather than a block.
class Counter {
  start: i32;
  constructor(start: i32) { this.start = start; }
  maker(): (x: i32) => i32 {
    return (x: i32): i32 => x + this.start;
  }
}

export function capturedThis(): i32 {
  let c = new Counter(40);
  let f = c.maker();
  return f(2); // 42
}

/// A stored function value called after 200 000 allocations. An environment block is
/// linear memory; the arena is never-free, so it must still be there.
let stored: (x: i32) => i32 = (x: i32): i32 => x + 1;

export function afterChurn(): i32 {
  let base = 41;
  stored = (x: i32): i32 => x + base;
  for (let i = 0; i < 200000; ++i) {
    let a = new Uint8Array(64);
    a[0] = <u8>i;
  }
  return stored(1); // 42
}

/// The shape `TaskState` declares: `resume!: (state: X) => void`, assigned after
/// construction and invoked. Not the task machinery — the field and the call.
class Machine {
  ticks: i32 = 0;
  resume: (state: Machine) => void = (state: Machine): void => {};
}

export function resumeShape(): i32 {
  let m = new Machine();
  m.resume = (state: Machine): void => { state.ticks = 42; };
  m.resume(m);
  return m.ticks; // 42
}
