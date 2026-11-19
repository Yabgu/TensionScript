// Round VT4, item 2's **guarantee**: a managed leaf inside an inline struct is
// refused by name in every inline position.
//
// Accepting an inline struct as a plain-class field is safe only because this
// refusal exists: the field is bytes, and a GC pointer among those bytes is
// invisible to the collector (`__visit` walks a class's fields, not an inline
// value's leaves). The check is `Resolver#findManagedLeaf`, run before the
// field takes an extent, so the wrong extent never exists to be read.
//
// Three positions, three diagnostics:
//
//   - a **plain class** field (the arm round VT4 opened)
//   - an **@unmanaged record** field (the C-layout nested shape)
//   - an **inline array** element (one step further out)
//
// A bare local of the type is refused separately by `Program#checkInlineStructValue`
// and is pinned in `inline-struct-sroa.ts`.

class Managed {
  v: i32;
}

@inline struct HasRef {
  m: Managed;
}

class PlainHolder {
  s: HasRef;
}

@unmanaged class RecordHolder {
  s: HasRef;
}

class ArrayHolder {
  s: [HasRef * 2];
}

export function run(): i32 {
  // Materialise all three holders: a type nothing instantiates never reaches the
  // layout path, so it would "compile" whether or not it is supported.
  const a = new PlainHolder();
  const b = new RecordHolder();
  const c = new ArrayHolder();
  return a.s.m.v + b.s.m.v + c.s[0].m.v;
}
