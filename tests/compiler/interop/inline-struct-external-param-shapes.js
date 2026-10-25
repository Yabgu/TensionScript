// Plays the host. Every record import receives **one `i32` pointer** into guest
// memory and reads the record through it — the way an adapter reads through
// `guest_read(user, uint32_t ptr, void *dst, uint32_t len)`.
const f32At = (memory, ptr, offset) =>
  new Float32Array(memory.buffer, ptr + offset, 1)[0];
const i32At = (memory, ptr, offset) =>
  new Int32Array(memory.buffer, ptr + offset, 1)[0];

export function preInstantiate(imports) {
  // `imports.env` already carries the harness's abort/trace/seed and the
  // runtime hooks; add to it rather than replacing it. The memory is resolved
  // per call: it is the module's own, linked when the instance is.
  Object.assign(imports.env, {
    host_sum_u(ptr) {
      return f32At(hostMemory(), ptr, 0) + f32At(hostMemory(), ptr, 4);
    },
    host_sum_m(ptr) {
      return i32At(hostMemory(), ptr, 0) + i32At(hostMemory(), ptr, 4);
    },
    host_u_and_scalar(ptr, k, j) {
      // `k` and `j` are scalars, not pointers: the record is the only
      // indirection at this boundary.
      return f32At(hostMemory(), ptr, 0) + f32At(hostMemory(), ptr, 4) + j + (k - k);
    }
  });
}

let linked = null;
const hostMemory = () => linked.exports.memory;

export function postInstantiate(instance) {
  linked = instance;
  const check = (what, actual, expected) => {
    if (actual !== expected) {
      throw new Error(`${what}: expected ${expected}, got ${actual}`);
    }
  };
  // each record is read through its pointer by the host above
  check("unmanaged record by pointer", instance.exports.unmanagedSum(), 4.0);
  check("managed record by pointer", instance.exports.managedSum(), 42);
  check("record beside scalars", instance.exports.recordBesideScalars(), 4.25);
}
