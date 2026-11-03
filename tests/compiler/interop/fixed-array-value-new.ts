// `[T * N]` — Landing 5b.2: a value-form field in a `new`-constructed record.
//
// The field is **inline bytes** inside the heap record: `sizeof<H>()` counts
// them and `offsetof<H>("arr")` finds them, both fixed by Landing 5b.1's element
// sizing. So constructing the record needs no store into the field at all —
// `__new` returns the payload zeroed (`memory.fill(ptr, 0, size)`,
// `std/assembly/rt/itcms.ts`), and a value's zero is all-zero bytes.
//
// That is why the setter is skipped rather than called with a zero: the setter
// stores `sizeof(array)` bytes from a pointer-shaped operand, which the
// validator rejects — measured in Landing 5a before the refusal existed. The
// field was never a slot; it is storage.
//
// What this pins:
//
//   1. **Zero-init is free and correct.** `new H()` then `h.arr[0]` is 0.
//   2. **The field is writable after construction**, one element at a time.
//   3. **The record is a real heap object** — the array's bytes travel with it,
//      so two records have two arrays.

@unmanaged struct H {
  head: u32;
  arr: [u32 * 4];
}

export function zeroed(): u32 {
  const h = new H();
  return h.arr[0] + h.arr[3] + h.head;      // 0
}

export function written(): u32 {
  const h = new H();
  h.arr[0] = 42;
  h.arr[3] = 7;
  return h.arr[0] * 100 + h.arr[3];         // 4207
}

// Two records, two arrays: the field is per-object storage, not shared.
export function independent(): u32 {
  const a = new H();
  const b = new H();
  a.arr[0] = 5;
  b.arr[0] = 9;
  return a.arr[0] * 10 + b.arr[0];          // 59
}

// The head field shares the record with the array — the layout offset is real,
// not a separate allocation.
export function withHead(): u32 {
  const h = new H();
  h.head = 3;
  h.arr[1] = 4;
  return h.head * 10 + h.arr[1];            // 34
}
