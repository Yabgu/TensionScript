// The mechanism the whole "branch in std on a flag" approach rests on: a
// constant-conditional `if` must not compile the dead arm.
//
// `ASC_WASM_GC` is a registered constant integer, so `if (ASC_WASM_GC)` folds and
// the arm that does not apply is never compiled. Proven by putting code in the
// dead arm that *cannot* compile under the active flag:
//
//   - under --wasmGc, `changetype<usize>` of a GC class instance is AS100;
//   - without the flag, `changetype<Item>(0)` is the linear idiom, and the GC arm
//     is the dead one.
//
// If either arm were compiled, this file would not build.
class Item {
  v: i32;
  constructor(v: i32) { this.v = v; }
}

export function probe(a: Item): i32 {
  if (ASC_WASM_GC) {
    // Live under --wasmGc. `changetype<usize>` would be AS100 here.
    return a.v;
  } else {
    // Dead under --wasmGc: a GC reference has no address, so this cannot compile
    // there. Without the flag it is ordinary pointer code.
    return <i32>changetype<usize>(a);
  }
}

/** The other direction: the GC arm is the dead one when the flag is off. */
export function probeLinear(a: Item): i32 {
  if (!ASC_WASM_GC) {
    return <i32>changetype<usize>(a);
  } else {
    return a.v;
  }
}
