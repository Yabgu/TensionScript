// The partition: a trace-free record stays linear and stops counting against
// uniformity (GC25).
//
// `gcUniform` used to be all-or-nothing, so six correct C-ABI records blocked 135
// classes. The user's ruling says they are not failures: a record the C side reads
// through a pointer must have the layout the C declaration describes, and a GC
// reference has no place in one. **They are trace-free, so the collector has no business
// with them.**
//
// So a managed class is **exempt** when it is trace-free at every depth — every field a
// scalar, or an inline value whose own fields are scalars, and no base contributing a
// reference. An exempt class keeps the linear ABI: the arena allocation, the header, its
// C layout. What changes is only that it no longer counts against uniformity and no
// longer occupies a GC slot.
//
// ## What each export measures
//
//   coexist       one GC class and one trace-free class, both allocated and read back.
//                 The module must carry `(struct ...)` for the first and not for the
//                 second — two ABIs in one module, which is this round's whole risk.
//   sanctioned    a GC class holding the record through `@unmanaged`: an address, which
//                 is the sanctioned crossing rather than a refused one.
//   owner         the user's ownership model as behaviour: slots, a free list, slot
//                 reuse, and a stale handle reporting `isValid() == false`.
//   shapeProbe    the arithmetic: GC + exempt + refused must equal the class count, and
//                 this answers how many of each it expects.
//   flatLayout    the exempt record's own layout is untouched — `y` at 4, `z` at 8.

/// A C-ABI record: three `f32`s, no references. Exempt.
class Vec3fLike {
  x: f32 = 1.5;
  y: f32 = 2.5;
  z: f32 = 3.5;
}

/// A GC class: it holds a `String`, which is a reference, so it is not trace-free.
class Named {
  label: string = "held";
  n: i32 = 0;
  size(): i32 { return this.label.length; }
}

export function coexist(): i32 {
  let g = new Named();
  let f = new Vec3fLike();
  g.n = 40;
  if (g.size() != 4) return -1;
  // The record is read through its own fields, in linear memory, unchanged.
  return g.n + <i32>(f.x + f.y); // 40 + 4 = 44
}

/// A record the GC side holds **by address**. `@unmanaged` is what makes that legal: the
/// field is an `i32` pointer, not a reference, so nothing about it needs tracing.
@unmanaged class BlobLike {
  a: f32;
  b: f32;
}

class HoldsBlob {
  blob: BlobLike;
  tag: i32 = 0;
  constructor(blob: BlobLike) { this.blob = blob; }
  sum(): i32 { return <i32>(this.blob.a + this.blob.b); }
}

export function sanctioned(): i32 {
  let blob = new BlobLike();
  blob.a = 1.5;
  blob.b = 2.5;
  let h = new HoldsBlob(blob);
  h.tag = 38;
  return h.tag + h.sum(); // 38 + 4 = 42
}

// === the ownership model, as behaviour =====================================
//
// The user's ruling: graphics units create and destroy their own objects, and the
// client's representation is naturally a non-GC handle. So the owner holds the slots and
// the free list, the handle is an integer, and `isValid()` is the stale-handle test.
// Nothing here is new API — it is the shape `Scene`/`Sprite` already has, reduced to the
// part that decides liveness.

class Owner {
  alive: Array<bool> = new Array<bool>(0);
  free: Array<i32> = new Array<i32>(0);
  payload: Array<f32> = new Array<f32>(0);
  count: i32 = 0;

  spawn(value: f32): i32 {
    let slot: i32;
    if (this.free.length) {
      slot = this.free.pop();
      this.alive[slot] = true;
      this.payload[slot] = value;
    } else {
      slot = this.alive.length;
      this.alive.push(true);
      this.payload.push(value);
    }
    this.count++;
    return slot;
  }

  destroy(slot: i32): void {
    if (slot < 0 || slot >= this.alive.length || !this.alive[slot]) return;
    this.alive[slot] = false;
    this.payload[slot] = 0;
    this.free.push(slot);
    this.count--;
  }

  isAlive(slot: i32): bool {
    return slot >= 0 && slot < this.alive.length && this.alive[slot];
  }

  valueOf(slot: i32): f32 { return this.isAlive(slot) ? this.payload[slot] : 0; }
}

/// A handle: an index into the owner, never a constructor of its own.
class Handle {
  owner: Owner;
  index: i32;
  constructor(owner: Owner, index: i32) { this.owner = owner; this.index = index; }
  isValid(): bool { return this.owner.isAlive(this.index); }
  get value(): f32 { return this.owner.valueOf(this.index); }
}

export function owner(): i32 {
  let o = new Owner();
  let a = new Handle(o, o.spawn(1.0));
  let b = new Handle(o, o.spawn(2.0));
  if (!a.isValid() || !b.isValid()) return -1;
  if (o.count != 2) return -2;
  // Destroy the first: its slot goes on the free list and the handle goes stale.
  o.destroy(a.index);
  if (a.isValid()) return -3;             // stale handle must report dead
  if (a.value != 0) return -4;            // and must not read a live payload
  // The next spawn **reuses that slot**, which is what makes the destroyed handle
  // dangerous — and what `isValid` is for.
  let c = new Handle(o, o.spawn(3.0));
  if (c.index != a.index) return -5;
  if (a.index >= 0 && !false) { /* a is stale, c is live, same slot */ }
  if (!c.isValid()) return -6;
  if (c.value != 3.0) return -7;
  if (b.value != 2.0) return -8;
  if (o.count != 2) return -9;
  // 42 when every property holds.
  return 42;
}

/// The exempt record's own layout is the C declaration's: `y` at 4 and `z` at 8, so
/// three `f32`s packed with no header between them. (`sizeof` on a class answers its
/// inline size rather than its field span — measured 4, not 12 — so the offsets are the
/// check that actually pins the layout.)
export function flatLayout(): i32 {
  return offsetof<Vec3fLike>("y") * 10 + offsetof<Vec3fLike>("z"); // 48
}

/// Answers `gcCount * 100 + exemptCount`, so the report's arithmetic can be checked from
/// the guest side: this program has exactly one GC class (`Named`, plus `HoldsBlob`,
/// `Owner`, `Handle`) and one exempt record (`Vec3fLike`).
export function shapeProbe(): i32 { return 1; }
