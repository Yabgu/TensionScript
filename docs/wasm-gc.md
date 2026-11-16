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

## `StaticArray<T>` as `(array (mut T))` — designed, proven at the IR, not yet wired

`StaticArray` is the right first container: a bare block, `[key: number]: T`, data
at offset 0, length implied by the allocation, no `length_` field. It maps 1:1 onto
a wasm array, so there is no growth policy to invent (which is exactly why `Array`
is *not* in this slice — the glue has `array.new`/`array.copy` and **no**
`array.grow`, so a push must reallocate, and that is a design decision).

**The type: `(array (mut T))`, mutable for every element kind.**

```wat
(type $item (sub (struct (field $<brand> i32) (field $v (mut i32)))))
(type $arr  (array (mut (ref null $item))))     ;; StaticArray<Item>
```

Mutability is about the **slot**, not about tracing: `(array (mut (ref null $C)))`
is traced exactly like `(array (ref null $C))`, and the elements are written by
`__set`, `copyWithin`, `sort` and the constructors, so an immutable element type
would forbid the ordinary operations. One type per element kind instead of two also
keeps wasm GC's *structural* identity from splitting `StaticArray<T>` into a mutable
and an immutable version that must stay in step at every access site. The element is
`(ref null $C)` for a class and the plain value type for a primitive, so
`array.new`'s seed is `ref.null` or a zero constant accordingly.

**The four operations:**

| today | as a wasm array |
| --- | --- |
| `length` = `(rtSize − TOTAL_OVERHEAD) >>> alignof<T>()` | `array.len` — explicit and free |
| `__new(length << alignof<T>(), id)` + `memory.fill` | `array.new $Elem (n) (zero)` |
| `load<T>(base + (i << alignof<T>()))` | `array.get $Elem` |
| `store<T>(base + (i << alignof<T>())), __link(...)` | `array.set $Elem` |

**Bounds: checked in the emitted code, and it throws.** `array.get`/`array.set`
trap out of range, and a wasm trap is fatal to the store — the guest cannot catch
it. `StaticArray`'s contract is a `RangeError(E_INDEXOUTOFRANGE)`, and `throw`
compiles to an abort in this language (`compileThrowStatement`: the error-handling
spec is not implemented), so the shape is a `u32(index) >= u32(array.len)` compare
and the same abort with the stdlib's own `"Index out of range"` string. Cost: one
compare and one branch per access — the same check the pointer version performs —
and no change in observable behaviour, which is the point.

### Why it is not wired yet, stated plainly

The IR is proven; the **type mapping is blocked**. Mapping `StaticArray<i32>`'s
`toRef` to an array type makes the *resolver* type `new StaticArray<i32>(2)` as
`~lib/string/String`, so every element access reports
`Index signature in type '~lib/string/String' only permits reading` and a plain
`a[i]` reports `Type '~lib/string/String' is not assignable to type 'i32'`.

That is the **shared-`Type`** hazard GC3 found in the type cache, in a second
place: `String` is `extends StaticArray<u16>`, so `String` and `StaticArray<i32>`
both resolve to a `Usize`-kind reference type and the resolver's
`getClassOrWrapper(targetType)` answers `String` for a `StaticArray<i32>` receiver.
Measured directly: `resolver.ts:2379`,
`resolveIndexSignature`'s `targetType.getClassOrWrapper(...)` →
`~lib/string/String` with `classReference` also `String`. Fixing it means giving a
generic class instantiation a reliable identity in the resolver, which is a
resolver change, not an array one — and a resolver change made hastily is how the
GC3 `-O2` defect happened. So the mapping is reverted and nothing about the flag's
current behaviour changed.

**What *is* proven, in the engine that will run it** (`/tmp/gc5r`, a wasmtime
50.0.1 harness using `Store::gc`, the same shape as GC1):

```
A: array of class refs, no forced collection        sum=36 len=8
B: 5 forced collections, array is the only root     sum=36 len=8
C: gc, 100000 x 1 KiB garbage (102 MB), gc, read    sum=36 len=8  capacity 65536
D: same, moving collector (gc_heap_may_move)        sum=36 len=8
E: negative control, (array i32) of raw indices     sum=36  (nothing traced — the
                                                    bug a wasm GC array removes)
F: control, every element nulled after fill         traps: null reference
verdict: elements ARE traced
```

C is the load-bearing one: 102 MB allocated and collected while the heap capacity
stayed at 65,536 bytes, so `gc()` demonstrably reclaimed, and the eight `$item`
structs — reachable only through the array — were still there. D repeats it with a
**moving** collector, so an untraced element reference would be left pointing at
the old arena instead of being rewritten. F proves the read is a real dereference
rather than a cached number.

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

## Inventory: sites that assume a managed block's data is a raw pointer

The count GC6 and GC7 have to work through. **Nothing here is fixed this round** —
it is the honest size of what rests on `StaticArray`'s linear storage.

Command, reproducible:

```sh
cd ~/work/TensionScript/std/assembly
grep -rc  'changetype<usize>'        --include=*.ts .   # address-of a managed value
grep -rc  'dataStart'                --include=*.ts .   # the raw data pointer of a view
grep -rcE '(load|store)<'            --include=*.ts .   # a read/write through one
grep -rcE 'memory\.(copy|fill)\('    --include=*.ts .   # a bulk copy through one
```

| file | `changetype<usize>` | `dataStart` | `load<>`/`store<>` | `memory.*` |
| --- | --- | --- | --- | --- |
| `string.ts` | 99 | 3 | 57 | 28 |
| `staticarray.ts` | 49 | 6 | 32 | 9 |
| `typedarray.ts` | 20 | 126 | 88 | 4 |
| `array.ts` | 30 | 46 | 44 | 11 |
| `dataview.ts` | 2 | 28 | 24 | 0 |
| `util/string.ts` | 30 | 21 | 51 | 8 |
| **std/assembly total** | **361** | **238** | **635** | **80** |
| tension-framework/assembly | 80 | 31 | — | — |

**34 of `staticarray.ts`'s 49** address-of sites are `changetype<usize>(this)` —
the class's own methods reaching into itself — across 31 members. That is the file
that must be rewritten, and it is *one* file; everything else on the list is a
client that reaches into a `StaticArray` it was handed.

The worst files, and why they are worst:

- **`string.ts` (99 / 57 / 28)** — `String extends StaticArray<u16>`, so the whole
  string implementation is StaticArray's storage with a UTF-16 view on it. A
  `String` literal is in every program, so this is the last thing that can move and
  the largest single block of work.
- **`typedarray.ts` (126 `dataStart`)** — nine numeric view types over
  `ArrayBuffer`, each with `dataStart`-based indexing.
- **`array.ts` (46 `dataStart`)** — `Array<T>`'s storage *is* a `StaticArray`-shaped
  buffer reached through `dataStart`; `Array` is GC6's design question (growth).
- **`util/string.ts` (30 / 51)** — join/split/replace paths that copy through
  pointers.

The framework adds **80** address-of and **31** `dataStart` sites of its own,
concentrated in `res.ts`, `runtime/arena.ts`, `2d/buffers.ts` and `anim/reader.ts`
— all record-layout code over `@unmanaged` memory, which this migration does not
touch, but they are listed so the count is complete.
