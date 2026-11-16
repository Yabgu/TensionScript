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

### It is wired now, and the blocker was mine

GC6 reported that `a.length` did not type as `i32`, and that neither
`lookupPropertyAccessExpression` nor `resolveExpression`'s `ElementKind.Property`
arm fired. The second half of that was an instrumentation mistake — the print never
landed in the function. The first half had a real cause, and it was in the
interception GC6 had just written:

```ts
this.currentType = Type.i32;                                   // set…
return module.array_len(this.compileExpression(receiver, …));  // …then overwritten
```

`compileExpression` sets `this.currentType = contextualType` **on entry**, so setting
`i32` before calling it leaves `currentType` as the receiver's type — which the
caller reports as `StaticArray<i32> is not assignable to i32`. Compiling the
receiver *first* fixes it. The resolver was never wrong, which is why the earlier
`getClassOrWrapper` diagnosis did not survive measurement.

Where each of the four operations is answered, and why there rather than in the
resolver:

| operation | site | why not the resolver |
| --- | --- | --- |
| `new StaticArray<T>(n)` | `compileNewExpression` | the constructor body is linear-memory code; it must not be emitted |
| `a[i]` | `compileElementAccessExpression` | `__get` is `load<T>(base + (i << alignof))` — unemittable for an array |
| `a[i] = v` | `compileAssignment` | same, for `__set` |
| `a.length` | `compilePropertyAccessExpression` | the getter reads `rtSize` from a header |

**Emission, not the resolver, because the resolver is already correct**: it types
`a.length` as `i32` and `a[i]` as `T` today, through
`lookupPropertyAccessExpression` and the index signature. What cannot survive is
*calling* the members those types come from, and call-vs-not is an emission
decision. A resolver special case would have to lie about the class to stop the
members being compiled, and mapping `StaticArray#length` to a builtin would change
the class for every program including flag-off ones.

The four intercepts are **guarded on `options.wasmGc` before they resolve
anything**, because a stray `resolveExpression` on every property access changes
what later resolutions see: measured, it moved **14 compiler fixtures** that have
nothing to do with arrays (`simd`, `number`, `resolve-access`, `std/string`, …).
With the flag off, none of these blocks runs.

`@unmanaged`/`T[N]` fixed arrays and `Array`'s buffer stay linear memory. The
boundary in emitted code is the receiver's static type: a `StaticArray<T>` instance
gets `array.*`; every other array shape keeps `load`/`store` at an offset, and
`StaticArray`'s own members are never referenced so never compiled.

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

## Why `StaticArray` is still not wired: the diagnosis, corrected

The GC5 report blamed a resolver collision — "`getClassOrWrapper` answers
`~lib/string/String` for any `Usize`-typed receiver, because `String extends
StaticArray<u16>`". **Measurement does not support that.** This section is the
correction, with the commands.

### Q1 — what does `new StaticArray<i32>(2)` resolve to?

Instrumented `compileNewExpression` and `resolveIndexSignature`, with the array
type mapping applied:

```
[Q1] instance=~lib/staticarray/StaticArray<i32> type=~lib/staticarray/StaticArray<i32>
     kind=10 classRef=~lib/staticarray/StaticArray<i32> gcElement=i32
[Q]  idxsig targetType=~lib/staticarray/StaticArray<i32> kind=10
     classRef=~lib/staticarray/StaticArray<i32>
     getClassOrWrapper=~lib/staticarray/StaticArray<i32>
```

Both are **correct**. `getClassOrWrapper` returns the `StaticArray<i32>` class, not
`String`. The claimed collision does not occur.

### Q2 — is the instantiated `Class` distinguishable from `String`'s?

**Yes, and it is already the thing being returned.** `Type#classReference` for a
`StaticArray<i32>` type is the resolved `StaticArray<i32>` `Class` (internal name
`~lib/staticarray/StaticArray<i32>`), which is a different object from
`~lib/string/String`. Nothing is being discarded.

Why `String` never interferes: the mapping is keyed on **prototype identity**
(`cls.prototype != program.staticArrayPrototype`), so `String` and the nine
`TypedArray`s — which all `extends StaticArray<…>` — are excluded. An earlier
version used `extendsPrototype`, and *that* is what produced the
`~lib/string/String` errors: it mapped `String` itself onto an array and then read
`String#length` through array ops. The bug was in the test, not the resolver.

### Q3 — where does the compiler keep the instantiated class?

Three places, all reachable without a lookup:

| where | what | site |
| --- | --- | --- |
| `Type#classReference` | the instantiated `Class` for a reference type | `src/types.ts:433` |
| `Class#type` | back-reference to that `Type` | `src/program.ts` |
| `resolver.resolveClassInclTypeArguments` | the constructor of the identity | `src/resolver.ts:3695` |

So a caller never *needs* `getClassOrWrapper` for a receiver whose `Type` it
already has — `type.classReference` is exactly the field `getClassOrWrapper`
returns for an internal reference (`getClass()` is `isInternalReference ?
classReference : null`). The `Wrapper` half of the name only matters for value
types.

### Q4 — how many `getClassOrWrapper` sites are there?

```
$ grep -rc getClassOrWrapper src/*.ts
src/builtins.ts:4   src/compiler.ts:22   src/resolver.ts:21   src/types.ts:2
total: 49
```

49 (the brief said 51 — same site list, I measure 49 occurrences). **None of them
needs to change**, because none of them is wrong: the ones reachable from element
access all answer correctly, as Q1 shows.

### Q5 — does the collision bite today, without the flag?

**No.**

```
$ node bin/tensionscript.js q5.ts --outFile off.wasm          # flag off
exit=0                                            # resolves to StaticArray<i32>
$ grep 'call $~lib/staticarray' off.wat
  call $~lib/staticarray/StaticArray<i32>#get:length
  call $~lib/staticarray/StaticArray<i32>#__uset
```

`new StaticArray<i32>(2)`, `a[0] = 7`, `a[0]` and `a.length` all resolve and emit
correctly today. The behaviour changes **only** when the mapping is applied, so the
defect is mapping-induced and not a latent resolver bug.

## What actually breaks, and it is not what the brief describes

> **Superseded by "It is wired now, and the blocker was mine" above.** The three
> failures listed here were real, but item 2's cause was an ordering bug in the
> interception GC6 had just written, not a resolver or property-access defect. Kept
> as the record of what was measured at the time.

With the mapping applied, three distinct things fail, and only one of them is about
types:

1. **The `StaticArray` class body cannot be compiled.** Its members are
   linear-memory code — the constructor calls `__new` (an `i32`), `#get:length`
   reads `rtSize` out of a header, `__get`/`__uset` do `load`/`store` at an
   offset — so with the instance typed as an array they fail validation:

   ```
   [wasm-validator error in function ~lib/staticarray/StaticArray<i32>#constructor]
     local.set's value type must be correct, on (local.set $3 (call $~lib/rt/itcms/__new …))
   [wasm-validator error in function ~lib/staticarray/StaticArray<i32>#get:length]
     (ref null $array.0) != i32: binary child types must be equal
   ```

   **This one is tractable**: intercept every call site (`new`, `.length`, `a[i]`,
   `a[i] = v`) so the members are never referenced and therefore never compiled.
   That was built and it works for `a[i]` reads.

2. **`a.length` does not type as `i32` under the mapping.** `return a.length` in a
   function returning `i32` reports `Type '~lib/staticarray/StaticArray<i32>' is not
   assignable to type 'i32'` — the property access yields the *receiver's* type.
   Instrumented `lookupPropertyAccessExpression` and `resolveExpression`'s
   `ElementKind.Property` arm: **neither fires**, so `a.length` is not resolving as
   a property at all on this path. Not localised within the round's budget.

3. **An assignment's value types as the receiver.** `a[0] = 5` as an expression
   reports `Type '~lib/staticarray/StaticArray<i32>' is not assignable to type
   'u32'`.

So the honest statement: **the blocker is a property-access/assignment typing
defect that appears only when a class type maps to an array type, and it is not
localised.** Generic-instantiation identity — the cause the brief names — is
present and working.

## The two routes, as the brief defined them

> **Neither was taken, and neither was needed.** The blocker turned out to be two
> lines in the compiler. This comparison is kept because both routes were
> considered seriously and the measurements behind them are still true.

Provided as requested, with the correction above attached to each.

**Route 1 — give generic instantiations reliable identity in the resolver**
(the `Class`-keyed fix, applied wherever `Type` is used as a class key).

- Sites: the 49 `getClassOrWrapper` calls, plus every place a `Type` is compared or
  used as a `Map` key to reach a class — `types.ts:433` (`classReference`),
  `program.ts`'s `instances` maps, and `ensureClassType`'s cache in `module.ts`.
- **Measured status: not necessary for this defect.** The identity is already
  correct (Q1). This route addresses GC3's shared-`Type` hazard, which was real but
  is already fixed for the type cache; extending it here would be a refactor
  looking for a bug.
- Risk: high. `Type` interning is load-bearing throughout the binder; a
  `Class`-keyed rewrite touches the hottest path in the compiler, and the GC3
  `-O2` abort is the precedent for how quietly a change there can go wrong.

**Route 2 — stop making `String` an `extends StaticArray<u16>`.**

- How much depends on it: **very little code, all of it type identity.**
  `string.ts` declares **31 members** and re-declares every one it shares with
  `StaticArray` — `length`, `at`, `toString`, `indexOf`, `includes` all exist on
  both, and `charCodeAt`/`slice`/`concat` exist only on `String` — over its own
  `#dataStart`-based storage. So the inheritance buys no shared implementation; it
  buys `String`'s membership in the `StaticArray` family, which is what makes
  `s[i]` an index-signature read and what the nine `TypedArray`s also rely on. The
  real weight behind the route is the **238 `dataStart` sites** — `typedarray.ts`
  (126), `array.ts` (46), `dataview.ts` (28), `util/string.ts` (21), `string.ts`
  (3) — which is the linear-memory surface the whole family sits on.
- **Measured status: would not fix the defect either.** Q1 shows `String` was
  never involved once the test was prototype-exact; the failing case is a
  `StaticArray<i32>` receiver.
- Risk: medium — it is a type-hierarchy change in a self-hosted compiler, but it
  does not touch `Type` interning.

**The architect should know that neither route, as described, is on the path to a
fix.** The next step that is actually indicated is to localise why `a.length` does
not resolve as a property when the receiver's `toRef` is an array type — a
~1-hour investigation with the instrumentation above, before any of these routes
is chosen.

## The build assertion (a rule this arc earned)

Twice now a measurement has been read from a **stale `dist/`**: GC5 spent three
runs on a compiler that had failed to build, and GC6 began the same way because a
source file had been reverted by `git checkout` while `dist/` still held the old
output. `npm run build` prints its status and exits non-zero on failure, and
neither was read.

Every measurement in this document was produced through this, so the rule is
mechanical rather than remembered:

```sh
/tmp/build-assert.sh          # exit 1 unless src, cli, web AND dts all report SUCCESS
```

It refuses to measure when the build failed, names the failing stage, and prints
`BUILD OK` otherwise. Verified both ways: a deliberate syntax error in
`src/compiler.ts` made it exit 1 with `✘ [ERROR] Unexpected "="`, and the restored
file made it exit 0.

**It should live in the tree** — `scripts/build-assert.sh`, called by
`test:gc` before it compiles anything — and it does not yet, because this round
does not own `scripts/`. Until then it is `/tmp/build-assert.sh`, and every command
in this document assumes it ran first.

## `StaticArray` results, measured through the compiler

```
probe()                  = 11504     new StaticArray<i32>(4), write index 1, sum ×100 + length
len(makeN(7))            = 7         array.len
managedProbe()           = 1004      StaticArray<Item>, 4 elements, values 1..4
outOfRange()             aborts      "Index out of range", the stdlib's message
outOfRangeWrite()        aborts      the same
```

23 `array.*` operations in the emitted text; `StaticArray<i32>#__uset` and
`#get:length` appear **nowhere** — the class body is unreachable, so unemitted.
`-O0`, `-O1`, `-O2`, `-O3` compile and agree on all six fixtures. Flag off: the
fixture compiles to byte-identical output against the parent commit, and contains
no `array.new`/`array.get`/`array.set`/`array.len` at all.

The **managed-element** case is the one that matters: `a[i] = new Item(i + 1)` puts
a reference into the array with `array.set`, `a[i].v` reads it back with
`array.get` + `struct.get`, and the engine's tracer follows it — proven at the IR
level in GC5 (102 MB of garbage reclaimed at 65,536-byte capacity, moving
collector, null-control trap) and now through the real compiler path.
