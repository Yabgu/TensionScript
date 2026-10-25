// Plays the host: allocates guest memory, writes a record into it, and passes
// the address. Nothing here knows the record's fields beyond the offsets the
// guest's `sizeof`/`offsetof` already fixed.
let linked = null;
const memory = () => linked.exports.memory;

export function postInstantiate(instance) {
  linked = instance;

  // The module declares `(memory 0)` and grows it in `__start`, so make sure
  // there is room before addressing a scratch record. 60000 sits above
  // `__heap_base` (32776) and below 10 pages, and this test never allocates.
  if (memory().buffer.byteLength < 70000) memory().grow(2);
  const scratch = 60000;

  const check = (what, actual, expected) => {
    if (actual !== expected) throw new Error(`${what}: expected ${expected}, got ${actual}`);
  };

  // @unmanaged: a plain C record. 1 and 2 little-endian at +0 and +4.
  new Int32Array(memory().buffer, scratch, 2).set([1, 2]);
  check("unmanaged record by pointer", instance.exports.readU(scratch), 102);

  // @managed: the guest expects a reference, which on wasm32 is the same
  // address. The record must still be a real allocated object for the
  // collector's sake; for a read-only test the bytes suffice.
  new Int32Array(memory().buffer, scratch, 2).set([4, 7]);
  check("managed reference", instance.exports.readM(scratch), 407);

  // a scalar beside the record arrives by value
  new Int32Array(memory().buffer, scratch, 2).set([3, 5]);
  check("record beside a scalar", instance.exports.readUWithScalar(scratch, 9), 314);
}
