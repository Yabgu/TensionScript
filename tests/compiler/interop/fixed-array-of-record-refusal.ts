// `T[N]` of a **`@managed`** record — refused by name.
//
// History, because the file changed shape and the reason matters:
//
// Before Landing 5b.1 this fixture refused **both** record spellings, because
// the array's size was built from the element's `byteSize` — which is the
// 4-byte *reference* for a record — so `Props[4]` claimed 16 bytes for four
// 16-byte records, and `items[i].r` loaded four bytes at `i * 4` and
// dereferenced them as an address.
//
// 5b.1 fixed the sizing (`Type#inlineExtentBytes` reads the record's
// `nextMemoryOffset`, exactly as `sizeof<Props>()` does), so an **`@unmanaged`**
// record element now lays out inline as C would: `items` at 8, the block 72
// bytes. That case became positive and moved to
// `fixed-array-record-element-size`.
//
// A **`@managed`** record element stays refused, for a reason sizing cannot
// fix: its instances carry a GC header, and an inline array of them would be N
// references with nowhere for the collector to find their headers. The same
// rule that refuses a `@managed` field inside a record, one step further out.

@managed struct ManagedProps {
  r: f64;
}

@unmanaged struct ManagedBlock {
  items: [ManagedProps * 2];
}

// Made reachable through `sizeof`: a refusal on a field of a record nothing
// resolves never fires — the same laziness `@abi.align`'s refusals account for
// (`interop/abi-align-refusals.ts`).
export function sizes(): i32 {
  return sizeof<ManagedBlock>();
}
