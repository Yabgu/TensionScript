// Plays the host, and **re-enters the guest** in the middle of a borrowed
// pointer — the case the per-frame mark exists for.
const f32At = (memory, ptr, offset) =>
  new Float32Array(memory.buffer, ptr + offset, 1)[0];

let linked = null;
const hostMemory = () => linked.exports.memory;
const sumAt = (ptr) => f32At(hostMemory(), ptr, 0) + f32At(hostMemory(), ptr, 4);

export function preInstantiate(imports) {
  Object.assign(imports.env, {
    host_sum(ptr) {
      return sumAt(ptr);
    },
    host_cb(ptr) {
      // 1. read the record the caller is lending us
      const before = sumAt(ptr);
      // 2. re-enter the guest, which makes another external call with its own
      //    temp — allocated above ours, restored before it returns
      const inner = linked.exports.callback();
      // 3. read the SAME pointer again. A per-call-site slot would have been
      //    overwritten by step 2; a per-frame mark leaves it intact.
      const after = sumAt(ptr);
      if (before !== after) {
        throw new Error(`the borrowed temp changed across re-entry: ${before} -> ${after}`);
      }
      return before + inner + after;
    }
  });
}

export function postInstantiate(instance) {
  linked = instance;
  const actual = instance.exports.outer();
  // 3 (before) + 101 (inner) + 3 (after)
  if (actual !== 107) {
    throw new Error(`re-entrancy: expected 107, got ${actual}`);
  }
}
