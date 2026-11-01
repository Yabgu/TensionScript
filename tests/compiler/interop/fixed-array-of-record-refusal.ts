// `T[N]` of a record — refused by name.
//
// A fixed-size array sizes N *records* worth of bytes, but the element that
// actually fits here is the 4-byte reference: a class type's kind is
// `TypeKind.Usize` ("also the base of class types", `types.ts:53-58`) and
// `isMemory` answers true for `Usize` (`types.ts:400`), so the scalar gate
// below the `@inline` branch waved records through to `Type.fixedArray`.
//
// Measured before the refusal: the `sizeof` of the first block was 16 for four
// 16-byte `Props`, and `items[i].r` loaded four bytes at `i * 4` and
// dereferenced them as an address. No diagnostic, which is the reason this
// refusal exists — `showcase.md` §1 and `resolveFixedArrayType`'s own doc
// comment already said the shape is deferred, so the code disagreed with the
// contract rather than with a preference.
//
// The declaration's memory model is not what makes the element wrong:
// `@unmanaged` and `@managed` are both records, so both spellings are here.
// (An ordinary class element stays accepted: there the 4-byte element is what
// the source means, an inline array of pointers.)
//
// Each record is made reachable through `sizeof`: a refusal on a field of a
// record nothing resolves never fires — the same laziness `@abi.align`'s
// refusals account for (`interop/abi-align-refusals.ts`).

@unmanaged struct Props {
  r: f64;
  m: f64;
}

// 1. An `@unmanaged` record element: the shape a guest reaches for when it
//    wants C's `struct { Props items[4]; }` and gets a pointer array instead.
@unmanaged struct UnmanagedBlock {
  head: u8;
  items: Props[4];
}

// 2. A `@managed` record element: the same claim. A managed record would also
//    need room for a header the elements do not have, which is the second
//    reason `@managed` fields already refuse an inline array (`resolveClass`).
@managed struct ManagedProps {
  r: f64;
}

@unmanaged struct ManagedBlock {
  items: ManagedProps[2];
}

export function sizes(): i32 {
  return sizeof<UnmanagedBlock>() + sizeof<ManagedBlock>();
}
