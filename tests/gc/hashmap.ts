// `hashStr`, and `Map<string,V>` / `Set<string>` under `--wasmGc` (GC23).
//
// `std/assembly/util/hash.ts` walks a string as **bytes**:
//
//     if (changetype<usize>(key) == 0) return XXH32_SEED;
//     let pos = changetype<usize>(key);      // the payload is at the object's address
//     ... load<u32>(pos + i) ... load<u8>(pos + i) ...
//
// Under the flag a `String` is `(array (mut u16))`, so none of the three exists: not the
// null-integer test, not the address, not the loads.
//
// **The replacement has to reproduce the same numbers**, not merely produce a working
// hash. A map's bucket index comes from it, so a different hash is a different — still
// correct, but not equivalent — data structure, and the flag is not supposed to change
// behaviour. `hashOf`/`hashEmpty` exist so the two builds can be compared value for
// value; that is the equivalence proof, and it is why the byte-level loop is preserved
// rather than replaced with something simpler.
//
// The mapping is exact: byte `2k` of the old representation is the low byte of element
// `k`, byte `2k+1` its high byte (little-endian), so a `u32` word at byte `4k` is
// `element[2k] | element[2k+1] << 16` — the same number `load<u32>` produced.
//
//   hashOf          the hash of a non-empty string
//   hashEmpty       the hash of "" (the `len < 16` and zero-length paths)
//   hashLong        the hash of a string long enough for the 16-byte block loop
//   mapStr          `Map<string,i32>`: set, get, has, size
//   setStr          `Set<string>`: add, has, size
//   mapMany         enough distinct keys to force bucket and entry growth

import { HASH } from "util/hash";

export function hashOf(): u32 { return HASH<string>("hello"); }
export function hashEmpty(): u32 { return HASH<string>(""); }
export function hashLong(): u32 { return HASH<string>("the quick brown fox jumps over"); }
export function hashNonAscii(): u32 { return HASH<string>("héllo wörld ✓"); }

export function mapStr(): i32 {
  let m = new Map<string, i32>();
  m.set("a", 1);
  m.set("bb", 22);
  m.set("ccc", 333);
  if (!m.has("bb")) return -1;
  if (m.has("zz")) return -2;
  if (m.size != 3) return -3;
  return m.get("a") + m.get("bb") + m.get("ccc"); // 356
}

export function setStr(): i32 {
  let s = new Set<string>();
  s.add("x");
  s.add("yy");
  s.add("x"); // duplicate, must not grow the set
  if (!s.has("yy")) return -1;
  if (s.has("zz")) return -2;
  return s.size; // 2
}

/// Distinct keys, so both the bucket table and the entry buffer have to grow: the case
/// where a wrong hash shows up as a lost key rather than a wrong answer.
export function mapMany(): i32 {
  let m = new Map<string, i32>();
  for (let i = 0; i < 40; ++i) m.set("k" + i.toString(), i);
  let sum = 0;
  for (let i = 0; i < 40; ++i) {
    let v = m.get("k" + i.toString());
    if (v != i) return -(i + 1);
    sum += v;
  }
  return sum; // 780
}
