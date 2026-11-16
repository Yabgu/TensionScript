# `--wasm-gc` — user classes as wasm GC structs

**Status:** an opt-in slice, off by default: a class hierarchy (one base, one or
more derived), `instanceof` by `ref.test`, and a class-typed field (acyclic). It exists because the
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
| `instanceof` reads an `rtId` | `ref.test (ref $C)` |
| a base's field reached via the vtable walk | the same prefix of the struct |

Scope, deliberately: no arrays, no strings, no `Map`/`Set`, no
`StaticArray`/`TypedArray`, no host-ABI change, and **no mutually recursive class
types**. The standard library keeps the pointer ABI, so a program that mixes the
two worlds must not mix them yet.

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

**`instanceof` is `ref.test`, in both directions from one emission.** A `Derived`
passes `Base` (subtype), a `Base` fails `Derived`, a sibling fails both, and a
null reference fails everything — which is `instanceof`'s answer too.

**The sibling negative needs structurally distinct classes.** wasm GC type
identity is *structural*: two classes with the same supertype and the same field
types canonicalize to one type, so `ref.test` cannot tell them apart. Measured —
`Derived { a: i32, b: i32 }` and `Sibling { a: i32, c: i32 }` came out as one
type, and `x instanceof Sibling` was true for a `Derived`. The fixture gives the
sibling an `f64` so the test tests what it claims. **This is a real limitation
of the encoding** (there are no nominal types in wasm GC), and a program that
relies on distinguishing two structurally identical classes will not get it. A
later slice could add a per-class brand field; nothing does today.

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
