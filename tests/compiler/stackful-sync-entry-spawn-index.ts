// **A synchronous entry that calls an async function, on the fiber backend** (DL53).
//
// Nothing here suspends *at the entry*: `_start_game` is sync and only calls `pump`,
// which awaits `leaf`. So `program.hasAsyncMain` is false, the suspending shell's start
// is never installed — and yet the transform has already given every parameterless async
// function a factory whose record names a `$starts` index:
//
//   $rec.entry = __spawnIndexOf(f$spawnStart)
//
// `--stackful-backend=fiber` prepares the shell's *mechanism* (`prepareFiberPrologue`) for
// any program with an `await`, so `pump` is compiled and the call is emitted. The table
// itself was emitted from `emitStartsTable`, which ran only when the shell's start was
// ready — a different predicate — so the helper the call names had no body and the module
// failed validation:
//
//   wasm-validator error in function …/pump: call target must exist, on
//   (call $~spawnIndex/…/pump$spawnStart)
//
// That is the whole of DL53: `__spawnIndexOf`'s guard accepted this program on the promise
// that a table would exist, and the promise was kept only for programs with an async entry.
//
// The assertions are in `stackful-sync-entry-spawn-index.js`.
async function leaf(): i32 {
  return 7;
}

async function pump(): void {
  let value: i32 = await leaf();
  let doubled: i32 = value + value;
  doubled = doubled + 1;
}

export function _start_game(): void {
  pump();
}
