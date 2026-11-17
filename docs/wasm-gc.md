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

## Dynamic `Array<T>`: the design is right, the specified mechanism is not

GC8's design — `Array<T>` as `{ <brand>, data: (ref null $arr), length_ }` with
`array.len data` as capacity and 2× growth via `array.copy` — is sound and
unchanged. What follows is why the *specified mechanism* (branch in
`std/assembly/array.ts` on `ASC_WASM_GC`) cannot be built under this round's own
mandatory constraint, with the measurements.

### The gate passes: a constant-conditional `if` does not compile the dead arm

This was the question the round was built around, and the answer is yes.
`ASC_WASM_GC` is registered beside `ASC_RUNTIME` (`src/program.ts`, declared in
`std/assembly/index.d.ts`), so the condition folds and the arm that does not apply
is never compiled. Proven in **both** directions by putting code in the dead arm
that cannot compile under the active flag:

```
$ node bin/tensionscript.js tests/gc/fold.ts --wasmGc   → 0 errors
$ node bin/tensionscript.js tests/gc/fold.ts            → 0 errors
```

The dead arm under `--wasmGc` is `<i32>changetype<usize>(gcClassInstance)`, which is
**AS100** in live code ("a wasm GC reference has no address"); the dead arm with the
flag off is `changetype<Item>(0)`, the linear idiom. Both build. So the *skip*
works, and it is now a regression fixture (`tests/gc/fold.ts`, 2 checks).

One correction worth recording: the first attempt at this test wrote
`declare const ASC_RUNTIME: i32;` in the fixture, which **shadowed the registered
constant**, so the condition did not fold and the dead arm *was* diagnosed. A
`declare` in user code defeats the mechanism; using the global as provided does not.

### The gate is not sufficient: the fold still emits the condition

```
$ cat orig.ts    export function add(a: i32, b: i32): i32 { return a + b; }
$ cat cost.ts    export function add(a: i32, b: i32): i32 {
                   if (ASC_WASM_GC) { return b + a; }
                   return a + b; }
$ node bin/tensionscript.js orig.ts --outFile orig.wasm      # flag off
$ node bin/tensionscript.js cost.ts --outFile cost.wasm      # flag off
```

```
;; orig.wasm  — 4 instructions
  local.get $0 / local.get $1 / i32.add / return

;; cost.wasm  — 6 instructions
  i32.const 0
  drop                       ← the folded condition, emitted then discarded
  local.get $0 / local.get $1 / i32.add / return
```

**Every method wrapped in a flag branch gains `i32.const 0 / drop` in flag-off
output.** `array.ts` is loaded by every program, so this is a flag-off byte change
in the most load-bearing file in the tree — and the round states that flag-off byte
identity is "mandatory, not optional".

### Why the obvious repair is also blocked

Teaching the compiler to elide a constant condition entirely (compile only the taken
arm, emit nothing for the condition) would make the wrapper free. But it is a global
change: it would equally elide the condition in array.ts's **existing**
`ASC_RUNTIME != Runtime.Incremental` branches and in `arraybuffer.ts`,
`staticarray.ts`, `rt/` and every other constant-conditional `if` in the standard
library. Those branches emit the condition today (their `i32.const 0 / i32.eq / if`
shapes are in every program's output), so the repair changes flag-off bytes for
existing programs — the same violation, from the other side. It is a compiler
behaviour change across the whole standard library, not a local edit, and it is not
a decision this round should take alone.

### The shape that is byte-safe, for the next round

Intercepts, not std branches — the mechanism GC7 already built for `StaticArray`:

- The compiler synthesises `Array<T>`'s GC struct (`{ <brand>, data: (ref null
  $arr), length_ }`) from a fixed description, so **no field is added to the TS
  declaration** and flag-off layout is untouched.
- `new Array<T>(n)`, `a.length`, `a[i]`, `a[i] = v`, `push`, `pop` are intercepted
  in `compiler.ts`, each guard-first on `options.wasmGc` (GC7's lesson: an unguarded
  `resolveExpression` moved 14 fixtures). Flag-off output changes by nothing.
- `push` growth is emitted by the compiler: capacity = `array.len data`, 2× with a
  `MIN_SIZE` floor, `array.copy` the old into the new, swap `data`.
- `indexOf`/`slice`/`join` and the rest cannot be intercepted cheaply, because they
  are standard-library method bodies rather than syntax. The byte-safe way to reach
  them is **one intrinsic that exposes the backing array**, e.g.
  `__gcArrayData<T>(arr): StaticArray<T>`, after which the GC arm of those methods
  is ordinary TS over a `StaticArray` — which is already a wasm GC array with
  working `[]`, `.length` and construction.

That is a coherent next round: one intrinsic, the synthesised layout, six
intercepts, then the method bodies in TS. It needs the intrinsic because
`StaticArray` is the only container whose operations are already expressible.

### Status

`ASC_WASM_GC` is registered and folds; `tests/gc/fold.ts` guards it. **`Array<T>`
is not migrated this round**: the specified mechanism conflicts with the mandatory
byte-identity constraint, and the two repairs (std branches, or a global
constant-if elision) each violate it in a different place.

## Dynamic `Array<T>`: a compiler-synthesised layout, no std branching

`Array` grows and the glue has no `array.grow`, so it cannot *be* a wasm array. It
is a small GC struct:

```wat
(type $~lib/array/Array<i32>
  (sub (struct
    (field $<brand> i32)
    (field $data (mut (ref null $~gcarray/i32)))
    (field $length_ (mut i32)))))
```

- **`array.len data` is the capacity. `length_` is the used count.** Capacity is
  never observable (below).
- **Growth is 2× with an `MIN_SIZE` floor (8), via `array.copy`**: allocate the new
  backing array, copy the old elements in, replace `data`. The *struct* is
  unchanged, so the array's identity is stable — the reason `Array` is a struct
  holding a reference rather than a wasm array, since a wasm array cannot grow.
- **`std/assembly/array.ts` is not edited at all.** `git diff --stat` lists
  `src/compiler.ts`, `src/module.ts`, `src/types.ts` and the test file; the stdlib
  file is absent. That is what keeps the flag-off layout identical **by
  construction** rather than by care — the layout exists only in the compiler.

### Capacity is unobservable, and how

Three rules, each with a test in `tests/gc/dynarray.ts`:

1. `.length` reads `length_`, never `array.len` — a fresh `Array<i32>(0)` has
   capacity 8 and length **0**.
2. `a[i]` checks `u32(i) >= u32(length_)`, so an index inside the capacity but past
   the used count **aborts**, exactly as the stdlib's `__get` throws.
3. `a[i] = v` checks the same bound, so a store cannot reach into the spare
   capacity either.

```ts
freshLength()      = 0        // not 8
readPastLength()   aborts     // index 3 of a 1-element array, capacity 8
writePastLength()  aborts     // index 5 of the same
popEmpty()         aborts
```

### The operations covered

| operation | emission |
| --- | --- |
| `new Array<T>(n)` | `struct.new` with `data = array.new(max(n, 8))`, `length_ = n` |
| `a.length` | `struct.get $length_` |
| `a[i]` | `u32(i) >= u32(length_)` → abort, then `array.get data[i]` |
| `a[i] = v` | the same check, then `array.set data[i] v` |
| `a.push(v)` | grow when `length_ == array.len data`, then `array.set`, `length_++` |
| `a.pop()` | empty → abort; else `length_--`, `array.get data[length_]` |

**Not covered, and they will not compile on a GC `Array` yet** (`length` setter,
`shift`, `unshift`, `slice`, `concat`, `indexOf`, `join`, `sort`, `reverse`, `map`,
`filter`, `every`, `find*`, and the static helpers). Each is a stdlib body over
`buffer`/`dataStart`/`load`/`store`; the byte-safe way to reach them is the
intrinsic below, after which their GC arm is ordinary TS over a `StaticArray`.

### Measured through the compiler

```
prim()    = 9904950   100 pushes across several growths, sum 4950, pop → length 99
grown()   = 40040     40 managed elements, every one still the right object
freshLength() = 0     capacity 8, used count 0
```

`-O0`…`-O3` agree on all eight fixtures; flag-off output is byte-identical on all
seven pre-existing ones; `test:compiler` stays at its 5-mismatch baseline.

### Two defects found on the way

- **`Module#select` takes `(ifTrue, ifFalse, condition)` — the condition is last**,
  unlike the WAT text form. Passing it first produced a capacity of 0 and every
  `push` trapped (`array element access out of bounds`). Cost half an hour to find
  because the emitted text looks plausible.
- **`gcElementTypeRef` must test `classReference` before `element.kind`**, because a
  class reference's kind is `Usize`: `StaticArray<Item>` first emitted
  `(array (mut i64))`.

### Still unproven: tracing *after* growth through the compiler

The element-tracing claim for arrays is established at the IR level (GC5: 100,000
allocations, 102 MB reclaimed at 65,536-byte capacity, a moving collector, a
null-control trap), and `grown()` above shows all 40 references survive three
growths. What is **not** yet proven through the compiler path is that those
elements survive a forced *collection* with the array as the only root, because the
harness needs the array to outlive one host call and a module-level
`let root: Array<Item> = new Array<Item>(0)` is rejected:

```
[wasm-validator error in module] global init must have correct type
```

A GC `struct.new` in a global initialiser is not being emitted as a start-function
sequence. That is a small, named gap — not a tracing doubt, since the backing array
is a `(array (mut (ref null $Item)))` and the tracer follows it exactly as GC5
measured — but it is the one test in this round that did not run, and it should.

## Module-scope globals: the site, and the two rules it needed

`const app = new Editor()` is in every app (`apps/editor/src/main.ts:2051`,
`apps/docs/src/main.ts:1335`); four `new AtlasFrame(...)` are in
`examples/2d/stiff-boxes/src/atlas_info.ts:27-30`. A GC `struct.new` is not a wasm
global's init expression, so such a global must be zeroed and assigned in the start
function.

**That machinery already existed** — `compileGlobal`'s `initializeInStart` path
(`src/compiler.ts:1588`) handles every non-constant initialiser, because
`const x = someCall()` works in linear mode. Two things were wrong on the GC path:

1. **The zero was `i32(0)`.** `module.addGlobal(…, this.makeZero(internalType))`
   answers an `i32` constant for a class — right under the pointer ABI, where a
   class *is* an `i32`; wrong for a `(ref null $C)`:

   ```
   [wasm-validator error in module] global init must have correct type
   (i32.const 0) (on global app)
   ```

   `makeFieldZero` (which GC3 introduced for struct fields) answers `ref.null` for a
   GC reference. One word changed.

2. **The guest collector visited them.** `compileVisitGlobals` read every managed
   global and handed it to `__visit` as an `i32`:

   ```
   [wasm-validator error in function ~lib/rt/__visit_globals]
     i32 != (ref null $struct.0): global.get must have right type
   ```

   A GC global is now skipped there. That is not an omission: `__visit_globals` is
   precisely the guest scanner this migration replaces, and the engine traces what
   it cannot see.

The emitted start sequence for `const GROUND = new Frame(0, 768)`:

```wat
(global $…/GROUND (mut (ref null $…/Frame)) (ref.null none))
(func $start:… 
  ref.null none            ;; `this`
  i32.const 0  i32.const 768
  call $…/Frame#constructor
  global.set $…/GROUND)
```

### The ABI must not mix, and how that is enforced

A pointer-shaped class stores a field at a byte offset as an `i32`; a GC struct
stores the same field as a `(ref null $C)`. A program holding both aborts inside
Binaryen — `Aborted(Assertion failed: isBasic() && "Basic type expected")`,
`wasm-type.h` — which is the worst failure mode there is: a crash with no
diagnostic. Measured on a `main.ts`-shaped file where `Editor` carries a `String`
field and another class does not.

Two layers, cheapest first:

- **Eligibility is checked per class**: every field must be a value type or a GC
  struct, and the declared base chain must be GC-usable. A class with a `String`
  field is simply not a GC struct — the same "unsupported means unchanged" rule
  `StaticArray`'s element check uses.
- **A program-level latch** (`gcUniform`) demands that *every* declared class be
  eligible before any of them is a GC struct, so one `String` field keeps the whole
  program on the pointer ABI — which is exactly what it does today.
- **A hard check** (`gcMixedAbiReferrer`) refuses a GC struct that a pointer-shaped
  class holds a field of, by name, both classes in the message. That is the
  guarantee: the latch is best-effort (it scans the classes resolved at that
  moment), the diagnostic is not, and no mixed-ABI module can be produced.

**What this means for a real program**: `examples/2d/stiff-boxes/src/atlas_info.ts`
— the smallest of the eight sites — compiles and runs under the flag (verified).
A `main.ts`-shaped file (`const app = new Editor()`, where `Editor` has `String`
fields) also compiles, on the pointer ABI. **No real app gets GC classes yet**,
because every one of them has a `String` somewhere; the flag is a fixture-scale
feature until `String` migrates. That is the honest state.

## Traced after growth — now measured through the compiler

`/tmp/gc8r` (wasmtime 50.0.1, `Store::gc`). A module-level
`let root: Array<Item> = new Array<Item>(0)` is filled with 40 `Item`s (three 2×
growths), then collected:

```
A: no forced collection            total=820 count=40
B: 5 collections after growth      total=820 count=40
C: gc + 100000x1KiB garbage + gc   total=820 count=40 capacity=65536
D: same, moving collector          total=820 count=40
E: control, root cleared after fill  total=0
verdict: elements after growth ARE traced
```

820 is `1+…+40`. C is the load-bearing line: 102 MB allocated and reclaimed while
heap capacity stayed at 65,536 bytes, with the elements still correct — so the
collector ran and the grown array's elements survived it. D repeats it under a
**moving** collector, where a stale `data` field or a mistyped element would leave
a reference pointing at the old arena. E proves `total` really reads through the
global rather than returning a cached number.

## `Array` operations covered

`new`, `.length` get, **`.length` set** (grows to `max(n, cap<<1, MIN_SIZE)` in one
allocation, or truncates by moving `length_` alone), `a[i]`, `a[i] = v`, `push`,
`pop`.

**Remaining**: `shift`, `unshift`, `slice`, `indexOf`, `join`, `concat`, then
`sort`/`reverse`/`map`/`filter` (a separate pass, out of scope). The `__gcArrayData`
intrinsic was **not** built this round — `length`'s setter turned out to need the
same growth sequence `push` already emits, so interception was cheaper than an
intrinsic for it; the remaining methods are the ones that genuinely want the
intrinsic, because they are stdlib bodies rather than syntax.

## `String` is a wasm GC array, and with it every real program becomes GC-uniform

`String extends StaticArray<u16>` and `StaticArray` had already become an
`(array (mut T))`, so the storage half was done. What was left was the
representation of a *literal* and the method bodies that assumed a pointer.

### The literal: option (b), chosen on two numbers

**(a) `array.new_data`** — the natural first choice, and it is **unreachable in this
glue**. `_BinaryenArrayNewData` exists, but it asserts `heapType.isData()` and what
it wants is a *passive data segment of the packed element type*; this glue exports
`_BinaryenTypeInt32/Int64/Float32/Float64` and no `Int16`, so a `u16` segment cannot
be typed, and one array would also be materialised per *use site* rather than per
literal.

**(b) decode once in `__start`** — one global `(ref null $~gcarray/u16)` per
distinct literal, filled from the (already deduplicated) data segment at startup.
Measured on a fixture with 3 distinct literals and 1 repeat: the flag-off baseline
is **240 bytes with 3 data segments** (the repeat already deduplicates), and the
GC build is **one global and one build per distinct literal**, 4 globals for 4
distinct strings and 3 for 3. Startup work is proportional to total literal
characters, paid once, and a repeat costs nothing.

The flip side is ordering, and it cost a real bug: a module-scope
`const E: string = "…"` becomes a *start-function assignment* of
`global.get(~gcstr/N)`, so the literal's global must be built **before** the
initialiser that reads it. Emitting the builds last (which is where they are
collected) assigned the constant `ref.null`, and the first use dereferenced a null
pointer. They are now unshifted to the front of `__start`.

### Element width: packed `i16`, not `i32`

`gcElementTypeRef` answers `i32` for every sub-word integer, so packedness is the
only thing that separates a `u16` array from an `i32` array — and without it
`String` and `StaticArray<i32>` canonicalise into **one type**. Two consequences,
both real: four bytes per character instead of two, and a `String` that is
structurally a `StaticArray<i32>`. `gcElementPackedType` now passes
`PackedType.I16`/`I8` for the sub-word kinds.

### The comparison surface, replaced at one chokepoint

`compareImpl` is behind `==`, `!=`, `<`, `>`, `startsWith`, `endsWith`, `indexOf`
and `includes` — every one of them. Its body walks
`changetype<usize>(str) + i` with `load<u16>`, which a wasm array does not have. So
the **call** is replaced (`makeCallDirect`) with an inline `array.get` loop of the
same contract: first differing pair answers `a - b`, else `0`, and a zero length
never dereferences.

The same intercept point carries the four leaf `@operator` statics. `__eq` and
`__not` both begin `changetype<usize>(x) == 0`, and a reference is not an `i32`;
identity becomes `ref.eq`, the null test becomes `ref.is_null`, and the rest is
`array.len` plus the loop. `__ne`, `__gte` and `__lte` are one-line wrappers, so
their own bodies compile unchanged and reach the replacements by call.

**`makeCallDirect`, not `compileCallExpression`, and the difference mattered:**
`a == b` is lowered by `compileCommutativeBinaryOverload`, which calls
`makeCallDirect` directly. An intercept in `compileCallExpression` never fires for
an operator.

Two mistakes in this emission are worth recording because both were silent:

- **`module.return` inside the replacement returns from the *caller*.** Correct
  only when the comparison is the caller's whole body, and a wrong answer
  otherwise. Every early exit is now a `br` carrying its value to a block typed
  `i32`. (A `br_if` with a value is not usable for this: Binaryen gives it the
  value's type, so a non-final one must be dropped — hence `if (cond) br $out`.)
- **The early return also skipped the `currentType` assignment** `makeCallDirect`
  would have made, so `a == b` resolved as `String` and the enclosing `return`
  reported "not assignable to bool". `currentType` is set explicitly now.

And one that `-O0` could not see, the same shape as GC4's re-used
`ExpressionRef`: the literal builder handed **one** `i32.const ptr` node to every
`load` in a literal's character loop. Binaryen's IR is a tree, so the shared child
left the optimizer with one parent pointer for many nodes; at **-O1 and above**
every `offset=2i` collapsed to `offset=0`, every literal read as its first
character repeated, and every string compared equal. `-O0` was correct throughout.
A fresh pointer expression per load fixes it, and the `-O0..-O3` gate is what
caught it.

### The eligibility flip, and the three things it uncovered

A `String` field used to make a class ineligible, and `gcUniform` is all-or-nothing
— so one string anywhere put the **whole module** back on the pointer ABI, which is
exactly where the parked-frame problem lives. A `String` field is now supported as
an array reference, and a `class Label { text: string; n: i32 }` is a GC struct with
a `(ref null $~gcarray/u16)` field.

Three defects only a real class could expose, in the order they appeared:

1. **`gcFieldTypeRef` had no `String` case** and hit its own
   `assert(false)` — "unsupported field kind" — crashing the compiler on
   `class App { name: string }` instead of emitting it.
2. **`~lib/rt/__visit_globals` read every class-typed global as an `i32`.** It
   already skipped `isGcClass` globals, but `isGcClass` is *false for the standard
   library by design*, so a string global slipped through and produced
   `i32 != (ref null $array.0): global.get must have right type`. The skip is now
   keyed on the type (`gcStringOf`), not on the class being migrated.
3. **`makeAbort` zeroed its message with `makeZero`,** which answers `i32(0)` for a
   class — so every `abort`/`assert` in the stdlib passed a pointer-shaped zero into
   a now-reference-typed parameter. `makeFieldZero` (the GC10 fix, applied in the
   same place) resolves it.

Together these mean `std/assembly/util/error.ts` compiles under the flag at all,
which it previously did not: its `@lazy @inline export const E_X: string = "…"`
messages cannot be inline constants when a literal is an object built in `__start`.
The `@inline` is dropped for GC reference globals (with the existing warning), so
the global becomes an ordinary one; flag-off keeps the diagnostic.

### Operations covered

`length` (`array.len`), `charCodeAt`, `at`, `charAt` (a fresh one-character array),
`concat` (and therefore `+`), `==`, `!=`, `<`, `>`, `<=`, `>=`, `startsWith`,
`endsWith`, `indexOf`, `includes` — the last four through the `compareImpl`
replacement.

**Remaining**: everything that *allocates a new string* through the guest allocator
— `slice`, `substring`, `replace`, `split`, `trim`, `padStart`, `toUpperCase`,
`parseInt`, `format`. Measured: `"hello".substring(1, 4)` fails validation with
`~(local.set $21 (call $~lib/rt/itcms/__new …))` — the body allocates through
`__new` and stores the result into a GC-ref local. These need the allocation path,
not a comparison, and that is the next slice.

**Hashing** is not migrated: `std/assembly/util/hash.ts`'s `hashStr` does
`changetype<usize>(key)` and `load<u32>(pos)`, so it keeps a pointer-ABI dependency
alive for any program that instantiates a `Map` with string keys. It is dead code
unless a `Map` is used, so it does not block today; it will block `Map`.

### Result

`test:gc` 101 → **132 checks**, `-O0..-O3` agree on every fixture including the
string ones, `test:compiler` stays at its 5 pre-existing mismatches, and the flag-off
output is **byte-identical on all 11 fixtures** (verified by compiling each with a
`dist/` built from `src/` reverted, then with the current one). No file under
`std/assembly` was touched.

## The re-used `ExpressionRef` guard: three occurrences, then a mechanism

Binaryen's IR is a **tree** — an `ExpressionRef` is owned by exactly one parent —
and handing one node to two parents does not fail at construction. It produces a
graph the optimizer cannot walk, whose symptom is a *correct* `-O0` build and a
wrong `-O1` one. That is how this defect got past three rounds:

- GC3: one `struct.get` used as several `i32.eq` operands,
- GC4: a re-used operand in an `if`,
- GC11: one `i32.const ptr` handed to every `load` of a literal's characters, which
  let `-O1` fold every `offset=2i` to `offset=0` and made every string compare equal.

Each was found by the `-O0..-O3` gate. Three occurrences say the mechanism should
catch it. It now does, at the site, with both locations named:

```
re-used ExpressionRef: the i32(32) node (produced at 748) was handed to
'load.ptr  [at n.load (module.ts:1894) <- at n.emitGcStringBuilds (compiler.ts:3013)]'
and then to 'load.ptr at 760  [at n.load … <- at n.emitGcStringBuilds …]'
```

**Where it lives.** `src/module.ts`, beside the `Module` wrapper for Binaryen's C
API: `guardProduce` records a ref a *producer* made, `guardRef` takes it as an
operand and aborts on a second taking. There is no need to know which C functions
return expressions, because a producer announces itself. The JS-side breadcrumb
(`_TensionRefGuardHint` in `src/glue/binaryen.js`) supplies the stack, since
`module.ts` is compiled.

**Scope — and the two measurements that set it.** A check over the whole
population is wrong here, and both reasons were measured rather than assumed:

1. `compileStatements` (`compiler.ts:3414`) **unwraps an unnamed block and
   re-parents its children** into the enclosing list. So a child of a block is
   consumed again, legitimately, as soon as the block is discarded — a bare `for`
   loop does exactly this with its own initialiser, with the flag **off**.
2. A **pass** transforms the tree and re-parents nodes by design
   (`passes/shadowstack.ts:676` moves a `return`'s operand into a `local.set`).

So the guard tracks only what the three defects actually shared — the **GC
builders** (`struct.*`, `array.*`, `ref.*`) and the **constants** (`i32`/`i64`/
`f32`/`f64`) — checks every consumer, adds a duplicate-child check inside `block`
(which re-parenting cannot explain), and suspends itself around `runPasses` and
around a `Pass`'s subtree walk (`suspendRefGuard`/`resumeRefGuard`).

**Cost when disabled:** two null tests per node. Measured on
`tests/gc/dynarray.ts` at three runs each: **857/860/904 ms** without the guard
(a `dist/` built from the previous commit) against **842/874/875 ms** with the
guard present and off — indistinguishable.

**Demonstration.** The GC11 defect was reintroduced verbatim (one `i32.const ptr`
shared by every `load` in a literal's character loop), the build asserted, and the
string fixture compiled with `TENSION_REF_GUARD=1`: the abort above is that run.
Reverted immediately; the fixture now compiles clean, and check 27 in
`tests/gc/wasm-gc.js` asserts the guard is silent on all ten GC fixtures.

## The allocation route: `__new` for a GC type

### The scope, measured

`grep -rn "__new(" std/assembly` → **72 sites** (the declaration in
`rt/index.d.ts` excluded), classified by the *id* argument:

- **47 `idof<String>` / `idof<string>`** — a variable-length character buffer.
- **4 `idof<StaticArray<T>>`** — a variable-length element buffer.
- **8 `idof<ArrayBuffer>`** — a variable-length byte buffer, still linear memory
  (out of scope until `ArrayBuffer` migrates).
- **13 with a variable id** (`__, id`, `idof<TArray>()`) — the runtime helpers
  (`__newBuffer`, `__newArray`) and the `TypedArray` generics, where the type is
  not written at the call.

Per file: `string.ts` 28, `util/number.ts` 15, `typedarray.ts` 6, `staticarray.ts`
4, `util/string.ts` 4, `array.ts` 3, `arraybuffer.ts` 3, `util/uri.ts` 2, plus the
runtime's own 5.

So **51 of 72** are the GC-array shape, and the other 21 are either linear memory
or type-erased.

### The mechanism, and why the alternatives were worse

**The compiler lowers `__new(size, idof<T>())` itself** when `T` is a GC array
type: `array.new $t (size >> log2(elemSize)) (zero)`, and `changetype<String>(…)`
around it becomes the identity because both sides are `(ref null $~gcarray/u16)`.

- **vs a typed intrinsic `__gcNew<T>(len)`:** the intrinsic is fine, but *nothing
  calls it*. `std/assembly` writes `__new` 72 times; an intrinsic means 72 call-site
  edits plus a helper that has to exist in both ABIs — and flag-off byte identity
  then rests on my care in 51 places instead of on the mechanism. Zero std edits
  beat a smaller diff.
- **vs rewriting the stdlib constructors onto a dual-ABI helper:** the same 72
  edits with more new surface.
- **vs intercepting `changetype<T>(__new(...))`:** misses the two
  `let dst = __new(...)` sites (`util/uri.ts:45,141`) that hold the result in a
  `usize` first, and puts the type logic in two places.

**Why the `idof<T>()` argument is the safe key.** `T` is written literally at the
site, so this is a compile-time type in the source — not GC6's runtime-`Type`-keyed
lookup, where every reference type is `usize` and two generic instantiations are
indistinguishable. Here there is no lookup at all: the node *is* the type argument.

**The size arithmetic is not pattern-matched.** The element count is emitted as
`size >> log2`, a runtime shift on the already-computed byte size. So a site that
over-allocates (`__new(len * 2 * 2, …)` for surrogate pairs, `string.ts:528`) is
handled correctly without knowing why it asks for twice as much.

### The second half: `memory.copy` over two arrays

Allocation alone is not enough — the next line of `substring` is
`memory.copy(changetype<usize>(out), changetype<usize>(this) + fromPos, size)`, a
byte address on both sides. The operands are recognised as
`changetype<usize>(x) [+ byteOffset]` where `x` resolves to a GC array, and the
copy becomes `array.copy` with the byte offsets and the length shifted down to
element indices. Recognising this shape cannot misread valid code, because
`changetype<usize>(aRef)` is itself an error under the flag.

Emitted shape for `String#substring`:

```
(func $~lib/string/String#substring (type $2)
  (param $0 (ref null $~gcarray/u16)) (param $1 i32) (param $2 i32)
  (result (ref null $~gcarray/u16))
  local.get $0
  array.len                 ;; `length` is array.len, not a header read
  ...
  i32.const 1
  i32.shr_u                 ;; bytes -> characters
  array.new $~gcarray/u16
  ...
  local.get $16
  i32.const 1
  i32.shr_u                 ;; fromPos >> 1
  local.get $20
  i32.const 1
  i32.shr_u                 ;; size >> 1
  array.copy $~gcarray/u16 $~gcarray/u16
```

`grep -c "call \$~lib/rt/itcms/__new"` on the fixture: **0**. `array.copy`: 3
(`substring`, `slice`, `substr`). `array.new $~gcarray/u16`: 12 (literals plus
allocations).

### A silent wrong answer, found by the change

`changetype<usize>(x)` was refused for a **class** instance but not for a GC
**array** — `isGcClass` answers false for everything under `~lib/` by design
(GC10), so `String` and `StaticArray<T>` fell straight through. Measured
consequence: `"aaa".replaceAll("a", "bb")` — which builds
`changetype<usize>(out)` inside `__renew` — **compiled and answered 4 characters
instead of 6**. That is worse than a diagnostic, and it is now one:

```
Not implemented: changetype<usize> of a wasm GC array (String): a wasm GC
reference has no address, so it cannot become an integer or a pointer.
```

The `| null` form mattered: `String | null` carries no `classReference`, so the
predicates answer false for exactly the local `replaceAll` declares
(`let out: String | null`) — the first version of the check missed it and the wrong
answer survived. It tests `type.nonNullableType` now.

### What works, and what remains

**Now compiling and correct** (values asserted, `-O0..-O3` agreeing):
`substring`, `slice`, `substr`, plus the already-intercepted `length`,
`charCodeAt`, `at`, `charAt`, `concat`, `==`/`!=`/`<`/`>`/`<=`/`>=`, `startsWith`,
`endsWith`, `indexOf`, `includes`.

**Remaining**, with the reason each fails:

- `trim`, `toUpperCase`, `padStart`, `padEnd`, `repeat` — bodies read the buffer
  with `load<u16>(changetype<usize>(this) + k)`. They need the *read* side of the
  same idiom (`load` over an array), not the allocation side.
- `replaceAll`, `split` — `replaceAll` reallocates with `__renew(ptr, size)`, which
  is a pointer API with no array equivalent (`array.grow` does not exist in this
  glue); `split` needs `Array<T>` and an array of strings.
- `replace` (single, first occurrence) already works: it is `slice` + `concat`.
- `parseInt`/`format`/`toString` on numbers — `util/number.ts` writes into a
  `String` buffer with `store<u16>`, the write side of the same idiom.

### Hashing: the allocation route does not answer it

`util/hash.ts:71 hashStr` is **not** an allocation problem. It reads
`load<u32>(pos)` at a raw address in a 16-byte unrolled loop — the *read* side. The
allocation route is silent on it, and the new `changetype<usize>` diagnostic is
what makes that visible rather than accidental: instantiating `Map<string, i32>`
under the flag now fails with the diagnostic pointing at `hash.ts:72` and `:76`.

It needs its own decision, and the decision is not "port `hashStr`": an
`(array (mut u16))` is *packed `i16`*, so a `load<u32>` is two `array.get`s plus a
shift-and-or, and the XXH32 fast path's 16-byte unrolled block reads become eight
element reads. The two candidates are (a) generalise the `changetype<usize>(ref)+k`
recogniser from `memory.copy` to `load`/`store`, so the stdlib's own arithmetic
keeps working, or (b) give `hashStr` a GC arm over `array.get`. That is a
round-sized question, not a line, and it belongs with `Map`.

### Result

`test:gc` 132 → **168 checks**, `-O0..-O3` agree on every fixture, `test:compiler`
stays at its 5 pre-existing mismatches, flag-off output **byte-identical on all 13
fixtures**, and **no file under `std/assembly` was touched** — the mechanism is
entirely compiler-side.

## A real guest, measured: 0 of 19 examples compile, and the work list behind that

Every round so far fixed what the *fixtures* needed. This section is the other
question — what does a real program need — measured by compiling every Tension
example with this compiler, with and without the flag.

Method: `/tmp/gc13-compile.mjs`, which runs the same command each example's own
`package.json` build script runs (`tensionscript <entry> --config <asconfig>`),
adds `--wasmGc`, and writes to `/tmp` so the Tension tree stays clean.

**Baseline: 19 of 19 compile.** Every failure below is therefore attributable to
the flag, not to a stale pin or a missing generated file.

| | compiles |
|---|---|
| baseline (no flag) | **19 / 19** |
| `--wasmGc` | **0 / 19** |

That is the headline: `--wasmGc` currently makes every real program in this repo
fail to compile.

### The wall: 19 of 19, one message

Eighteen of the nineteen stop at GC10's mixed-ABI refusal:

```
~lib/array/Array<~lib/tension-framework/assembly/ui/fonts/FontPage> is a wasm GC
struct but ~lib/tension-framework/assembly/ui/fonts/FontBook holds a field of its
type and is not one: a pointer-shaped class cannot reference a GC struct.
```

The mechanism is working exactly as designed — a mixed module must not be emitted —
but the *policy* under it is self-contradictory, and this is the round's central
finding:

- `isGcClass` makes **`Array<T>` a GC struct unconditionally** under the flag
  (the GC9 exception to its `~lib/` exclusion).
- `gcUniform` **skips every `~lib/` class** when deciding whether the program is
  eligible, on the assumption that `~lib/` classes are all pointer-shaped and never
  hold a GC struct.
- That assumption stopped being true the moment `Array` became one. Framework
  classes are compiled with `~lib/` prefixes, so *every framework class that holds
  an `Array`* is a crossing the latch cannot see — and the refusal is the only thing
  that catches it, by failing the build.

So the flag is unusable on any program with a `class Foo { items: Array<Bar> }`,
which is every real program.

### Behind the wall: 36 sites, measured with the refusal temporarily off

To size the rest, the refusal was disabled in a scratch build (reverted; the tree
carries no trace), and all 19 examples re-compiled. **40 distinct blocker sites**,
**320 error occurrences** — an inlined body reports once per instantiation, which is
why the error count is 8× the site count.

Sites by how many examples hit them:

- **7 sites, 16 of 18 examples** — the universal set: `array.ts:131`
  (`ensureCapacity(changetype<usize>(this), …)`), `array.ts:136` (`__link`),
  `map.ts:243`/`:249` (`changetype<usize>(entry.key/value)`), `string.ts:672`,
  `:673` (`changetype<OBJECT>(changetype<usize>(str) - TOTAL_OVERHEAD).rtSize`) and
  `:699` (`encodeUnsafe(changetype<usize>(str), …)`).
- **7 sites, 12 examples** — `util/number.ts` number formatting (`utoa*_core(p, …)`,
  `store<u16>`, the `HEX_DIGITS`/`ANY_DIGITS` LUTs).
- **2 sites, 9 examples** — `string.ts:772`/`:807`, the UTF8 decode/`__renew` pair.
- **2 sites, 7 examples** — `staticarray.ts:392`/`:393`, the linear header read.
- **1 site, 5 examples** — `number.ts:759` (`memory.copy(changetype<usize>(result), dtoa_buf, size)`).
- The rest (2–1 examples): Map internals, `hash.ts`, `src/main.ts`,
  `tension-framework/…/text.ts` (two `String.UTF8.encodeUnsafe` calls).

### Classified by shape, not by message

Every one of the 40 is the same root cause — **`changetype<usize>(aRef)` used as a
byte address inside a standard-library body** — so the useful classification is what
the address is used *for*, because that is what each fix costs:

- **13 sites — the address is passed to a helper** (`encodeUnsafe(p, …)`,
  `utoa32_dec_core(p, …)`, `utoa64_any_core(p, …)`). The helper's *parameter* is a
  byte pointer into a buffer. Fixing these means re-typing those helpers to take an
  array plus an offset, i.e. migrating the function, not the call site.
- **5 sites — address arithmetic passed on** (`hash.ts:97,104`, `number.ts:384,388,393`).
- **4 sites — `changetype<usize>(x) == 0` as a null test** (`hash.ts:72`,
  `string.ts:1014,1021,1040`).
- **4 sites — the address is stored in a local, then used** (`hash.ts:76`,
  `string.ts:672,677`, `map.ts:243,249`). These need the load/store generalisation
  *and* a type for the local, which is a representation question.
- **2 sites — the linear header read** (`rtSize` via `TOTAL_OVERHEAD`).
- **1 site each** — `__renew`, `memory.copy` of a non-array, `load/store` at a raw
  address, two LUT constants.
- **4 sites — the collector interface** (`__link`, `__visit_members`). Fixed this
  round; see below.

**The `load`/`store` generalisation the brief expected to be the win is one site.**
That is worth recording plainly: recognising `load<u16>(changetype<usize>(s) + k)` as
`array.get` is a real and cheap improvement, and it would have removed **1** of the
40. The dominant need is not reading a buffer in a loop; it is **passing a buffer to
a stdlib helper that speaks pointers**.

### What was fixed, and the measured effect

1. **Element writes on a GC array through compound operators and in/decrement.**
   Four separate places decide a store — `compileAssignment`, the binary compounds,
   the postfix operators, the prefix operators — and only the first had the GC arm.
   So `a[i] += v`, `a[i]++` and `--a[i]` resolved `Array#__set`, whose body is
   `ensureCapacity(changetype<usize>(this), …)`. 16 sites across three arms, a real
   defect; `tests/gc/elemwrite.ts` is the regression (8 values asserted).
   **Measured effect on the examples: none.** `array.ts:131` is still in 16 of 18,
   so it is reached by a route this arm does not cover. The fix is right and the
   fixture proves it; the claim that it was the examples' blocker would have been
   wrong, and the comment in the code says so.
2. **The collector's bookkeeping lowers to nothing.** `__link`, `__pin`, `__unpin`
   and `__visit_members` maintain the guest collector's remembered set, pins and
   typeinfo walk — precisely what engine tracing replaces. They are emitted as
   `nop`, with their operands **not compiled** (every one is a
   `changetype<usize>(…)` of a reference, and they are pure bookkeeping). Measured:
   **40 → 36 distinct sites**, `array.ts:136` and `map.ts:116/133/137` gone.
3. **`if (nullableRef)` is truthiness.** A class or array type's `kind` is `Usize`,
   so a `String | null` condition reached `makeIsTrueish`'s `Usize` arm and was
   answered as the expression itself — correct for the pointer ABI, a ref-typed
   condition under GC. Measured: it crashed the **compiler** with `AssertionError`
   in `evaluateCondition` on `if (out)`, the shape `String#replaceAll` uses.
   `tests/gc/truthiness.ts` covers it. This is also the `replaceAll` outcome asked
   for: the assert is gone.
4. **One predicate, `isGcReferenceType`.** It was needed in four places that must
   agree (the `null` literal, `makeFieldZero`, a struct field's type ref, and
   truthiness) and four hand-written copies is how the `String` case was missed in
   three of them. `String | null` carrying no `classReference` — the GC12 finding —
   is why it tests `nonNullableType`.

### `examples/ai` fails differently, and it is a distinct cause

`AssertionError` in `writeStaticBuffer`, from `compileArrayLiteral` →
`addStaticBuffer`: a static array **literal** (`const X: u8[] = [...]`) is written
into a data segment, and its element type has no `staticGcObjectOffsets` entry. Under
the flag it needs the same treatment string literals got in GC11 — build the array in
`__start` rather than point at a segment. Not attempted this round; named so it is
not rediscovered.

### The remaining-work list, replacing the estimate

Ordered by (examples blocked ÷ effort). Effort is a judgement; the counts are not.

1. **Decide `Array`'s GC-ness vs. non-uniform programs** — blocks **19/19**.
   Not a bug fix, a policy decision, so it is recorded rather than taken. The two
   routes:
   - **Keep `Array` unconditional and migrate the framework.** Every `~lib/` class
     that holds an `Array` must itself become a GC struct, transitively. The
     framework has 111 classes (GC2's count); the closure size is unmeasured, and
     measuring it is the next round's first task if this route is chosen.
   - **Make `Array`'s GC-ness follow the program.** `Array` is a GC struct only when
     the program could be uniform — which means `gcUniform` must stop skipping
     `~lib/` classes that hold GC-typed fields. The consequence: on a real program
     `--wasmGc` becomes a **no-op that compiles** rather than a build failure. That
     is safer, and it means the flag's success is no longer evidence of GC.
2. **The buffer-pointer API in `std/assembly`** — blocks 16/18, ~19 sites.
   `encodeUnsafe`, `decodeUnsafe`, `utoa*_core`, `dtoa*`, `hashStr`. These take a
   `usize` address into a buffer. The honest fix is to give them an array-plus-offset
   form in GC mode, which is a stdlib API change (not a compiler one) and the largest
   single item in the migration.
3. **`local`-held addresses and header reads** — 4 sites, blocks 16/18.
   `let pos = changetype<usize>(x)` then `load`/`store`, and
   `changetype<OBJECT>(changetype<usize>(this) - TOTAL_OVERHEAD).rtSize`. The second
   is `array.len` in disguise and may be cheaper than it looks.
4. **`memory.copy` / `__renew` of a GC array** — 2 sites, blocks 6/18.
   `array.copy` covers the copy; `__renew` has no array equivalent in this glue
   (`array.grow` does not exist), so a `String#replaceAll` needs the two-object
   design `Array` already uses.
5. **The null test `changetype<usize>(x) == 0`** — 4 sites, blocks 2/18. Cheapest
   remaining recogniser; deferred because it unblocks no example on its own.
6. **Static array literals** — blocks 1/18 (`examples/ai`), plus every
   `const LUT: u16[] = [...]` in the stdlib.

### Result

`test:gc` 168 → **181 checks** (three new sections: element writes, collector
bookkeeping, truthiness), `-O0..-O3` agree on every fixture, `test:compiler` stays
at its 5 pre-existing mismatches, flag-off output **byte-identical on all 13
pre-existing fixtures**, and **no file under `std/assembly` was touched** — every
change is compiler-side. One commit: the triage and the fixes are the same work,
because the measurement is what justified the fixes.

## The latch, the fixed point, and a report that cannot lie

GC13 ended on an unusable flag: 0 of 19 real examples compiled under `--wasmGc`,
and the refusal that stopped them was a *policy* contradiction rather than a missing
feature. `isGcClass` made `Array<T>` a GC struct unconditionally, while `gcUniform`
skipped every `~lib/`-mounted class when deciding whether the program could use the
GC ABI — and a framework class is exactly such a class. So the latch could not see
the crossing that every real program creates.

Two things had to change, and they are separable.

### `~lib/` is not "the standard library"

`~lib/` means "parsed from a library root". It is true of `std/assembly`, of this
repo's own `tension-framework`, and of every `node_modules` dependency. Reading it as
"standard library" made 111 framework classes invisible to the latch.

The test is now the **path shape** (`isStdlibPath`): after `~lib/`, no slash — or one
of `bindings`, `rt`, `shared`, `util` — means std. A path, not a class's internal
name: `~lib/string/TemplateStringsArray` is a class named `TemplateStringsArray`
*declared in* `string.ts`, and reading the internal name as a path made `string` look
like a package directory (measured: it manufactured a `TemplateStringsArray`/`Array`
crossing in a fixture that has no template literal). `program.stdSources` is checked
first, because the CLI marks it at the two std parse sites.

### The latch is a fixed point, and `Array` is its variable

`Array`'s representation is program-wide: a dynamic array is a compiler-synthesised
GC struct when the program is uniform, and a linear-memory block otherwise. So write
`A` for "`Array` is a GC struct" and `U(A)` for "every managed class is eligible
given `A`":

- a class with an `Array<T>` field has a `(ref null $Array)` field when `A`, and an
  unstorable pointer-shaped class reference when `¬A` — so `U` is **monotone**:
  `U(A) ⟹ U(¬A)`;
- a monotone predicate on a two-point lattice has a greatest fixed point, and it is
  `U(A)`. If the program can be uniform at all, it can be uniform with `Array`
  migrated.

So the rule is `A` iff `U(A)`, computed optimistically: `isGcEligible` answers `true`
for `Array` unbounded, and then every class's consequences are checked through
`gcStructFieldsSupported`'s recursion into its fields. `Array`'s eligibility is not
*assumed*; it is the assumption whose consequences are verified.

**Frozen, not lazily discovered.** The compiler resolves every non-generic managed
class before emitting anything (`prepareGcLatch`), because a type emitted as
`(ref null $C)` cannot be re-decided afterwards. Measured before the freeze:
`hello-sprites` registered its string-literal globals with the latch
optimistic-`true`, a class found later made the program non-uniform, and
`emitGcStringBuilds` aborted inside Binaryen with `Assertion failed: isRef()` — a
crash with no location. A generic instance discovered afterwards can still turn out
ineligible; that is not a crash and not a mixed module, because `isGcClass` checks
per-class eligibility after the latch, so such a class is pointer-shaped and any GC
class referring to it is refused by name.

**Tested as a fixed point, not as an order.** `tests/gc/ordering-late.ts` types an
`Array<i32>` at module scope *before* the class that turns out ineligible exists;
`ordering-early.ts` swaps them. Both must report the identical coverage line — and
they do (`0 of 1 managed class`, `1 holding a TypedArray`), which is what makes the
answer independent of source order.

### When the latch is off, the flag is inert rather than broken

Every behavioural gate on `--wasmGc` goes through `Compiler#gcActive`
(`options.wasmGc && gcUniform(program)`), and the three representation predicates
(`gcStringOf`, `gcArrayElementOf`, `gcDynamicArrayElementOf`) answer "pointer" when
the latch is off. So a non-uniform program keeps the **pointer representation** by
the mechanism, rather than by 14 separate checks. That matters beyond tidiness: the
flag's other effect is to drop the shadow stack, which is the pointer ABI's only root
set for a moving collector, so a half-applied flag would be a module with no root set
at all. `module.useShadowStack` is put back explicitly for that reason.

**"The pointer representation", not "byte-identical to a flag-off build", and the
difference is measured rather than assumed.** `prepareGcLatch` resolves every declared
managed class so it can read their fields, and a resolved class gets its `~visit`
function emitted. On `examples/2d/hello-sprites`: **180,791 bytes** under the flag
against **178,582** without it, and three `~visit` functions the flag-off build does
not emit (`Map<string,Frame>`, `AnimationSeries`, `Array<u8>`). They are unreachable —
nothing else differs, and the module carries no `(struct …)` type — so this is dead
code rather than a behaviour change. Suppressing visitor emission for classes resolved
only by the latch is a named TODO: a latch that cannot read fields cannot decide
anything, so the resolution cannot simply be skipped.

### The report is gated on the flag, not on the latch

The first version called `reportGcCoverage()` inside `if (this.gcActive)` — which is
false in exactly the case the report exists to explain. Measured on
`examples/2d/hello-sprites`:

```
WARNING TS6414: wasm-gc: no class migrated - 0 of 141 managed classes on the GC ABI
- the program is not uniform: 16 holding a TypedArray, 1 holding an ArrayBuffer,
1 extending a class that is not GC (TaskState), 1 holding a Map
(and 12 blocked by a class that is not GC, 110 eligible, held back only by the latch)
```

before that fix the same command printed nothing, exit 0, 180,791 bytes and zero
`(struct …)` types.

The report is a **reader** of program state and resolves nothing: `gcFieldsOf` reads
resolved members, `isStdlibClass` reads a declaration's source, the predicate
questions run under `gcIntrinsicDepth` so they answer "could this be a reference"
rather than "is it one". That is deliberate — an earlier attempt at a truthful
coverage line resolved receivers that compilation had not resolved and moved 14
compiler fixtures. Nothing is left unresolved to keep it safe, because the latch
freeze means every class it needs is already resolved. Flag off emits no coverage
diagnostic of any kind, which keeps the flag-off diagnostic stream — not just the
bytes — unchanged.

Three counts are kept **out** of the reason list: `blocked` (a field whose type is
another refused managed class) and `heldBack` (eligible, refused only by the latch).
Neither names a cause a migration can act on, and letting chains into the reason list
would let them out-count the cause at their root — which is what makes the list a
work order rather than a symptom list. The nine typed arrays are likewise one cause
(`a TypedArray`), not nine.

### What the examples do now

All 19 compile under the flag (exit 0). None migrates: the latch is false on every
one of them. So the honest statement is `--wasmGc` is currently **inert on real
programs**, and the report says so on every build instead of leaving a reader to
discover it in the module. The remaining-work list from GC13 is unchanged in content
and now has a visible zero to move.

### Result

`test:gc` 181 → **192 checks** (three for the uniform report, three for the
non-uniform one, two for flag-off silence, three for the ordering proof), and
`spawnSync` replaces `execFileSync` in the harness so a check can read the
diagnostics the compiler writes to stderr — measured: `execFileSync` returned stdout
only, so every coverage assertion read `(no coverage line)` from a build that printed
one. `-O0..-O3` agree on every GC fixture, `test:compiler` stays at its five
pre-existing mismatches, flag-off output is **byte-identical on all 15 fixtures that
predate this round**, and no file under `std/assembly` was touched.

## TypedArray views as GC structs: the handle, not the payload

The rule is the user's, and it is what makes the round safe rather than clever:

> "@inline [T*N] types i also designed as unaddressable but @managed [T*N] should be
> on HEAP … that type is basically GC holding binary blob thats it … to be sure about
> them we refuse them to hold pointer of any GC sort its compiler error"

A byte buffer **holds no GC references**. So its storage needs no tracing, so its
storage may stay in **linear memory** — addressable — while the *view object* becomes
a GC struct whose fields are all scalars. That resolves the addressability problem
instead of working around it: the GC object is a small handle, and the payload is
still an address.

### The layout, and where it is decided

```
ArrayBufferView  (abstract)   DataView
  { <brand>        i32          { <brand>, buffer, dataStart, byteLength }
    buffer        (mut i32)
    dataStart     (mut i32)
    byteLength    (mut i32)  }
        ↑
  the eleven typed arrays: an empty body, so the base's fields are their prefix
```

- **Field 0 is the brand** — immutable, as in every struct, so `instanceof` stays a
  value compare.
- **`buffer` is the one field whose declared type is not its stored type.** It is
  declared `ArrayBuffer`, a linear-memory block, and a view's hold on it is the
  block's *address*. Storing the address as an `i32` is what keeps `dataStart` a
  real address, and an `i32` field is not traced — which is correct, because an
  `ArrayBuffer` is not a GC object to begin with.
- The rest are already scalars. All three are mutable in the struct because the
  stdlib constructor assigns them; a `readonly` field costs the same on `struct.get`,
  so mutability is not threaded from the declaration.

**Decided in the compiler, never in the stdlib.** `isGcBufferViewClass`
(`types.ts`) recognises the shape — a class whose own declared fields are exactly
`buffer: <pointer-shaped class>`, `dataStart: usize`, `byteLength: i32`. It is a
**shape test, not a name test**: `ArrayBufferView` and `DataView` both declare it,
`DataView` is not an `ArrayBufferView` subclass, and a name list would have needed
updating for both. `isStdlibGcClass` is the single answer to "is this standard-library
class on the GC ABI" — `Array<T>`, a buffer view, or a buffer view's subclass — used
by `isGcClass`, `isGcEligible` and `isGcPrototype` so the three cannot disagree.
`gcFieldTypeRef` (`module.ts`) is where `buffer` becomes `i32`.

**`std/assembly` is untouched**: `git diff --stat` lists no file under `std/`, and the
flag-off module is byte-identical on every fixture *and* on `hello-sprites`.

### `.buffer` is answered by the field itself — zero sites changed

There was a design question here (synthesise a value, refuse with a diagnostic, or
something else) and it dissolved: `buffer` **is still a field**, just an `i32` instead
of a traced reference. So

```
this.buffer = buffer                          // struct.set, i32
changetype<usize>(this.buffer)                // the block's address, unchanged
get byteOffset() { dataStart - buffer }       // unchanged arithmetic
```

all keep working verbatim, including `atomics.ts`'s eleven `changetype<usize>(array.buffer)`
sites and `array.ts:20`'s `changetype<ArrayBufferView>(array).buffer`. **Zero of the 19
`.`buffer` sites in `std/assembly` changed.**

### Two things this surfaced

**1. All twelve view classes canonicalise into one wasm type.** They declare identical
fields, so Binaryen's structural typing makes `Uint8Array` and `DataView` *the same
type* — printed with whichever name was inserted first (measured: the supertype reads
`$~lib/dataview/DataView`, and `Int32Array` got its own only because it was built in
an earlier group). This is GC4's structural-identity hazard in a new place, and it is
benign here for exactly the reason the brand field exists: dispatch is a brand
*value* compare, never `ref.test`. `tests/gc/typedarray.ts`'s `viewBrands` is the
load-bearing test — `dv instanceof DataView` true, `dv instanceof Uint8Array` false,
`u8 instanceof DataView` false, all on one canonicalised type.

**2. `compileVisitMembers` emitted a visitor for every managed class.** Under GC that
compiled `Array<i32>~visit`, whose body reads `this.buffer` — a field the synthesised
layout does not have (`TS2339` at `array.ts:524`). A GC struct is traced by the
engine, so the guest scanner must not be asked to walk one; the case now emits
`return()`, not a skipped slot, because the table is indexed by *typeinfo id* and
omitting an entry would shift every class after it onto the wrong arm.

### What is still refused, named

`examples/2d/hello-sprites` under `--wasmGc`, before → after this round:

```
- 0 of 141 managed classes on the GC ABI - the program is not uniform:
  16 holding a TypedArray, 1 holding an ArrayBuffer,
  1 extending a class that is not GC (TaskState), 1 more reason
  (and 12 blocked by a class that is not GC, 110 eligible, held back only by the latch)

+ 0 of 141 managed classes on the GC ABI - the program is not uniform:
  1 holding an ArrayBuffer, 1 extending a class that is not GC (TaskState),
  1 holding a Map (and 138 eligible, held back only by the latch)
```

**29 blockers gone** (16 direct + 12 transitive + 1 that the old three-cause limit
hid), and **coverage is still zero**, because three classes remain:

- **`~lib/tension-framework/assembly/ai/AiConfig`** — holds `Array<ArrayBuffer>` and
  `ArrayBuffer | null`. `ArrayBuffer` is still a linear block with an `rtSize` header;
  this round migrated the *views*, not the buffer. `ArrayBuffer`'s own round is the
  one that can move this.
- **`~lib/tension-framework/assembly/2d/tileset/Tileset`** — holds
  `named: Map<string, Frame>`. `Map` is unmigrated, and migrating it needs the buffer
  API plus `hashStr` (GC12's named item).
- **`~lib/tension-framework/assembly/2d/scene/drive$State`** — extends `TaskState`
  (`std/assembly/task-rt.ts:56`), the async runtime's state-machine base. Not mine to
  migrate: it is the async lowering's contract, and it is the round after this one.

Also named, not fixed: **`TypedArray.wrap`** (`typedarray.ts:1878-1881`) builds a view
through `changetype<TArray>(__new(...))` plus three `offsetof` stores, so any program
that calls it fails with the `changetype<usize>` diagnostic. Seven sites in
`tension-framework` (`bytes.ts:85`, `res.ts:419`, `ai.ts:64,65,193,200`,
`editor/json.ts:57`), zero in `std/assembly`, zero in the 2d examples — which is why
`hello-sprites` compiles. `subarray`/`slice` route through the same helper.

### The hazard this round creates, stated plainly

Under the GC ABI a view's payload is linear memory that **nothing traces**. Before,
`buffer` was a managed field and `__visit_members` kept it alive; now the address is an
`i32` and the engine has no reason to look at it. The collector that still runs is
`itcms`, and its root set is `__visit_globals` plus a scan of the *shadow stack* —
which is disabled under the flag (it is the pointer ABI's root set). So a buffer could
in principle be swept while a live view points into it.

**This was a risk when it was written, it was measured as a defect in GC18, and it is
now closed in the flag's own allocator.** A view payload no longer lives in a heap that
anything sweeps: `--wasmGc` allocates from a never-free bump arena, so the read-back in
`tests/gc/linearheap.ts` answers `49` and no address is ever handed out twice
(measured: `firstAddressReuse(200000) == 0`, memory 1 → 295 pages for 200 000 payloads
of 64 bytes; GC19's 490 was a 400 000-payload measurement and is corrected in
`docs/memory-model.md`, along with the reservation bug that lost the last 4 bytes of
every payload until GC20). The paragraphs below
record the defect and the costing of the real answer, which is still open.

### The defect as measured (GC18)
GC18's ladder (`tests/gc/linearheap.ts`) writes two bytes into a heap-held view's
payload, allocates 200 000 times, and reads back `60` where the source says `49`;
without the flag the same fixture answers `49`. So the sentence above was right and the
word "in principle" was too generous.

The mechanism, measured rather than assumed, is in `docs/memory-model.md`: the root set
under the flag is provably empty in three pieces (`__visit_globals` compiles to a nop,
`pinSpace` is empty because `__pin` is lowered away, and `visitStack`'s window is
zero-width because `__stack_pointer == __heap_base` in the emitted module), so every
`__new` object is garbage at the next collection. It is also worse than a lost payload:
`DEBUG = true` means a program that allocates enough **traps**, at `itcms.ts:229` in
the sweep or `tlsf.ts:268` in `allocateBlock`. And the obvious repair — turn the shadow
stack back on — is not available: `Module#tostack` requires an `i32` and asserts on a
GC reference.

Three candidate answers, none chosen here: pin the payload for the program's lifetime
under the flag; give `ArrayBuffer` a GC-struct handle of its own so the view's field is
a reference again; or make the payload a `(array (mut u8))` for victims that need
tracing and keep linear memory only for the ones that do not.

### Result

`test:gc` 192 → **218 checks**, `-O0..-O3` agree on all 18 positive fixtures,
`test:compiler` stays at its 5 pre-existing mismatches, flag-off output is
**byte-identical on all 22 fixtures and on `hello-sprites`**, and `git diff --stat`
lists **nothing under `std/`**. The guest still passes its own harness
(`test.mjs`: 10,240 non-black pixels) with the flag-enabled module dropped in — and
that is evidence the change did not break it, *not* evidence that it runs on the GC
ABI: the latch is still off, so the module is byte-identical to the previous commit's.

## One oracle for a field: why the report could lie, and the crash behind it

`class H { cb: (x: i32) => void; n: i32 = 0; }` was reported
`INFO TS6413: wasm-gc: 1 of 1 managed class on the GC ABI` — and the moment an
instance was constructed the compiler died at `gcFieldTypeRef`'s `assert(false)`.

**The cause is that eligibility and emission answered from different predicates.**

- **Eligibility** switched on `fieldType.kind`. A signature type's kind **is
  `usizeType.kind`**: `Type.fromSignature` builds it as `usizeType.kind` with
  `TypeFlags.Reference` and the `Value` bit cleared. So `cb` matched the `Usize` arm
  of the "is this a basic numeric type" switch and answered *storable*.
- **Emission** tested `isInternalReference` (through `tryEnsureBasicType`), which a
  signature type *is*, so it was "non-basic"; then `classReference` was null; then the
  assert.

`kind` is not the discriminator, because a reference can carry a numeric kind.
**`isValue` is**: a value is a number or a vector and has a basic wasm type;
everything else is a reference and must be one of the reference shapes this slice can
emit. Both callers now ask one function, `gcFieldRefusal(fieldType, field)`, so they
cannot disagree — and `gcFieldTypeRef` throws a *named* error naming the field and its
reason if it is ever handed a field the oracle refused, because that would be a
compiler defect rather than a program's problem.

**The same defect had two more instances**, which is why the test walks field *kinds*
rather than the one that was reported:

- **`StaticArray<T>` as a class field** — `isGcClass` answers false for it (it is
  standard library and not `Array`), so it reached the same `assert(false)`. Fixed by
  the element branch emission now has.
- **`@inline [T * N]` fields** are refused by the same oracle, permanently.

### The invariant, as a test

`tests/gc/wasm-gc.js` §37 writes one fixture per field kind and requires, for each:
no crash; and either a coverage line **and** a `(struct …)` type for the class in the
module, or a refusal with a named reason — never both, never neither. That is the
statement "the report may not claim what emission cannot deliver", measured, rather
than a check on the one kind that was reported.

**It immediately found that GC16's own report was inflated.** `hello-sprites` was
reported `138 eligible`; seven of those are not buildable — six classes hold an
`@inline Vec3fValue` and one holds a function value. If the latch had ever been true
for that guest, the compiler would have died exactly as `f2` did. The corrected line
is below.

### Permanent versus fixable, in the report

The taxonomy is the user's: an `@inline [T * N]` is a C-compatible **value** ("C types
[T*N] are same as C structs … its for interops"), a value has no address, and a field
of a reference type is a reference. So a class holding one can **never** be a GC
struct. Listing that beside `Map` sends a reader looking for a representation change
that does not exist, and the thing they would break by finding one is the interop.

```
- the program is not uniform: 1 holding an ArrayBuffer, 1 holding a function value,
  1 extending a class that is not GC (TaskState), 1 more reason;
  permanent, not a work item: 6 holding an inline record (a Vec3fValue)
```

and, once per build, a diagnostic of its own:

```
WARNING TS6415: wasm-gc: 6 classes can never be on the GC ABI - 6 holding an inline
record (a Vec3fValue). A value has no address, so it cannot be a field of a reference
type; this is the memory model's rule, not a work item.
```

### Open question: function values under GC

Refused by name, not supported, because the two candidate representations are a design
decision:

- **`ref func`** — the field's signature becomes a heap type and every closure must
  carry its own type; dispatch then needs `ref.test` on a *signature* type, and a
  closure's environment has to be a field of that type.
- **a table index** — the field stays an `i32`, every closure lives in a table, and
  the environment has to be kept alive by something the engine traces, which is the
  same rooting problem as a linear payload.

Neither is this round's to improvise. Recorded here so the choice is made once,
deliberately.

## `ArrayBuffer`: stopped, and the reason is rooting rather than mechanics

`ArrayBuffer` declares zero instance fields: `byteLength` reads `rtSize` out of the
header at `-TOTAL_OVERHEAD`, and the object pointer *is* the payload start. The
intended treatment is the views' — `{ brand, dataStart: i32, byteLength: i32 }`,
synthesised, `dataStart` still the address every ABI site uses — and it is not done,
for two reasons. The first is mechanical, the second is the real one.

**No `__new` under the GC ABI.** The payload is linear memory and has to be allocated
linearly; the synthesised constructor would need the guest allocator's own entry point
called from the compiler, which is a mechanism this tree does not have and this round
was told not to invent.

**The payload would have nothing rooting it.** This is GC16's documented hazard, and
`ArrayBuffer` is where it stops being tolerable:

- `itcms`'s root set is `__visit_globals` plus the pin space
  (`std/assembly/rt/itcms.ts:155-164`) plus a scan of the *shadow stack* — and the
  shadow stack is disabled under `--wasmGc`, because it is the pointer ABI's root set
  and the engine is supposed to have replaced it.
- A view's payload is already in that position after GC16: `dataStart` is an `i32`,
  nothing traces it, and it survives today only because the fixture allocates too
  little to trigger a step.
- `ArrayBuffer` is the block *every* `Array`, `StaticArray` and view is built on. Giving
  it a handle the engine does not trace would make every buffer in every program
  collectible at the first step — a compile that works and a program that corrupts.

Three candidate answers, none chosen here: **pin** the payload for the program's
lifetime under the flag; **give the payload a GC owner** (a `(array (mut u8))` for the
victims that need tracing, linear memory only for those that do not); or **leave
`ArrayBuffer` on the pointer ABI**, which is self-consistent — a handle is only worth
having if something traces what it points at. This is a decision for the architect, and
it is the same decision GC16 left open for view payloads, now with a name and a cost.

### Result

`test:gc` 218 → **278 checks** (§37 field-kind agreement, §38 the two repros, §39 the
split report), `-O0..-O3` agree on all 18 positive fixtures, `test:compiler` stays at
its 5 pre-existing mismatches, flag-off output is **byte-identical on all 22 fixtures
and on `hello-sprites`**, and nothing under `std/` changed. `ArrayBuffer` did **not**
drop out of the guest's list — see the section above — so the round's Task 2 is a
recorded stop, not a delivery, and the guest's coverage is still zero.

## `ArrayBuffer` as a GC handle: the payload stays, the object moves

`ArrayBuffer` declares **zero instance fields**. `byteLength` is an accessor reading
`rtSize` out of the object header at `-TOTAL_OVERHEAD`, and the object pointer *is* the
payload start. So "the GC object is the handle, never the payload" is not a design choice
here — it is the only shape available.

### The layout, and where it is decided

```
ArrayBuffer  { <brand> i32, dataStart (mut i32), byteLength (mut i32) }
```

- **Field 0 is the brand**, as in every struct.
- **`dataStart`** is the payload address, and it is what every ABI site already uses.
- **`byteLength` is a field read now.** The declared getter is
  `changetype<OBJECT>(changetype<usize>(this) - TOTAL_OVERHEAD).rtSize`, which cannot be
  emitted for a handle (the struct is not adjacent to the payload, and
  `changetype<usize>(this)` on a GC reference is refused), so the compiler intercepts
  `~lib/arraybuffer/ArrayBuffer#get:byteLength` and emits `struct.get`. This is the rare
  migration that makes a method **shorter**.

Decided by `isGcArrayBufferClass` in `types.ts`, and it is an **identity** test —
`cls == program.arrayBufferInstance` — not a shape test. A shape test cannot work here:
the class declares no fields, so it is indistinguishable from `Object` by shape. The
identity is free: `Program#initialize` already asserts `arrayBufferInstance.id == 1`.
`isStdlibGcClass` stays the single answer, now covering `Array`, `ArrayBuffer`, the
buffer views and their subclasses, and `Map`/`Set`.

**The layout is synthesised in the compiler and `std/` is untouched** — `git diff --stat`
lists nothing under `std/`, which is what keeps the flag-off module identical by
construction rather than by care.

### Task 2: which of the three mechanisms

**`idof<ArrayBuffer>()` allocations are intercepted generally**, in
`compileGcTypedNew` — the same function that already turns `__new(size, idof<T>())` into
`array.new` for a GC array type. There is no separate recogniser for
`changetype<ArrayBuffer>(__new(...))`, because every one of the ten sites in
`std/assembly` goes through `__new` and the type is written at the call site:

```
arraybuffer.ts:20,53,69   rt.ts:38   array.ts:73,465   string.ts:698,818   typedarray.ts:1676,1698
```

The narrower option (recognise the `changetype` *around* the call) would miss nothing today
but would put the type logic in two places; the general one is one branch. What it emits
is: allocate the payload from the arena (`~gc/linNew`, so it is a real address in never-free
memory), then `struct.new` the handle over `{brand, dataStart, byteLength}`.

### `changetype<usize>(aBuffer)` is `dataStart`

Every consumer that hands a buffer to a host verb means the **payload**, not the handle, so
`changetype<usize>(buf)` answers `struct.get $ArrayBuffer $dataStart`. That is implemented
in `builtin_changetype`, gated on both `isGcArrayBufferClass` **and** `isGcClass`: on a
program whose latch is off a buffer is still an `i32` pointer and asking for a heap type of
it aborts inside Binaryen (`Assertion failed: isRef()`) — measured on a program holding a
function value, which makes the whole program non-uniform.

That one answer is what keeps 55 `ArrayBuffer` mentions in `tension-framework` and ten
sites in `std/assembly` working unmodified.

### The view's `buffer` field changed shape, and for the better

GC16 stored a view's `buffer` as an **`i32` address**, because a buffer was a linear block
and a pointer-shaped class could not be a field of a reference type. Now the buffer is a GC
handle, so the field is an ordinary traced reference:

```
(type $~lib/dataview/DataView (sub (struct (field $<brand> i32)
  (field $buffer (mut (ref null $~lib/arraybuffer/ArrayBuffer)))
  (field $dataStart (mut i32)) (field $byteLength (mut i32)))))
```

A view now keeps its own buffer alive instead of relying on the arena — a strict
improvement, and the reason the assertion in `tests/gc/wasm-gc.js` that pins the view
layout changed shape rather than being re-baselined quietly.

### `Map` and `Set` become eligible, and their entries do NOT block them

`Map`'s declared fields are two `ArrayBuffer`s and four scalars, so a buffer was the only
thing between it and a struct. Measured, not assumed:

- `Map<i32, i32>` round-trips on migrated storage (`tests/gc/wasm-gc.js` §52:
  `set`/`get`/`size` all correct), and `Set<i32>` likewise.
- `Map<string, i32>` is **eligible** — the report says `1 of 1` — and fails to compile at
  **`hashStr`** (`std/assembly/util/hash.ts:72,76,97,104`), which reads
  `load<u32>(changetype<usize>(key))`. That is GC12's named item, and it is the whole
  remaining blocker for string keys: it is about hashing a string, not about how `Map`
  stores entries.
- `MapEntry<K,V>` is `@unmanaged` and holds `K`/`V` in linear memory, which no analysis of
  declared fields can see. Measured rather than guessed: it does not block the scalar case,
  because the only reference it would hold is a string, and a string cannot be stored in
  linear memory **at all** under the flag (`changetype<usize>` of one is refused) — so the
  entry representation becomes a question only once `hashStr` is solved, and it will have
  to be solved *with* it.

So: `Map`'s round is the round after this one, and it starts at `hashStr`.

### Cost, measured

- A payload's linear span, at three sizes: `stride` between consecutive payloads is
  **32 B for an 8-byte buffer, 96 B for 64, 1056 B for 1024** — i.e. the same
  `(20 header + payload + 15) & -16` reservation a payload always got.
- 10 000 × `ArrayBuffer(64)` takes **17 pages = 111 B per buffer** of linear memory,
  including alignment slack.
- The **handle** is a 12-byte GC struct held by the engine, so it is not linear memory and
  is traced and collected normally.

### Result

`test:gc` 325 → **362 checks**, 0 failures, 0 expected failures. `test:compiler` stays at
its 5 pre-existing mismatches. `-O0..-O3` agree on all **20** positive fixtures. Flag-off
output is **byte-identical on all 23 fixtures and on `hello-sprites`**, and nothing under
`std/` changed.

On the guest: `ArrayBuffer` and `Map` drop out of the fixable list, eligible classes go
**131 → 133**, and coverage is still `0 of 141` because two classes remain — `SolverCallbacks`
(holds a function value) and `drive$State` (extends `TaskState`) — plus the six permanent
`ogre.generated.*` records that hold an inline `Vec3fValue`. Named by measurement, not by
reading the line.

## Function values as GC structs

`std/assembly/function.ts` declares two fields, and the compiler already treats their
layout as a contract (`FUNCTION_INDEX_OFFSET = 0`, `assertFunctionLayout` verifying
`_index` at 0 and `_env` at pointer width wherever an instance is materialised):

```
Function<T>  { <brand> i32, _index (mut i32), _env (mut i32) }
```

- **`_index` stays a table index.** `call_indirect` is unchanged: a function value's
  identity genuinely is an integer and always was, so identity comparison reads the same
  field it always did.
- **`_env` stays an address** into the never-free arena. Neither field is a reference, so
  the struct is **untraced** — correctly, because `_env` points at linear memory nothing
  traces, and a reference field here would be a lie the collector would act on.
- **No synthesised layout was needed**, unlike `Array` and `ArrayBuffer`: the declared
  fields are already the right shape. What changes is that `_index`/`_env` are reached by
  `struct.get`/`struct.set` rather than `load`/`store` at an offset.

Decided in `isStdlibGcClass` (prototype identity against `program.functionPrototype`), so
`isGcClass`, `isGcEligible` and `isGcPrototype` cannot disagree.

### What had to change to make a field hold one

Four things, and the third is the one that would have been missed:

1. **A static function value is a `struct.new`, not a data segment.** `ensureRuntimeFunction`
   builds a linear block with the index at offset 0; a `(ref null $Function<T>)` field
   cannot take that, so both expression paths now emit
   `struct.new $Function<T> (brand, index, 0)`. A fresh struct per evaluation is
   deliberate: it costs one `struct.new`, and identity is `_index`, which is the same
   table index in every copy.
2. **`gcFieldRefusal` and `gcFieldTypeRef` learned the signature case.** A function-typed
   field's `classReference` is **null** — a signature type carries only a
   `signatureReference` — so every branch in both fell through. The field is storable
   exactly when `Function<T>` is a GC class (`gcFunctionValueUsable`), and it is emitted as
   the wrapper class resolved per signature, which is the resolution `getClassOrWrapper`
   performs wherever a function value is used.
3. **`Type#toRef` had to answer a reference for a signature type**, or every site that
   *moves* a function value disagreed with the field it went into: the setter's parameter
   was `i32` while the field was a `(ref null $F)`. This surfaced as
   `struct.set value must have the proper type` and `struct.new operand 1 must have
   proper type`, and the fix is one arm in `toRef` plus one in `ensureType`.
4. **`makeCallIndirect` reads through `struct.get`**, at field indices 1 and 2 (the brand
   pushes both offsets along by one), with the callee bound into a local of *its* type.
   The environment hand-over is unchanged in shape: `_env` is still an `i32` travelling
   through the same hidden global.

`makeFieldZero` also had to answer `ref.null` for a function-typed field: the constructor's
`struct.new` was being handed `i32.const 0` for it.

### A capturing closure is refused, and that is a finding rather than a gap

`_env` is an `i32` address, and a capturing closure's environment is a **heap object** —
a reference under the GC ABI, with no address to put in the field. Handling it means
`_env` becoming a reference *and* `call_indirect`'s hand-over becoming a ref-typed global:
`Function<T>`'s layout and the call contract change together.

So it is refused **by name**, once per program, before any emission:

```
Not implemented: a capturing closure under --wasmGc: its environment is a heap object, and
`Function<T>`'s `_env` is an `i32` address (the `call_indirect` hand-over is an `i32`
global). A non-capturing function value — a named function, or a synthesized one like
`f$resume` — works.
```

Reported up front rather than at the creation site because the closure transform's
synthesized `$Env` class extends `TaskEnv` and has already made the program non-uniform by
then: a check gated on `gcActive` would never fire. Measured: the earlier behaviour was
"1 extending a class that is not GC (TaskEnv)", which names the symptom.

**The consequence for the environment test:** a non-capturing value's `_env` is `0`, so
there is no environment block to sweep and "a stored function value survives 200 000
allocations" tests the handle, not the environment. The environment question is the
capturing case, and a test cannot exercise a feature that is refused. Stated in the
fixture rather than papered over. This also matters for the async plan: `f$resume` is a
top-level synthesized function, so `TaskState.resume` is precisely the shape that does
work — but any state machine whose *entry* closes over something will need the reference
`_env` first.

### Result, and the guest's ceiling

`test:gc` 362 → **383 checks**, 0 failures. `test:compiler` stays at its 5 pre-existing
mismatches. `-O0..-O3` agree on all **21** positive fixtures. Flag-off output is
**byte-identical on all 25 fixtures and on `hello-sprites`**; nothing under `std/` changed.

`hello-sprites` under the flag:

```
WARNING TS6414: wasm-gc: no class migrated - 0 of 141 managed classes on the GC ABI
- the program is not uniform: 1 extending a class that is not GC (TaskState);
permanent, not a work item: 6 holding an inline record (a Vec3fValue)
(and 134 eligible, held back only by the latch)
```

**Function values are gone from the fixable list**, and eligible classes go 133 → **134**.
The brief expected 135; measured 134, and the difference is one class rather than a count
to shrug at: `drive$State extends TaskState`, and `TaskState` (a) is a standard-library
class outside the migrated set and (b) holds `record: TaskRecord`, which is also a stdlib
carrier. So `TaskState` cannot become a GC struct without `TaskRecord`, and both belong to
the async runtime — the round the brief put out of scope. **134 of 141 is this round's
real ceiling**, and 135 needs `TaskState`+`TaskRecord`, not another emitter case.

## The stdlib allow-list was the last gate — and it was the wrong shape

GC22's report said `135 needs TaskState+TaskRecord, which is the async round and not another
emitter case`. **That was wrong.** A reconstruction of both classes in a program reports 5 of
5 on the GC ABI; the real ones were refused for being *standard library*, before their fields
were ever examined:

```
isGcEligibleImpl:  if (isStdlibClass(cls)) return isStdlibGcClass(cls);
```

and `isStdlibGcClass` answered true only for `Array`, `ArrayBuffer`, the buffer views,
`Function`, `Map` and `Set`.

### The rule

The list is only needed where **a class's declared fields are not its stored fields** — the
two layouts the compiler synthesises, `Array<T>` and `ArrayBuffer`. Everything else is
eligible exactly when its fields are, standard library or not. Three exclusions carry their own
reasons, and each was found by measurement rather than foresight:

- **`Object`** — it declares no fields, so the ordinary rule would make it a struct, and the
  resolver gives every class `Object` as its base, so the whole tree re-based onto it
  (`(type $~lib/object/Object (sub (struct …)))`, every class a subtype). It is also the class
  `implicitlyExtendsObject` exists to special-case.
- **`@unmanaged` classes** — a linear record by declaration, so "struct the engine traces" is a
  contradiction. Without this, `itcms`'s own private `@unmanaged class Object extends BLOCK`
  became a struct and every `changetype<usize>` in the collector turned into a refused
  reference conversion — 100 failing checks.
- **`String`, `StaticArray<T>`** — wasm GC *arrays*, answered by `toRef`/`ensureType` before
  any class arm, so `isGcClass` must not also claim a struct for them.

**Blast radius: 4 newly eligible standard-library classes on the guest** — `TaskEnv`,
`TaskSlot`, `TaskState`, `TaskRecord` — and **zero** fixture changed behaviour from the rule
itself (the two regressions the rule caused were the `Object` and `@unmanaged` cases above,
which are now named). Flag-off output is byte-identical on all 27 fixtures and on
`hello-sprites`: the rule only moves the *eligibility* answer for stdlib classes, and with the
latch off nothing is emitted from it.

### The guest, after it

```
WARNING TS6414: wasm-gc: no class migrated - 0 of 141 managed classes on the GC ABI - the
program is not uniform: permanent, not a work item: 6 holding an inline record (a Vec3fValue)
(and 135 eligible, held back only by the latch)
```

**135 of 141, and the only remaining refusals are the six permanent inline records.** The
declared expectation was 140; measured 135, and the gap is arithmetic rather than a miss: the
141 counts managed *non-stdlib* classes, so `TaskState`/`TaskRecord`/`TaskEnv` becoming eligible
adds exactly one — `drive$State`, the guest's subclass. The stdlib carriers are not in the 141.

## `Map`: scalar entries migrate, reference entries are refused

`MapEntry<K,V>` is `@unmanaged` — a linear record — and `entry.key = key` writes `K` into it.
For a scalar that is the representation that already worked. For a reference under the GC ABI
it is a reference written to an address, and the failure mode was the one this arc keeps
paying for: **`Map<string,i32>` took the GC ABI and aborted inside Binaryen with
`isBasic() && "Basic type expected"`** — no diagnostic, no location.

Two changes, both measured:

- **a reference key or value makes the container ineligible**, so the program stays on the
  pointer ABI and `Map<string,i32>` runs. It is also why uniformity now looks at resolved
  `Map`/`Set` instances: with no user classes the latch answered `true` *trivially*, so a
  program that only used `Map<string,i32>` still took the GC path.
- **`Map<i32,i32>` and `Set<i32>` move to the GC ABI** with no further work, and `mapGrow`
  (40 keys, forcing bucket and entry growth) passes there.

`Map<string,V>` end to end therefore needs `MapEntry` to become a GC struct — a round of its
own, and the same shape as the `Array<T>` work.

## `hashStr`: written, measured, not shipped

`hashStr` is the last thing between here and `Map<string,V>` behaving on the GC ABI. It is
`@inline`, so it never becomes a call: it inlines into every `Map`/`Set` lookup and never
reaches `makeCallDirect`, where `compareImpl` is replaced. The hook that does work is in
`compileCallDirect`, above the inline branch.

A replacement was written there — element reads instead of byte loads, keeping the 16-byte
block loop by reconstructing each word as `elem[2k] | elem[2k+1] << 16`. It compiled, it ran,
and **it produced the wrong number**:

```
HASH<string>("hello")   under the flag   3,734,832,270
                        independent XXH32  2,917,590,130
                        pointer-ABI build  neither
```

Three values, one algorithm, and no two agree — so at least one of the three is misread, and
shipping a hash that is merely self-consistent would change every bucket index in a program
while passing a round-trip test. It is reverted, with the hook site documented, and the two
candidate causes are (a) the `else` arm of the `len >= 16` branch not being emitted as I
intended, and (b) the pointer-ABI build's own value coming from somewhere other than the
function I read — which an `-O0` dump of both bodies would settle in one pass.

`Map<string,V>` stays on the pointer ABI until then, and that is correct rather than
convenient: the pointer path's `hashStr` is the one with a known-good body.

## The partition: a trace-free C record is exempt, not refused

`gcUniform` was all-or-nothing, so six correct C-ABI records blocked 135 classes. They are
not failures: a record the C side reads through a pointer must have the layout the C
declaration describes, a GC reference has no place in one, and they are **trace-free** — so
the collector has no business with them.

### The predicate, and the half the brief did not have

The brief's rule was "a managed class is exempt when it is trace-free at every depth". Taken
literally it is **too wide, and the guest measures that**: 85 of its 141 classes are
trace-free, and **8 of them are held by classes that also hold references** —

```
World.solver            (Solver)      Painter.theme   (Theme)
AppShell.canvas         (Canvas)      Layer.frame     (Frame)
drive$State.canvas      (Canvas)      WidgetTree.defaultPage (FontPage)
Ui.tree / Dispatcher.tree (WidgetTree)
```

Under the literal rule those eight become crossings and the framework stops compiling — for
classes that never needed a C layout at all. `Solver` is an ordinary object that merely
happens to hold no references.

So the exemption is for records whose **layout is a contract**:

> A class is **exempt** when it is declared `@unmanaged` (which `export struct` implies in
> this dialect) **and** every field is trace-free at every depth — including the base
> chain's, which `gcFieldsOf` walks.

An ordinary trace-free class stays a GC struct: it is a heap object with no references,
which is exactly what the engine is good at. That keeps the island closed, which is the
user's own phrasing — *a record the C side reads through a pointer*.

**This is a deviation from the brief's literal predicate, and it is the round's main
finding.** Measured both ways: the literal rule gives 85 exempt / 8 crossings / the
framework does not build; the narrowed rule gives **25 exempt / 0 refused / 116 eligible**.

### One direction of the crossing rule is vacuous, and the other is not

- **A GC class holding an exempt record is fine.** The record is linear, so the field is an
  address, and an address is untraced — the same shape as a buffer view's `dataStart`.
  `@unmanaged` declares the record, so every such field is sanctioned by definition. (This
  needed one emitter branch: `gcFieldTypeRef` had no `@unmanaged` case and hit its
  `assert(false)`, so `class HoldsBlob { blob: BlobLike }` crashed the compiler even though
  the field was correctly called storable.)
- **A linear record holding a GC reference has no representation at all**, and is refused by
  name: the engine would have to trace a pointer the C side cannot see, and the record would
  not be the size the header describes. It compiled before this round.

### Two ABIs in one module: coexistence is safe, crossing is not

The existing comment said a program holding both aborts inside Binaryen. Measured — one GC
class with a `string` field, one `@unmanaged` record with three `f32`s, both allocated, used,
no field between them — **it compiles, carries `(struct …)` for the first, omits it for the
second, and runs** (`coexist` = 44). The abort is a crossing hazard, not a coexistence one.

### The report gained its third category

```
INFO TS6413: wasm-gc: 4 of 6 managed classes on the GC ABI; 2 exempt (C-ABI records, trace-free: 1 <Vec3fLike>, 1 <BlobLike>)
```

GC + exempt = total, and an exempt record is never called "refused". The arithmetic is
asserted as a test, and so is the flag-off side: **the exemption changes nothing when the
flag is off** — byte-identical on all 29 fixtures and on the guest, and no struct opcode
appears at all.

One report defect surfaced while measuring and is fixed: a reference-keyed `Map` holds the
latch off, but nothing in the class walk could see it, so the guest's line read *"116
eligible, held back only by the latch"* — true of every class, silent about the one thing
blocking all of them. It now names the container, and the check behind it is latch-free
(`gcReferenceShaped`), because a predicate that decides *whether the program can be uniform*
cannot use `gcStringOf`, which answers "is this a reference *right now*".

### The guest

```
WARNING TS6414: wasm-gc: no class migrated - 0 of 141 managed classes on the GC ABI - the
program is not uniform: 1 holding a Map with a reference key or value (and 116 eligible, held
back only by the latch); 25 exempt (C-ABI records, trace-free: 1 <ArenaControl>, 1
<SessionInfo>, 1 <ManifestEntry>, 22 more)
```

**The six permanent refusals are gone and 25 C records are exempt — but the latch still does
not turn on, because of `Map<string, Frame>`**, which is GC23's blocker and explicitly out of
this round's scope. So the module carries no `(struct …)` types and is byte-identical to the
flag-off build, and the harness passes (10,240 non-black pixels) for the same reason.

That is the honest state: this round removed the last *record* obstacle and revealed that the
last obstacle is the container one. `Map<string,V>` is now the single thing between the guest
and a uniform program — which is a smaller and better-defined blocker than six, but it is not
zero.
