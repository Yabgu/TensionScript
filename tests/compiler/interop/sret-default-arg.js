// Plays the caller: the values prove the omitted defaults were emitted, not just
// that the module validates.
export function postInstantiate(instance) {
  const check = (what, actual, expected) => {
    if (actual !== expected) {
      throw new Error(`${what}: expected ${expected}, got ${actual}`);
    }
  };

  check("sret, omitted default", instance.exports.make_omitted(), 3);
  check("sret, explicit argument", instance.exports.make_explicit(), 7);
  check("sret, two omitted defaults", instance.exports.make2_omitted(), 13);
  check("no-sret control", instance.exports.flat_control(), 3);
  check("instance method, omitted default", instance.exports.method_omitted(), 7);
}
