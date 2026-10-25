// Plays the host: writes a record into guest memory and passes its address.
let linked = null;
const memory = () => linked.exports.memory;

export function postInstantiate(instance) {
  linked = instance;
  if (memory().buffer.byteLength < 70000) memory().grow(2);
  const at = 60000;               // v
  const atW = 60032;              // w, its own record
  const f32 = () => new Float32Array(memory().buffer);
  const i32 = () => new Int32Array(memory().buffer);

  const check = (what, actual, expected) => {
    if (actual !== expected) {
      throw new Error(`${what}: expected ${expected}, got ${actual}`);
    }
  };

  f32()[at / 4] = 1.5;
  f32()[at / 4 + 1] = 2.5;
  check("record by pointer", instance.exports.sum(at), 4.0);

  // the export's copy is taken at entry; mutating the caller's bytes afterwards
  // changes what the NEXT call sees, and nothing else
  f32()[at / 4] = 10;
  f32()[at / 4 + 1] = 20;
  check("record re-read after mutation", instance.exports.sum(at), 30.0);

  // the body's writes land in its own locals, never in the caller's record
  f32()[at / 4] = 3;
  f32()[at / 4 + 1] = 4;
  check("body mutation returns the sum", instance.exports.sumAndMutate(at), 7.0);
  check("caller's record untouched by the body", f32()[at / 4], 3);
  check("caller's second field untouched", f32()[at / 4 + 1], 4);

  // two records and a scalar in one signature: (i32, i32, i32)
  f32()[at / 4] = 1;
  f32()[at / 4 + 1] = 2;
  f32()[atW / 4] = 10;
  f32()[atW / 4 + 1] = 20;
  check("two records plus a scalar", instance.exports.sumTwo(at, 5, atW), 38.0);
}
