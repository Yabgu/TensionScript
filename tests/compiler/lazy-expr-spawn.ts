// `@lazy await spawn(f())`: the launch escapes the deferral, the await does not.
//
// This is the fifth form the ratified ruling created, and the only place `spawn`
// escapes `@lazy`. The marker says "this is a launch", so the call is hoisted out
// of the deferred region and emitted at the declaration; the `await` stays in the
// guard, so it happens at the first read. That is what makes the pair
// (`@lazy await f()` vs `@lazy await spawn(f())`) two different and both useful
// things: deferred-and-sequential versus started-and-joined-late.
//
// The three functions below are the three timing claims, each asserted where it
// can be observed rather than inferred from the emitted code:
//
//   deferred  — not launched at the declaration, launched at the read;
//   hoisted   — launched at the declaration, not launched again at the read;
//   abandoned — launched at the declaration and never read: the task completes
//               and its value is discarded (measured: the counter reads 1).
//
// The harness compiles but does not execute these assertions; the numbers were
// checked with a host run before the fixture was pinned (`3031` = 30*100 + 30 +
// 1, i.e. the three payloads in order).

let calls: i32 = 0;
async function work(x: i32): i32 { calls += 1; return x * 10; }

// Without spawn: nothing launched at the declaration.
export async function deferred(): i32 {
  calls = 0;
  let b: i32 = @lazy await work(3);
  assert(calls == 0);        // not launched yet
  let v: i32 = b;
  assert(calls == 1);        // launched at the read
  return v;
}

// With spawn: launched at the declaration, awaited at the read.
export async function hoisted(): i32 {
  calls = 0;
  let b: i32 = @lazy await spawn(work(3));
  assert(calls == 1);        // launched already
  let v: i32 = b;
  assert(calls == 1);        // and not launched again
  return v;
}

// Never read: the task completes and its value is discarded.
export async function abandoned(): i32 {
  calls = 0;
  let b: i32 = @lazy await spawn(work(3));
  assert(calls == 1);
  return calls;
}

export function go(): i32 {
  let d = deferred();
  let h = hoisted();
  let a = abandoned();
  return d._record.payload * 100 + h._record.payload + a._record.payload;
}
