// Plays the host: reads each record through the `i32` pointer, exactly as an
// adapter reads through `guest_read(ptr, dst, len)`.
const f32At = (memory, ptr, offset) =>
  new Float32Array(memory.buffer, ptr + offset, 1)[0];

export function preInstantiate(imports) {
  Object.assign(imports.env, {
    host_sum(ptr) {
      const memory = imports.env.memory; // unused; the module owns its memory
      return f32At(hostMemory(), ptr, 0) + f32At(hostMemory(), ptr, 4);
    },
    host_scaled(ptr, k) {
      return (f32At(hostMemory(), ptr, 0) + f32At(hostMemory(), ptr, 4)) * k;
    }
  });
}

let linked = null;
const hostMemory = () => linked.exports.memory;

export function postInstantiate(instance) {
  linked = instance;
  const check = (what, actual, expected) => {
    if (actual !== expected) throw new Error(`${what}: expected ${expected}, got ${actual}`);
  };
  check("one record", instance.exports.oneRecord(), 4.0);
  check("record beside a scalar", instance.exports.recordWithScalar(), 40.0);
  // 10 + 10: the first call's restore must put the bump back where it started,
  // or the second call writes to a different slot (and the host would still read
  // the right one — this asserts the arithmetic, and the WAT pins the restore).
  check("two calls, both correct", instance.exports.twice(), 20.0);
}
