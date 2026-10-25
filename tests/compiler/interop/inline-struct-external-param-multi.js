// Plays the host: both records arrive as pointers, the scalar as a value.
const f32At = (memory, ptr, offset) =>
  new Float32Array(memory.buffer, ptr + offset, 1)[0];
const i32At = (memory, ptr, offset) =>
  new Int32Array(memory.buffer, ptr + offset, 1)[0];

let linked = null;
const hostMemory = () => linked.exports.memory;

export function preInstantiate(imports) {
  Object.assign(imports.env, {
    host_two(vPtr, k, wPtr) {
      const memory = hostMemory();
      // Distinct slices of one block: the whole point of the per-call mark.
      if (vPtr === wPtr) {
        throw new Error(`both records share one address: ${vPtr}`);
      }
      const vSum = f32At(memory, vPtr, 0) + f32At(memory, vPtr, 4);
      const wSum = i32At(memory, wPtr, 0) + i32At(memory, wPtr, 4);
      // the scalar arrives by value, not as a pointer
      return vSum + k + wSum;
    }
  });
}

export function postInstantiate(instance) {
  linked = instance;
  const check = (what, actual, expected) => {
    if (actual !== expected) throw new Error(`${what}: expected ${expected}, got ${actual}`);
  };
  check("two records, one call", instance.exports.twoRecords(), 38);
  check("two calls, each unwound", instance.exports.twice(), 76);
}
