// Round VT6: a record's field slots are bytes, so a GC reference in one is
// refused **where the record is laid out** — at its declaration — and not at the
// first use.
//
// Before this round `struct S { s: string }` was accepted for introspection and
// refused for every use: `sizeof<S>()` answered 4, `offsetof<S>("s")` answered 0,
// and `let s: S` / `s.s = "x"` were refused later (`compiler.ts`,
// `fillSroaFieldLocals`). Two answers for one declaration, and the number
// `sizeof` gave invited the wrong conclusion — that a 4-byte blob with an
// untraced GC pointer is fine to size a buffer with.
//
// The check is the record-shaped twin of the one the arrays already had
// (`resolveFixedArrayType` / `resolveUnmanagedArrayType`: `[T *]` and `[T * N]`
// refuse a `@managed` element at the declaration, because the buffer behind them
// is not scanned either). It lives in `Resolver#finishResolveClass`, before the
// field's offset is banked, so `sizeof` and `offsetof` have no wrong number to
// report — the field contributes no bytes because it does not exist.
//
// Five member shapes, both record declarations (plain `struct` and
// `@inline struct`, which the parser makes one declaration), and a nested case:
//
//   string            `[u8*N]` for an inline char array, `[u8*]` for a pointer
//   a class           `usize` for an opaque word, or an `@unmanaged` record
//   Array<T>          the buffer is not scanned, so the reference would dangle
//   @managed struct   a GC-owned record is still a reference
//   nested            refused through the inner record, which is refused once
//
// Every declaration has a `sizeof`/`offsetof` user: the record has to be resolved
// for the layout check to run, and that these calls do **not** answer a number is
// the point.
//
// Round VT7 adds the array spelling of the same hazard, which slipped past the
// direct-member check: `struct S { a: Foo[4] }` and `struct S { a: string[4] }`
// compiled with `sizeof` 16 — four untraced reference slots. `resolveFixedArrayType`
// keeps accepting a class element on purpose (a *local* array of pointers has an
// address of its own and is coherent), so the refusal belongs to the member
// position. The five shapes below pin the record forms it covers: plain
// `struct`, a nested value-form array, `@unmanaged class`, and
// `@unmanaged struct` (whose fields are pointer-layout slots in an unscanned
// blob exactly like a value record's). `@managed struct` is not here: its
// inline-array field is already refused one arm earlier.

class SomeClass {
  x: i32 = 1;
}

@managed struct SomeManaged {
  v: i32;
}

struct Str {
  s: string;
}

struct Cls {
  k: SomeClass;
}

struct Arr {
  a: Array<i32>;
}

struct Mgr {
  m: SomeManaged;
}

@inline struct IStr {
  s: string;
}

struct Inner {
  s: string;
}

struct Outer {
  i: Inner;
}

export function sizes(): i32 {
  return sizeof<Str>() + sizeof<Cls>() + sizeof<Arr>() + sizeof<Mgr>();
}

export function offsets(): usize {
  return offsetof<Str>("s");
}

export function valueSizes(): i32 {
  return sizeof<IStr>();
}

export function nested(): i32 {
  return sizeof<Outer>();
}

// VT7: the array spelling of the same hazard. A value-form `[T * N]` is N
// slots; in a local the slots are pointers with their own address, but as a
// member of a record they are bytes nothing scans. `resolveFixedArrayType`
// still accepts the class element on purpose (the local case is coherent);
// the refusal belongs to the member position, and it must cover the pointer
// records (`@unmanaged class` / `@unmanaged struct`) as well as the value ones.
struct ClsArr {
  a: SomeClass[4];
}

struct StrArr {
  a: string[4];
}

struct NestedArr {
  a: SomeClass[2][3];
}

@unmanaged class UnmanagedClsArr {
  a: SomeClass[4];
}

@unmanaged struct UnmanagedStrArr {
  a: string[4];
}

export function arraySizes(): i32 {
  return sizeof<ClsArr>() + sizeof<StrArr>() + sizeof<NestedArr>();
}

export function unmanagedArraySizes(): i32 {
  return sizeof<UnmanagedClsArr>() + sizeof<UnmanagedStrArr>();
}
