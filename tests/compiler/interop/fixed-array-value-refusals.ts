// `[T * N]` — Landing 5a.5: the positions that still refuse.
//
// 5a.5 splits the kind by memory model, so three forms exist and only one of
// them is fully implemented:
//
//   value  `[T * N]` / `u32[N]` / `@inline [T * N]`   inline bytes, no address
//   view   `@unmanaged [T * N]`                       a pointer (works — see
//                                                     `fixed-array-unmanaged-view`)
//   heap   `@managed [T * N]`                         Landing 5c
//
// The **value form** is real and correctly laid out: it is a record field's
// type, `sizeof` counts N × sizeof(T), and Landing 1's fixture asserts all of
// that. What it has no representation for is a *slot* — a WASM local,
// parameter or result. `toRef` asserts for it by design, so every such position
// is refused by name here rather than left to reach that assert.
//
// **The value form's refusals:**
//
//   1. `changetype<[T * N]>(p)` — it would put an address into a thing that is
//      inline bytes. This is the one compile-time bug Landing 5a introduced:
//      one `toRef` arm answered `I32` for every form, so this compiled and a
//      value-typed thing came to carry an address. Use `@unmanaged [T * N]`.
//   2. a parameter, 3. a return, 4. a global — inline bytes have no slot in any
//      of them yet (a **local** does: Landing 5b gives it one WASM local per
//      element leaf, so that position moved to
//      `fixed-array-value-local`).
//
// **The heap form** is refused in every position (Landing 5c).
//
// A **record element** is refused for the value form — it would have to lay N
// records out inline, which is Landing 5b — and accepted for the view form,
// which is the pointer-to-a-run-of-records that `[T *]` already gives.
//
// Each probe below is written to produce exactly one diagnostic: no probe reads
// a binding whose declaration was refused, so the fixture pins causes rather
// than cascades.

// --- 1. the value form cannot be constructed from an address ---------------

export function valueChangetype(p: usize): u32 {
  return changetype<[u32 * 4]>(p)[0];
}

// --- 2-5. the value form has no slot --------------------------------------

export function valueParam(a: [u32 * 4]): u32 {
  return a[0];
}

export function valueReturn(p: usize): [u32 * 4] {
  return changetype<@unmanaged [u32 * 4]>(p);
}

const valueGlobal: [u32 * 4] = unreachable();

export function valueGlobalRead(): u32 {
  return 0;
}

// --- the heap form, refused in a parameter and in a field -----------------

export function heapParam(a: @managed [u32 * 4]): u32 {
  return a[0];
}

@unmanaged struct HeapField {
  xs: @managed [u32 * 4];
}

// Touching the record is what resolves its fields, so the field refusal needs a
// use even though the field is what is being refused.
export function heapField(o: usize): u32 {
  const h = changetype<HeapField>(o);
  return 0;
}

// --- a record element, value form only ------------------------------------

@unmanaged struct RecordElement {
  a: u32;
  b: u32;
}

@unmanaged struct RecordFieldHolder {
  xs: [RecordElement * 2];
}

export function recordFieldHolder(o: usize): u32 {
  const h = changetype<RecordFieldHolder>(o);
  return 0;
}
