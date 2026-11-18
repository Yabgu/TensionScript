// Why a capturing closure is refused under `--wasmGc` (GC22), and what it would take.
//
// `Function<T>` is `{ _index: u32, _env: usize }`. Under the flag `_index` is a table
// index and `_env` is an **address** into the never-free arena — which is what keeps
// `call_indirect` unchanged, because the caller hands the callee's environment over
// through an `i32` global before it calls.
//
// A capturing closure's environment is a **heap object**. Under the GC ABI that is a
// reference, and a reference has no address, so there is nothing to put in `_env` and
// nothing for the `i32` environment global to carry. Handling it means `_env` becoming
// a reference field and the hand-over becoming a ref-typed global — a change to
// `Function<T>`'s layout and to the call contract together. That is a design decision,
// not an emitter case, so it is refused by name:
//
//     a capturing closure under --wasmGc (its environment is a heap object, and
//     `Function<T>`'s `_env` is an `i32` address; a non-capturing function value works)
//
// Both spellings of "captures" are represented below, because they take different paths
// into the same wall: an arrow capturing a local, and an arrow capturing `this`.

/// An arrow capturing a **local**.
export function capturedEnv(): i32 {
  let base = 40;
  let f = (x: i32): i32 => x + base;
  return f(2);
}

class Counter {
  start: i32;
  constructor(start: i32) { this.start = start; }
  maker(): (x: i32) => i32 {
    return (x: i32): i32 => x + this.start;
  }
}

/// An arrow capturing **`this`**.
export function capturedThis(): i32 {
  let c = new Counter(40);
  let f = c.maker();
  return f(2);
}
