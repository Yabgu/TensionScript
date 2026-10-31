// Deep SROA, Phase D: `copyInto(dest, value)` — an inline value's leaves
// materialise into memory, one store per leaf at `dest + offsetof(leaf)`.
//
// This is the primitive a host-facing guest needs. `changetype<usize>(value)`
// stays **refused**: the address it would return belongs to a temp nobody
// tracks. `copyInto` names the destination instead, so the copy is explicit and
// the bytes land where the caller chose and owns.
//
// The three functions are the same primitive at three depths, plus the engine's
// own shape (a record whose transform is nested — the case that motivated deep
// SROA in the first place).
//
// Offsets come from the **type** (`property.memoryOffset`), so what lands in
// memory is the wire layout, not a packing of the locals. `copy_out` writes a
// u32 at 1024 and two f32s at 1028 and 1032; `submit_sim` writes eleven leaves
// across 4096..4136.

struct Inner {
  x: f32 = 0;
  y: f32 = 0;
}

struct Outer1 {
  a: u32 = 0;
  inner: Inner = {};
}

export function copy_out(): f32 {
  const o = new Outer1();
  o.a = 7;
  o.inner.x = 1.5;
  o.inner.y = 2.5;
  copyInto(1024, o);
  const slot = changetype<@unmanaged Outer1>(1024);
  return f32(slot.a) + slot.inner.x + slot.inner.y;
}

struct L3 { x: f32 = 0; }
struct L2 { c: L3 = {}; }
struct L1 { b: L2 = {}; }

export function copy_deep(): f32 {
  const o = new L1();
  o.b.c.x = 3.14;
  copyInto(2048, o);
  const slot = changetype<@unmanaged L1>(2048);
  return slot.b.c.x;
}

// A source that is itself a **path**: `copyInto(at, outer.inner)` copies the
// sub-value's leaves, with offsets relative to the sub-value.
export function copy_nested_source(): f32 {
  const o = new Outer1();
  o.inner.x = 1.5;
  o.inner.y = 2.5;
  copyInto(3072, o.inner);
  const slot = changetype<@unmanaged Inner>(3072);
  return slot.x + slot.y;
}

// The engine's shape: a record whose transform and rotation are nested values.
struct Transform { x: f32 = 0; y: f32 = 0; z: f32 = 0; }
struct Quat { x: f32 = 0; y: f32 = 0; z: f32 = 0; w: f32 = 1; }

struct SceneNodeSim {
  nodeId: u32 = 0;
  position: Transform = {};
  rotation: Quat = {};
  scale: Transform = {};
}

export function submit_sim(): u32 {
  const n = new SceneNodeSim();
  n.nodeId = 42;
  n.position.x = 1;
  n.position.y = 2;
  n.position.z = 3;
  n.scale.x = 1;
  n.scale.y = 1;
  n.scale.z = 1;
  copyInto(4096, n);
  const view = changetype<@unmanaged SceneNodeSim>(4096);
  return view.nodeId + u32(view.position.x) + u32(view.position.y) + u32(view.position.z);
}
