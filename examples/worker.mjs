// One OS thread, one instance, the worker half of the boot contract.
//
// `__arenaInit` first — it moves `__stack_pointer` and must run with no live
// guest frame — then `__workerMain(id)` for the rest of this thread's life.
// The guest's `emit` becomes a message to the parent, because only the parent
// owns stdout and the transcript's order across workers is not part of the
// contract.

import { parentPort, workerData } from "node:worker_threads";

const { bytes, memory, id, total } = workerData;

try {
  const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
    env: {
      memory,
      abort: (a, b, c, d) => { throw new Error(`worker abort ${a} ${b} ${c} ${d}`); },
      emit: (tag, value) => parentPort.postMessage({ emit: [tag, value] }),
      __executorCount: () => total,
      __startThread: () => -1,
    },
    // **The `scheduler` namespace** (DL44): a shared stackful build imports
    // `scheduler::park` whether or not it parks. Keyless parks are the store's own
    // business; a keyed one would name a producer this example does not have.
    scheduler: {
      park: (taskId, class_, key) => {
        if (class_ !== 0 || key !== 0) {
          throw new Error(
            `worker: scheduler::park named a producer (class ${class_}, key ${key}) ` +
              "that this example has no producer for",
          );
        }
      },
    },
  });
  const e = instance.exports;
  e.__arenaInit(e.__workerArenaBase(id), e.__workerArenaSize(id));
  parentPort.postMessage({ status: e.__workerMain(id) });
} catch (error) {
  parentPort.postMessage({ error: String(error && error.stack || error) });
}
