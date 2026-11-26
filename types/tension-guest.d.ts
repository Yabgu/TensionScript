/**
 * **The guest language's declaration surface** (DL45).
 *
 * A TensionScript guest is read by TypeScript tooling — VS Code opens a `.tension`
 * file with the TypeScript language server attached, because that is what keeps
 * completion and hover — and then reports TypeScript errors about correct guest code:
 * `i32` and `usize` and `@unmanaged` are not TypeScript, `~lib/task` does not resolve,
 * and `print` is imported from a path the editor knows nothing about.
 *
 * This file is the answer, and it is **additive**: a declaration says what exists and
 * emits nothing. It is not in the compiler's build inputs, it is not imported by any
 * guest, and adding it moved no artifact byte — the gate is in
 * `tools/thread-promise/DL45-REPORT.md`.
 *
 * # How it is meant to be used
 *
 * Point a toolchain at it from a project's `tsconfig.json`:
 *
 * ```json
 * { "compilerOptions": { "noEmit": true }, "include": [".../types/tension-guest.d.ts"] }
 * ```
 *
 * `docs/guest-editor.md` carries the full recipe, including what it deliberately does
 * not do.
 *
 * # Rules for this file
 *
 * 1. **Every signature is copied from the source, never invented.** The canonical
 *    definitions are `std/assembly/task.ts`, `task-stack.ts`, `task-rt.ts`,
 *    `thread.ts`, and the framework's `assembly/io.ts`. A wrong declaration is worse
 *    than a missing one: the editor then reports a false error about correct code,
 *    which is the complaint this file exists to answer.
 * 2. **It is a subset, and says so.** The classes that need bodies to be useful
 *    (`Executor`, `RemotePolicy`, the pool types) are not declared here yet; a guest
 *    that imports one will still see an unresolved-module error. That is a gap to
 *    close by copying, not by guessing.
 * 3. **`await` is not declared here**, because it is not a function: the compiler
 *    lowers `await t` to `if (!t.settled) (t.policy == null ? __inlineAwait(t) :
 *    t.policy.await(t)); t.value`. What an editor needs from that is `Task<T>.value`,
 *    which is declared below.
 */

// ── The numeric types ────────────────────────────────────────────────────────────
//
// The compiler's compile-time types (AssemblyScript's, from `std/assembly/index.d.ts`
// and `src/types.ts`). `bool` is not a TypeScript type either; it is spelled `boolean`
// in the standard library's own declarations, and is aliased here because guest
// programs write it.

type i8 = number;
type i16 = number;
type i32 = number;
type i64 = number;
type u8 = number;
type u16 = number;
type u32 = number;
type u64 = number;
type bool = boolean;
type usize = number;
type isize = number;
type f32 = number;
type f64 = number;

// ── The two functions every guest calls ──────────────────────────────────────────
//
// `print` is the framework's (`tension-framework/assembly/io.ts:72`), not the
// compiler's: it writes a line to the host's stdout. Its signature is fixed and every
// guest program in `tension-core/tests/programs/` imports it, which is why it is
// declared beside the language's own surface.
//
// **`line` does not exist.** The framework declares `write`, `print`, `readLine`,
// `argCount`, `arg`, `log` and `logStructured`; there is no `line`. Declaring one
// would be the invented signature this file refuses.

/** Writes `text` and a newline to the host's stdout. */
declare function print(text: string): void;

// ── Tasks (`std/assembly/task.ts`) ───────────────────────────────────────────────

/** A task's completion record: eight words, read by the store and by Backend A. */
declare class TaskRecord {
  /** Offset 0: the class the completion arrived as; 0 before delivery. */
  class_: i32;
  /** Offset 4: the producer's submit-time id. */
  key: i32;
  /** Offset 8: the producer's `b`, verbatim — integer and `bool` results. */
  payload: i32;
  /** Offset 12: 0, or the capability's errno. */
  status: i32;
  /** Offset 16: the producer's `f0` — `f32` results, and the low half of 64-bit ones. */
  f0: f32;
  /** Offset 20: the producer's `f1` — the high half of 64-bit results. */
  f1: f32;
  /** Offset 24: the await tag; 0 today. */
  tag: i32;
  /** Offset 28: 0 = parked, 1 = settled. */
  done: i32;
}

/**
 * What a policy decides about where and when a task runs (`std/assembly/task.ts:114`).
 *
 * `crossesThreads` is read by the **compiler**, not by this class: a task on a policy
 * that crosses threads captures addressable arguments rather than heap references.
 */
declare abstract class TaskPolicy {
  readonly crossesThreads: bool;
  /** Called at the call site, once the task object exists and before any body runs. */
  abstract create(task: TaskBase): void;
  /** Called by `await` when the task is not settled. Must return with it settled. */
  abstract await(task: TaskBase): void;
}

/** The base of every task handle: the fields a store and a policy read. */
declare abstract class TaskBase {
  /** The task's continuation slot in the executor's table; `-1` before it is installed. */
  slot: i32;
  /** The executor the spawn entry recorded; `0` is main. Routing does not read it. */
  home: i32;
  /** Whether the task has completed (its result is available). */
  settled: bool;
  /** The completion status; 0 on success. */
  status: i32;
  /**
   * The policy this task was created under, or `null` for the default.
   *
   * **A writable field, not a setter**: the compiler lowers `t = f() on pool` to a
   * write here (`src/compiler.ts:13917` reads it back the same way). There is no
   * `__setTaskPolicy` builtin, and declaring one would be an invented signature.
   */
  policy: TaskPolicy | null;
  /** The `$starts` index of this task's synthesized spawn entry, or `-1`. */
  entry: i32;
}

/**
 * A task handle. `await t` is the compiler's syntax and yields `value`; `drive()` is
 * the seam Backend A runs when the task has to make progress before it can be read.
 */
declare class Task<T> extends TaskBase {
  /** The task's result. Read after `await t`, which settles it. */
  value: T;
  /** The record this handle carries, when Backend A created one. */
  recordValue: TaskRecord | null;
  /** Backend A's record for this task. */
  _record: TaskRecord;
  /** Runs the task's body on the current stack (the stackful backend's seam). */
  drive(): void;
  /** The record this handle is for, without asserting one exists. */
  __parkRecord(): TaskRecord | null;
}

/** The default policy's `await`: park the current task on `task` (`task.ts:147`). */
declare function __inlineAwait(task: TaskBase): void;

/** The store's task-binding table, sized once per module (`task-rt.ts:185`). */
declare function __taskBindTable(capacity: i32): void;

/**
 * The `$starts` index of a spawned function (`task-stack.ts:332`).
 *
 * A compile-time constant per function: `__spawnIndexOf(f$spawnStart)`.
 */
declare function __spawnIndexOf(start: () => i32): i32;

// ── Threads (`std/assembly/thread.ts`) ──────────────────────────────────────────

/**
 * Starts worker `id` from `$starts` entry `entryIndex`, with `argSlot` as its
 * argument; answers the status word (`thread.ts:1713`).
 */
declare function __spawnThread(id: i32, entryIndex: i32, argSlot: i32): i32;

/** Waits for worker `id` to exit; answers its status (`thread.ts:1750`). */
declare function __threadJoin(id: i32): i32;

/** Asks worker `id` to exit; answers the status (`thread.ts:1732`). */
declare function __executorExit(id: i32): i32;
