/**
 * The input awaitable's backend check, as a **compile-time** answer (DL57).
 *
 * `await inputTask(...)` is a park on a producer handle, and a park needs a backend that can
 * suspend the guest and a host that posts for it. The fiber backend has both and they are
 * proved (`tension-core/tests/park_frame.rs`); the others do not — the continuation shell's
 * park records and returns with nothing to post for it (measured, DL56 §4), and a
 * non-stackful build compiles the await to its operand, which is the silent `0` I103 is
 * about.
 *
 * So this is a builtin rather than a std function: `src/builtins.ts` answers `1` for a build
 * that can park, and stops the compile with a message naming the awaitable and the backend
 * otherwise. A guest that cannot be served is refused where it is written, not where it
 * hangs.
 *
 * **The SDK is the caller**, not a program: `tension-framework/assembly/io.ten`'s
 * `inputTask()` calls it first. A second consumer (a socket, a file) calls the same
 * function with a different `source` and needs no change here.
 */

// @ts-ignore: decorator
@builtin
export declare function __inputSupported(): i32;
