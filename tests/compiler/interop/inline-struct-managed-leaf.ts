// Round VT4, item 2's **guarantee**, moved one hop earlier in round VT6: a
// managed leaf inside an inline struct is refused **where the record is laid
// out**, so the declaration itself is the diagnostic, and every inline position
// it could have been placed in is refused by construction — there is no type
// left to place.
//
// Round VT4 pinned this in three positions (a plain class field, an @unmanaged
// record field, an inline array element), each refused by
// `Resolver#findManagedLeaf` before the field took an extent. Those arms are
// still there, and still the net: they catch a leaf the declaration check
// cannot see. They are no longer where a **class** leaf is reported, because a
// record with one cannot be laid out at all any more — `sizeof` and `offsetof`
// used to answer 4 and 0 for it, which invited the conclusion that a 4-byte
// blob with an untraced GC pointer is fine to size a buffer with.
//
// This fixture therefore pins both halves:
//
//   - (0) a **class** leaf (`m: Managed`) — refused at `HasRef`'s declaration,
//         once, before any holder exists;
//   - (1) a leaf with no class reference — a function type is `isManaged`
//         (`Type#isManaged`, via the signature) but not a `classReference`, so
//         the declaration check deliberately leaves it alone and the three
//         positional backstops report exactly as they did in VT4.
//
// A bare local of the type is refused separately by
// `Program#checkInlineStructValue` and is pinned in `inline-struct-sroa.ts`.

class Managed {
  v: i32;
}

// (0) the class leaf: refused at the declaration, by `finishResolveClass`.
@inline struct HasRef {
  m: Managed;
}

// (1) the leaf the declaration check cannot see.
@inline struct HasFn {
  f: () => void;
}

class UsesHasRef {
  s: HasRef;
}

class PlainHolder {
  s: HasFn;
}

@unmanaged class RecordHolder {
  s: HasFn;
}

class ArrayHolder {
  s: [HasFn * 2];
}

export function run(): i32 {
  // Materialise every holder: a type nothing instantiates never reaches the
  // layout path, so it would "compile" whether or not it is supported. None of
  // them reads a refused field, so the expected stderr is the diagnostics with
  // no cascade.
  const d = new UsesHasRef();
  const a = new PlainHolder();
  const b = new RecordHolder();
  const c = new ArrayHolder();
  return 0;
}
