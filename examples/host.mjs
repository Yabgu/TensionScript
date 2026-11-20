// The host half every example shares: compile the program into a temp
// directory, instantiate it, and turn the guest's `emit(tag, value)` calls into
// transcript lines.
//
// The guest never formats text. It has no strings to pass across the WebAssembly
// boundary; it reports a tag and an i32, and the tag names live here, next to the
// program that chose them. That is also what makes a transcript stable: a test
// asserts the number, not the prose.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const here = dirname(fileURLToPath(import.meta.url));
export const CLI = join(here, "..", "bin", "tensionscript.js");

/** Compiles `main.ts` next to `run.mjs` into a temp directory. */
export function compileProgram(sourcePath, flags) {
  const dir = mkdtempSync(join(tmpdir(), "ts-example-"));
  const wasmPath = join(dir, "main.wasm");
  execFileSync(process.execPath, [
    CLI, sourcePath, "-o", wasmPath, "--noColors", ...flags,
  ], { stdio: "pipe", cwd: dir });
  return { dir, bytes: readFileSync(wasmPath) };
}

/** Removes a directory made by `compileProgram`. */
export function disposeProgram(program) {
  rmSync(program.dir, { recursive: true, force: true });
}

/** `tag: value` — the one line format every example prints. */
export function line(tagNames, tag, value) {
  const name = tagNames[tag] ?? `tag${tag}`;
  console.log(`${name}: ${value}`);
}

/**
 * Instantiates a `--sharedMemory --importMemory` module and boots it.
 *
 * The boot order is `docs/thread-abi.md` §2: carve, configure main's arena,
 * then `__start`. `__startThread` is the host's only job beyond that: make a
 * fresh instance over the same memory and run `__workerMain(id)` on it.
 */
export function bootShared({ bytes, total, tagNames }) {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 256, shared: true });
  const workers = [];
  const module = new WebAssembly.Module(bytes);

  const env = {
    memory,
    abort: (a, b, c, d) => { throw new Error(`guest abort ${a} ${b} ${c} ${d}`); },
    emit: (tag, value) => line(tagNames, tag, value),
    __executorCount: () => total,
    __startThread: (id) => {
      const worker = new Worker(new URL("./worker.mjs", import.meta.url), {
        workerData: { bytes, memory, id, total },
      });
      worker.on("message", (message) => {
        if (message && message.emit) line(tagNames, message.emit[0], message.emit[1]);
        if (message && message.error) console.error(message.error);
      });
      workers.push(new Promise((resolve, reject) => {
        worker.on("exit", resolve);
        worker.on("error", reject);
      }));
      return 0;
    },
  };

  const exports = new WebAssembly.Instance(module, { env }).exports;
  const carved = exports.__threadInit(64);
  if (carved !== 0) throw new Error(`__threadInit answered ${carved}`);
  exports.__arenaInit(exports.__mainArenaBase(), exports.__mainArenaSize());
  exports.__start();
  return { exports, memory, workers };
}

/**
 * Runs the guest's `pump()` until `done()` answers nonzero, or the timeout.
 *
 * A core loop that goes idle returns to the host; there is no thread to wake
 * this one. The guest's `pump` is one iteration over its own executor, so the
 * host is the clock, exactly as the Gate 4 tests do it.
 */
export async function pumpUntil(exports, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (typeof exports.done === "function" && exports.done()) return;
    if (typeof exports.pump === "function") exports.pump();
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error(`timed out after ${timeoutMs} ms`);
}

/** Waits for the worker threads the guest asked for to exit. */
export async function joinWorkers(workers) {
  await Promise.all(workers);
}
