// `Map` under `--wasmGc`: scalar entries migrate, reference entries are refused by name.
//
// Two separate findings, both measured in GC23:
//
// 1. **`MapEntry<K,V>` is `@unmanaged`** — a linear record — so a *reference* key or value
//    has no representation there: `entry.key = key` writes `K` into linear memory, which
//    under the GC ABI means writing a reference to an address. Measured: `Map<string,i32>`
//    took the GC ABI and aborted inside Binaryen with `isBasic() && "Basic type expected"`,
//    a crash with no location. It is now a **named refusal**, and the program stays on the
//    pointer ABI where it works.
//
// 2. **`hashStr` is not migrated.** It is `@inline`, so it inlines into every lookup and
//    never reaches the call-site hook `compareImpl` uses, and the replacement written for
//    it produced a different number than an independent XXH32 implementation. So hashing is
//    untouched and `Map<string,V>` is out of scope until it is settled — see
//    `docs/wasm-gc.md`.
//
// `Map<i32,i32>` and `Set<i32>` are unaffected: scalars in a linear record are the
// representation that already worked, so they are the part of this file that migrates.
//
//   mapI32       set, get, has, size on scalar keys — on the GC ABI
//   setI32       add, has, size
//   mapGrow      enough distinct keys to force bucket and entry growth

class ScalarHolder {
  m: Map<i32, i32> = new Map<i32, i32>();
  s: Set<i32> = new Set<i32>();
}

export function mapI32(): i32 {
  let h = new ScalarHolder();
  h.m.set(1, 10);
  h.m.set(2, 20);
  if (!h.m.has(2)) return -1;
  if (h.m.has(9)) return -2;
  if (h.m.size != 2) return -3;
  return h.m.get(1) + h.m.get(2); // 30
}

export function setI32(): i32 {
  let h = new ScalarHolder();
  h.s.add(4);
  h.s.add(5);
  h.s.add(4); // duplicate
  if (!h.s.has(5)) return -1;
  if (h.s.has(9)) return -2;
  return h.s.size; // 2
}

export function mapGrow(): i32 {
  let m = new Map<i32, i32>();
  for (let i = 0; i < 40; ++i) m.set(i, i * 2);
  let sum = 0;
  for (let i = 0; i < 40; ++i) {
    let v = m.get(i);
    if (v != i * 2) return -(i + 1);
    sum += v;
  }
  return sum; // 1560
}
