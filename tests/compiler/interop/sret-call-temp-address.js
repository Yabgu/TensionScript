// Plays the caller. The values prove the sret slot is addressed correctly, not
// just that the module validates: an address built as `base + mark` lands past
// the region, so every assertion here fails (or the instance traps) if the
// extra add comes back.
export function postInstantiate(instance) {
  const check = (what, actual, expected) => {
    if (actual !== expected) {
      throw new Error(`${what}: expected ${expected}, got ${actual}`);
    }
  };

  check("sret destination and read-back", instance.exports.sumAxes(20, 22), 48);
  check("negative values", instance.exports.sumAxes(-5, 2), 3);
  check("discarded result (the second address site)", instance.exports.discarded(7), 7);
}
