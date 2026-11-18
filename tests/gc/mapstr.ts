// A reference-keyed `Map` is refused by name, and stays on the pointer ABI.
//
// `MapEntry<K,V>` is `@unmanaged`, so `entry.key = key` writes `K` into a linear record.
// For `K = string` that is a reference with no address, which is not a missing emitter
// case but a representation question: `Map`'s entries would have to become GC structs
// (or the record would have to hold the key by reference some other way). Until then the
// honest outcome is a refusal that names the cause, not a module that aborts inside
// Binaryen.
class Names { m: Map<string, i32> = new Map<string, i32>(); }

export function probe(): i32 {
  let n = new Names();
  n.m.set("a", 1);
  return n.m.get("a");
}
