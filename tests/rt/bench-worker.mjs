// The worker half of the bench: one instance over the shared memory, then
// `__workerMain(id)` for the rest of the thread's life.

import { parentPort, workerData } from "node:worker_threads";

const { bytes, memory, id, total } = workerData;

try {
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
    env: {
      memory,
      abort: (a, b, c, d) => { throw new Error(`worker abort ${a} ${b} ${c} ${d}`); },
      __executorCount: () => total,
      __startThread: () => -1,
    },
  });
  const e = instance.exports;
  e.__arenaInit(e.__workerArenaBase(id), e.__workerArenaSize(id));
  parentPort.postMessage({ status: e.__workerMain(id) });
} catch (error) {
  parentPort.postMessage({ error: String(error && error.stack || error) });
}
