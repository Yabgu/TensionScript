// Compiles main.ts with the stackful backend, instantiates it on a bare store,
// and prints what the guest observed. No threads, no shared memory.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileProgram, disposeProgram, line } from "../host.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const TAG_NAMES = {
  0: "status",
  1: "suspensions",
  2: "carried",
  3: "total",
  4: "final",
};

const program = compileProgram(join(here, "main.ts"), [
  "--runtime", "incremental",
  "--enable", "stack-switching",
]);

try {
  const module = new WebAssembly.Module(program.bytes);
  const exports = new WebAssembly.Instance(module, {
    env: {
      abort: (a, b, c, d) => { throw new Error(`guest abort ${a} ${b} ${c} ${d}`); },
      emit: (tag, value) => line(TAG_NAMES, tag, value),
    },
  }).exports;

  // The start section resumed main and its core loop; main's status is the
  // shell's `__asyncStatus`.
  line(TAG_NAMES, 0, exports.__asyncStatus.value);
} finally {
  disposeProgram(program);
}
