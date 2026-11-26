// Compiles and runs the four-policy example.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bootShared, compileProgram, disposeProgram, joinWorkers, pumpUntil,
} from "../host.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const TAG_NAMES = {
  1: "pool-size",
  2: "lazy-body-before-await",
  3: "lazy-value",
  4: "eager-body-at-create",
  5: "eager-value",
  6: "counting-created",
  7: "counting-awaited",
  8: "counting-body-at-create",
  9: "counting-sum",
  10: "remote-value",
  11: "remote-worker",
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
  const booted = bootShared({ bytes: program.bytes, total: 2, tagNames: TAG_NAMES });
  await pumpUntil(booted.exports);
  await joinWorkers(booted.workers);
} finally {
  disposeProgram(program);
}
