# `--wasm-gc` — user classes as wasm GC structs

**Status:** an opt-in slice, off by default: a class hierarchy, **nominal
identity via a brand field**, class-typed fields, and **mutually recursive class
types** emitted as wasm `rec` groups. It exists because the
async contract needs it: a suspended WasmFX continuation's frame is not between
`__stack_pointer` and `__heap_base`, so a guest collector cannot see it, and a
pinned root set is a workaround for a bug the engine's tracer removes. The
migration's dependency framing is the Tension side's; this page is what the
compiler does today.

## What the flag changes

`--wasmGc` (the CLI spells options in camelCase, like `--exportRuntime`):

- sets Binaryen's `GC` and `ReferenceTypes` features — **both**, because GC alone
  does not enable reference types and struct emission needs them;
- turns the shadow stack off. The pass exists so a guest collector can find roots
  in linear memory; the engine's tracer roots references itself, so the stack
  would be a second, weaker root set;
- makes a **user-declared class** (one outside `~lib/`) a `(ref null $C)`:

| today | with the flag |
| --- | --- |
| `__new(size, id)` + a header | `struct.new $C (fields…)` |
| `i32.load`/`i32.store` at `offsetof` | `struct.get` / `struct.set` |
| `changetype<usize>(obj)` | refused, with a diagnostic |
| write barrier (`__link`) | nothing — the tracer owns the edges |
| `instanceof` reads an `rtId` | `struct.get` the brand, compare by value |
| a base's field reached via the vtable walk | the same prefix of the struct |

Scope, deliberately: no arrays, no strings, no `Map`/`Set`, no
`StaticArray`/`TypedArray`, no host-ABI change. The standard library keeps the
pointer ABI, so a program that mixes the two worlds must not mix them yet.

**Not attempted:** a class-typed field whose class has not been resolved yet is a
leaf during type building, so a cycle through an unresolved class would build two
separate types instead of a group. In practice a cycle's members are resolved
together (resolving either resolves both, because the field type names the other),
but the ordering is a dependency, not a guarantee.

## The hierarchy

A subclass repeats its base's fields as an **exact prefix**, and the base is
declared open:

```wat
(type $Base    (sub (struct (field $a (mut i32)))))
(type $Derived (sub $Base (struct (field $a (mut i32)) (field $b (mut i32)))))
```

That prefix is what makes a `(ref $Derived)` usable where a `(ref $Base)` is
wanted, so a base-typed parameter reads a base field of a derived instance, and a
base's constructor initialises the same object the derived one allocated.

**Constructor chaining is one allocation, two passes.** `struct.new` takes every
field at once, so the *derived* constructor allocates — its struct's leading
fields being the base's — and a `super(…)` call then runs the base's initialisers
against the same reference, result dropped. The base's own "allocate if null" arm
finds it non-null and does nothing. There is no second object and no copying.

## `instanceof` is a brand compare, not `ref.test`

**The brand is field 0 of every struct**, immutable, holding a per-class id:

```wat
(type $…/SetX (sub $…/Command (struct (field $<brand> i32) (field $id (mut i32)) (field $value (mut f32)))))
```

`instanceof C` reads field 0 and compares it against a literal, once per class in
C's subtree (itself and every transitive descendant):

```wat
;; instanceof Command, where Command has SetX and SetY under it
local.get $0
struct.get $Command $<brand>
i32.const <brand of Command>  i32.eq
local.get …                   i32.eq <brand of SetX>   i32.or
local.get …                   i32.eq <brand of SetY>   i32.or
```

**Why not `ref.test`.** wasm GC type identity is *structural*, so two classes with
the same fields and the same base are one wasm type. Measured: `class SetX { id:
i32; value: f32 }` and `class SetY { id: i32; value: f32 }` emit **one** struct
type, and `ref.test (ref $SetX)` answers true for a `SetY`. That is a live defect
in the editor's undo dispatch
(`tension-framework/assembly/editor/command.ts:220,259` — `next instanceof SetX`
and `next instanceof SetY` on structurally identical classes), and it would have
applied the wrong command silently.

**Why not a brand field alone.** A brand *value* does not defeat canonicalization:
`(i32, i32, f32)` and `(i32, i32, f32)` with different brand values are still one
type. The brand has to be **compared at runtime**, which is what the chain above
is. That is the whole distinction: type identity stays structural, class identity
becomes nominal by comparing a value.

**Dispatch rule**, one rule for every case:

| situation | emission |
| --- | --- |
| class in the module tests another class in the module | brand chain over the target's subtree |
| a null reference | false (the chain is guarded by `!ref.is_null`) |
| a downcast `<C>x` | the same brand test, then `ref.cast` |
| a class and a standard-library type (`String`, `Object`, …) | untouched — the pointer-ABI paths |

There is no `ref.test` in the GC path at all. A brand compare is correct in every
case; `ref.test` is correct only when no structurally identical sibling exists,
and "no sibling exists" is not a property anyone can maintain.

## Brand id derivation, and why it is reproducible

FNV-1a over the class's **qualified internal name** (source path + declaration
path), masked to 31 bits, forced non-zero.

- **Reproducible:** a pure function of the name. The same source compiled twice
  gives the same ids, and nothing depends on resolution order, on which class was
  touched first, or on the order classes appear in a file. A counter over "all
  classes" would depend on all three — and there is no whole-program class list to
  iterate anyway (measured: `program.managedClasses` is filled at *resolution*
  time, so it is incomplete during codegen).
- **Unique:** 2^31 values against a handful of classes. Checked rather than
  assumed — `ensureClassType` records each brand against its class in the module,
  and a collision throws a compile error naming both classes.
- **Never 0**, so a zeroed field cannot read as a class.

## Cost

The brand is **4 bytes**, replacing a 20-byte linear header per object
(`mmInfo | gcInfo | gcInfo2 | rtId | rtSize`) — **−16 bytes per object** versus
today, plus one fewer field read on an `instanceof` than the `rtId` walk it
replaces.

## Recursion groups

A class that holds another which holds it back cannot be built one type at a time:
each needs the other's heap type before either exists.

- **Pass 1** allocates a slot per member with `_TypeBuilderGetTempHeapType`, so
  every member's heap type exists before anything refers to it.
- **Pass 2** fills each slot — `_TypeBuilderSetStructType` and, for a base inside
  the group, `_TypeBuilderSetSubType` against the base's *slot*.
- The strongly connected component goes in one `_TypeBuilderCreateRecGroup`;
  **only the component**, so acyclic classes keep their canonical, ungrouped
  types. Measured on a fixture with a 3-cycle, a 2-cycle, a cycle with
  inheritance and an acyclic pair: **three** `rec` groups, and the acyclic pair a
  plain `(type …)`.
- A failed build is a **diagnostic naming the class and the builder's reason**,
  never a silent empty module.

```wat
(rec
 (type $…/A (sub (struct (field $<brand> i32) (field $b (mut (ref null $…/B))) …)))
 (type $…/B (sub (struct (field $<brand> i32) (field $a (mut (ref null $…/A))) …)))
)
```

## What it does not do (and why the test says so)

Collection itself is not asserted by `tests/gc/wasm-gc.js`: forcing a GC needs a
host API (`Store::gc` in wasmtime) that neither Node nor the CLI exposes. The
equivalent measurement for these struct types was made in the engine that will run
them — 100,000 allocations collected, capacity 0 → 65,536 bytes, plus a
moving-collector run — and this page records that rather than letting a weaker
assertion stand in for it.

## Two Binaryen findings this slice produced

1. **`_TypeBuilderSetStructType`'s `fieldMutables` is a C `bool*`, one byte per
   field** — the glue declared `ArrayRef<bool>`, and AssemblyScript's `bool` is
   32-bit. A four-byte-per-field array puts field 0's flag at the right address
   and every later field's three bytes past it, so every field after the first
   validated as immutable (`struct.set field must be mutable`). Measured both
   ways on a two-field struct: u32 array → validate 0, byte array → validate 1.
   Fixed here with `allocBoolArray`; nothing built a multi-field struct type
   before this flag, which is why it went unseen.
2. **The in-memory `validate()` used to reject what the written binary was** —
   fixed. Two causes, both real IR defects rather than validator pedantry:
   - the constructor's field initialisers passed `this` as a pointer-width `i32`
     into a setter that takes a struct ref, so both the `local.get` and the call's
     parameter were ill-typed; and
   - two classes shared one `Type` object (types are interned by kind and flags,
     and every class is a `Usize` reference), so a cache keyed on `Type` handed
     the second class the first one's struct.

   `-O1`/`-O2`/`-O3` **aborted** on the same IR (`Assertion failed: type.isRef(),
   at ir/effects.h, trapOnNull`), which is why this was a correctness landmine and
   not a footnote: the optimizer runs passes over exactly that IR. Both are fixed,
   `validate()` now passes with `--wasmGc`, `--noValidate` is no longer needed, and
   `tests/gc/wasm-gc.js` compiles at `-O0`–`-O3` and requires the same answer from
   all four.

## The emitted shape, for reference

```wat
(type $gc/Point (struct (field $x (mut i32)) (field $y (mut i32))))

(func $gc/Point#get:x (param $0 (ref null $gc/Point)) (result i32)
  local.get $0
  struct.get $gc/Point $x)

(func $gc/Point#set:y (param $0 (ref null $gc/Point)) (param $1 i32)
  local.get $0
  local.get $1
  struct.set $gc/Point $y)

(func $gc/Point#constructor (param $0 (ref null $gc/Point)) (result (ref null $gc/Point))
  local.get $0
  ref.is_null
  if
    i32.const 0
    i32.const 0
    struct.new $gc/Point
    local.set $0
  end
  …set:x / set:y…)
```

Every class reference is **nullable**: a constructor's `this` is null until it
allocates, and a non-null `(ref $C)` there would make the call site's `ref.null` a
type error. Non-nullability is a later refinement, not this slice's.
