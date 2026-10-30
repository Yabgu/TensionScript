// `@inline struct` — every use that is refused by name. Commit 1 of the 1.0
// value-type phase.
//
// The type declares and is a C record (`interop/inline-struct-declared.ts`), but
// no *storage* position accepts it yet. Each refusal below is specific: it names
// the position and says why, rather than a bare `AS100 Not implemented: value
// types (@inline struct)` on the declaration (which is what 0.9.0 reported, and
// which said nothing about which use was unsupported).
//
// **Why refusing matters more than it looks.** `@inline struct` is an
// `@unmanaged struct` under the hood (same layout, same extent). Compiling a
// local of one without value semantics would therefore *succeed*, silently, as a
// 4-byte pointer — and `let q = p` would alias. That is the refuse cell of the
// scoping's three-way fixture, and it is the state this commit prevents: no use
// compiles until its codegen exists.
//
// Refused here, each with its own diagnostic:
//   - a global (locals are implemented — see `inline-struct-sroa.ts`)
//   - ...but **not** a return type any more: an `@inline struct` return is
//     sret (the caller passes a hidden destination pointer) — see
//     `inline-struct-sret.ts`.
//   - ~~a field of an `@inline` value~~ **now accepted** (deep SROA Phase A:
//     the nesting is flattened one local per leaf — see
//     `inline-nesting-nested.ts`)
//   - a field of a plain class (inline-in-heap; deferred)
//   - `T[N]` of an `@inline struct`
//   - `Array<T>` (a type argument is a pointer slot)
//   - `changetype` to one (a value has no address to reinterpret)
//   - inheritance from one
//
// Not refused, because it is a type-level question and works: `sizeof`,
// `offsetof`, `alignof`, `abiNameOf` — see the declared fixture.
//
// **Every case is reachable from `run()`**, and `run()` never reads a refused
// binding. Both halves matter: a check that only fires when a function is
// compiled would miss a dead one, and reading a refused binding would add a
// cascade (`TS2304`) that says nothing about the value type.

@inline struct P { x: u32 = 0; }
@inline struct Q { y: u32 = 0; }

class Base { b: u32 = 0; }

// a global
let globalValue: P = new P();

// a return type is **implemented** now (sret — see `inline-struct-sret.ts`);
// this function is here so `run()` exercises a discarded sret call
function makes(): P { return new P(); }

// A field of an **`@inline`** value: the outer is one WASM local per field, so
// the inner would have to be flattened into the outer's leaves — SROA
// flattening, sub-phase B. (An `@unmanaged`/`@managed` outer ACCEPTS an
// `@inline` field now — see `interop/inline-nesting-layout.ts`.)
@inline struct NestedOuter {
  a: u8 = 0;
  p: P = {};
}

// A field of a plain class: the class field is a pointer slot, so an inline
// field would be inline *in the heap* — its allocation size, `__visit` and
// constructors would all have to learn about it. Deferred; refused by name.
class Holder {
  p: P = new P();
}

// `T[N]` of an `@inline struct`: elements by value
@unmanaged struct Arrays {
  arr: P[2] = [{}, {}];
}

// `Array<T>`: a type argument is a pointer slot
function arrayOf(): void {
  let a = new Array<P>();
}

// `changetype`: a value has no pointer representation
function view(p: usize): void {
  let v = changetype<P>(p);
}

// inheritance from an `@inline struct`
@inline struct Derived extends P { z: u32 = 0; }

// ...and into one
@inline struct Sub extends Base { w: u32 = 0; }

export function run(): void {
  makes();
  arrayOf();
  view(0);
  // Forces the records' layouts to resolve, which is where the field and
  // `T[N]` refusals are raised. `Holder` needs its own use: a refusal inside a
  // class that nothing resolves never fires (measured — the same reachability
  // the nesting refusal always had).
  let n: u32 = sizeof<NestedOuter>() + sizeof<Arrays>();
  if (n == 1) globalValue = new P();
  if (n == 2) new Holder();
}
