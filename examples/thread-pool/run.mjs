// Compiles and runs the pool example: one main store, three worker threads.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bootShared, compileProgram, disposeProgram, joinWorkers, pumpUntil,
} from "../host.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const TAG_NAMES = {
  1: "pool-size",
  2: "results",
  3: "sum",
  4: "executors",
  5: "post-failed",
  6: "result-executor",
  7: "result-value",
};

const program = compileProgram(join(here, "main.ts"), [
  "--runtime", "incremental",
  "--enable", "threads",
  "--sharedMemory",
  "--importMemory",
  "--maximumMemory", "256",
  "--enable", "stack-switching",
  // **Named since DL51.** These demos run on the continuation backend under
  // `run-wasmfx`; the feature no longer selects it, because `auto` means fiber now.
  "--stackful-backend", "continuation",
]);

try {
  // main + workers 1..3
  const booted = bootShared({ bytes: program.bytes, total: 4, tagNames: TAG_NAMES });
  await pumpUntil(booted.exports);
  await joinWorkers(booted.workers);
} finally {
  disposeProgram(program);
}
