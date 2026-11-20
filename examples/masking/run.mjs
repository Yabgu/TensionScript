// Compiles and runs the masking example: one worker, three mask outcomes.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bootShared, compileProgram, disposeProgram, joinWorkers, pumpUntil,
} from "../host.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const TAG_NAMES = {
  1: "pool-size",
  2: "admission-refusals",
  3: "allowed-runs",
  4: "park-violations",
  5: "post-failed",
};

const program = compileProgram(join(here, "main.ts"), [
  "--runtime", "incremental",
  "--enable", "threads",
  "--sharedMemory",
  "--importMemory",
  "--maximumMemory", "256",
  "--enable", "stack-switching",
]);

try {
  // main + worker 1
  const booted = bootShared({ bytes: program.bytes, total: 2, tagNames: TAG_NAMES });
  await pumpUntil(booted.exports);
  await joinWorkers(booted.workers);
} finally {
  disposeProgram(program);
}
