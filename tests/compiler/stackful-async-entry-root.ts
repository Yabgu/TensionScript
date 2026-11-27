// **An async `_start_game` is a root, and it runs exactly once** (DL54).
//
// Three rules disagreed, and this fixture is the one that makes them agree:
//
//  1. `latchAsyncEntry` (`src/transforms.ts`) recorded "this program is started by an
//     async function" only for a declaration spelled `main`, so an exported async
//     `_start_game` got no shell — while 26 of 27 example guests export exactly that name.
//  2. The stackful transform (`src/async/stack.ts`) leaves the root **untransformed**,
//     because the shell resumes the compiled function itself; every other async function
//     becomes a task factory whose body moves to `f$spawnStart`, where nothing dispatches
//     it. `_start_game` was lowered like a helper: the artifact built, the shell called a
//     function that only *created* a task, and the guest ran, printed nothing, and exited 0.
//  3. The host (`tension-core/src/main.rs`) resolves its entry as `_start_game` then
//     `_start`, both `() -> ()`. With the shell installed the boot body ran the entry —
//     and then the host found `_start_game` in the export table and ran it again.
//
// The contract this pins: **when the fiber shell owns the entry, the boot body is exported
// as `__start() -> ()`, and the root is not also exported under a name the host would
// call.** `async main` always satisfied it by accident — `main` is not a name the host
// looks for. Assertions in `stackful-async-entry-root.js`.
async function leaf(): i32 {
  return 7;
}

export async function _start_game(): void {
  let value: i32 = await leaf();
  let doubled: i32 = value + value;
  doubled = doubled + 1;
}
