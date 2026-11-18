# The memory model: three families, and the line that never moves

Every type belongs to exactly one of three families. The family decides where the bytes live,
whether the value has an address of its own, and whether a wasm GC collector can see it. Two of the
three can never be GC, and this page is the record of why — so a later round does not read a refusal
as an unfinished feature and "fix" it.

## The three families

- **Value** — `@inline struct`, a plain `struct`, `T[N]`, `[T * N]`, `@inline [T * N]`. Bytes stored
  inline, no address of its own, copied on assignment. The C struct, exactly.
- **View** — `@unmanaged T`, `@unmanaged [T * N]`. One pointer. The address belongs to whoever
  allocated it; the type says nothing about lifetime.
- **Heap** — `@managed T`, `@managed @dynamic [T * n]`, and every plain managed class. A GC
  reference.

**`T[N]` and a struct of N fields are the same storage.** A value array is a value whose accessor is
`[i]` instead of `.name`. Measured and pinned by fixtures: `sizeof<u32[8]>() == 32`,
`sizeof<f32[6]>() == 24` — the elements, inline, the C answer. That is the property that makes a
record describable by a C header.

**`@unmanaged [T * N]` is the other side of the line, and it is one word.**
`sizeof<@unmanaged [u32 * 4]>() == sizeof<usize>()`, and a fixture asserts it *differs* from
`sizeof<[u32 * 4]>()`. Same element type, different family, different size.

`[T * N]` exists **for C interop**. It is how a TensionScript record matches a C header field for
field. Its size, alignment and layout are promises to a compiler on the other side of the ABI, not
implementation details.

## A value can never be GC

Three ways to look at it, and they are one fact:

1. **Nesting.** Put a value inside a GC struct and that struct needs the value's bytes at a field
   offset — but a GC struct's field is a reference. The bytes become a heap object, and the moment
   that happens the field is `@managed`, not `@inline`. Inlineness and the C layout are both gone.
2. **Lifetime.** On the stack a value's life is no different from an `i32`'s on the same stack. It is
   a stack buffer, and nothing outlives the frame, so there is nothing to trace.
3. **Copy semantics.** Passed as an argument a value is copied. It behaves like a C struct, not like a
   pointer; a GC reference cannot be copied that way, because copying it is aliasing it.

So the refusal is not a gap in the collector or a missing emitter case. **A GC struct cannot hold a
value field, and a value cannot be a GC reference.** The only thing to do with the combination is
refuse it, by name, with the reason attached.

That is now `TS6415`, reported separately from the work items, and stated as what it is: the memory
model's rule, not a work item.

## A byte buffer holds no GC reference

A blob of bytes has numeric elements by definition, so it cannot hold a GC reference — and the
compiler enforces that independently (`src/builtins.ts`): `changetype<usize>` of a GC class instance
is refused by name, **AS100**, "a wasm GC reference has no address, so it cannot become an integer or
a pointer".

That is what made the buffer migration look tractable: the payload may stay in linear memory because
nothing in it needs tracing, while the handle becomes the GC object, and `dataStart` survives as an
integer field so an ABI site passing a raw address is untouched.

**The first half of that reasoning is correct and the second half is not.** See the next section.

## The linear heap is unrooted under the flag — and what actually reclaims it

`--wasmGc` drops the shadow stack (`src/program.ts:463` builds the `Module` with
`!options.wasmGc && stackSize > 0`). The shadow stack was the linear heap's **only root
set**, so under the flag:

- GC structs are traced by the engine;
- anything `__new` allocated from linear memory has **no root at all**.

Measured, same source, run on Node, `--wasmGc`:

```
class Box { v: Uint8Array = new Uint8Array(16); tag: i32 = 0; }
let box: Box = new Box();                       // heap-held, so the handle is alive

write 42 and 7, read back                       -> 49   correct
write 42 and 7, 8 x Uint8Array(64), read back    -> 49   correct
write 42 and 7, 200 000 x Uint8Array(64)         -> 60   WRONG (expect 49)

without --wasmGc, 200 000 allocations           -> 49   correct
```

`60` is whatever the churn left in the reused bytes; it differs between builds
(measured 63, 60 and 55 in different runs and optimisation levels), which is the point
— it is *not* a stale field and it is not a wrong constant, it is bytes that stopped
belonging to this object. `tests/gc/linearheap.ts` pins all three rungs, and §40 of
`tests/gc/wasm-gc.js` marks the third as a visible expected failure.

### What `__new` actually is under the flag

Four questions, each answered by a file or a measurement rather than by reading the
prose above:

**1. Which runtime.** `--runtime` selects it and the flag does not touch it:
`cli/index.js:707` resolves `rt/index-${runtime}`, the default is `incremental`, and
`std/assembly/rt/index-incremental.ts` imports **`tlsf` and `itcms`**. So `__new` is
`~lib/rt/itcms/__new` (`std/assembly/rt/itcms.ts:260`) under the flag exactly as
without it.

**2. Is there a collector in the module?** **Yes.** In the `--wasmGc` module:
`itcms/__new`, `itcms/step`, `itcms/interrupt`, `visitRoots`, `visitStack`,
`pinSpace`, `threshold`, `tlsf/__alloc`, `tlsf/allocateBlock`. Absent: `__collect`
(unreferenced, so dropped by `remove-unused-module-elements`), `__link` and
`__visit_members` (their call sites are lowered to `nop` under the flag, GC12), and
`__visit_globals` (its body is empty, because every class-typed global is skipped).

**3. What is the wrap region? There is none — and that matters, because the
obvious reading of the reuse number is wrong.** Apropos of nothing but the number:
18181 of 200000 allocations return the *first* address under the flag, and 19999 do
without it. **Reuse is not a flag behaviour**: it is 9–10 % either way, so it
identifies tlsf's free list after an itcms sweep, not an arena. Two further
measurements settle it:

- The **period moves with the allocation size** — measured 26 allocations at 16 bytes,
  11 at 64 — which a fixed-slot arena could not do, and which is what
  `GRANULARITY = 1024` (`itcms.ts:385`) over tlsf's rounded block sizes predicts.
- The address sequence is monotone (stride = payload + 32 bytes of object and block
  overhead) and then **jumps back to a low address** mid-run — a free list restarting,
  not a rotating cursor.

**4. Why does the flag-off build not grow memory over 200 000 × 64 B?** Because itcms
reclaims. The reuse period is 25–40 allocations of 96–112 bytes ≈ 2.4–4.5 KB per
cycle, which is `GRANULARITY 1024` plus `IDLEFACTOR 200` (`itcms.ts:385,391`). Nothing
else in the tree frees: the flag-off run has the same `tlsf` and the same `itcms`, and
its only difference is that the shadow stack roots what is still reachable.

### The root set is provably empty, in three pieces

1. **Globals.** `__visit_globals` is compiled from `compileVisitGlobals`
   (`src/builtins.ts`), which skips every GC-typed global (GC12) and every class-typed
   global under the flag; with none left its body is `module.nop()`. In the measured
   module the function is gone entirely.
2. **Pins.** `pinSpace` is in the module but empty: `__pin` and `__unpin` call sites
   are lowered to `nop` under the flag (GC12), so nothing is ever pinned.
3. **The shadow stack.** `visitStack` walks `__stack_pointer .. __heap_base`, and in
   the emitted module both globals hold the **same constant** — measured
   `(i32.const 33388)` for each — so the loop body never runs. The compiler does not
   push managed operands (GC11's `needToStack` gate), and the region is zero-filled
   anyway.

Three empty pieces make an empty root set, so every `__new` object is garbage at the
next collection — including one a live handle still points at through `dataStart`.

### A lost payload can also trip the collector's own asserts — on some allocation patterns

`DEBUG` is `true` unconditionally (`std/assembly/rt/common.ts:13`), so the asserts are
compiled into **every** build; `--target debug`/`--target release` make no difference
(measured: the trap below reproduces at all four optimisation levels and all three
targets).

Whether it *fires* is **allocation-pattern dependent**, and this is the correction to
an earlier version of this page. Measured, two fixtures, same flag:

```
loop allocating N views of one size, writing into a scratch array, N = 600
  -> assert@268:14  tlsf.ts:268  assert(blockInfo & FREE)   (in allocateBlock)
  -> and at other N, assert@229:20  itcms.ts:229  assert(obj.color == i32(!white))  (sweep)

class Box { v: Uint8Array = new Uint8Array(16); }
write 42/7, churn 200 000 x Uint8Array(64), read back
  -> NO trap; answers 57 (wrong value, same defect)
```

So "a program that allocates enough traps" was an overstatement: the *corruption* is
implied by the empty root set and reproduces on both shapes, while the *assert* needs
a shape where the sweep and the free list disagree about a block — a loop that holds a
scratch buffer across many allocations does it, a simple churn does not. What survives
as a claim: when the asserts do fire, they name the mechanism (`sweep` freeing an
object it believes is old-white, `allocateBlock` being handed a block not marked free)
— and a build with `DEBUG` off would corrupt silently instead.

Neither trap is caused by GC12's `__link`/`__pin` lowering: verified by disabling those
four lowerings, after which both still reproduce.

**And the obvious fix is not available.** Turning the shadow stack back on under the
flag makes the **compiler** assert: `Module#tostack` (`src/module.ts:1850`) requires
the value to be `i32`, and a `(ref null $C)` local is not. Measured by forcing
`useShadowStack` on for a flagged build — `AssertionError at n.tostack`. The shadow
stack is structurally incompatible with ref-typed locals, so "put the root set back"
is not a flag; it is the rest of the migration.

### What the flag does about it today: a never-free arena

Until the memory model question is decided, `--wasmGc` does not allocate from `itcms`
at all. The compiler emits a **bump allocator** (`~gc/linNew`, `~gc/linRenew` in
`src/compiler.ts`) and lowers every `__new`/`__alloc`/`__renew`/`__realloc` call site
onto it, so:

- a payload is **never handed to another allocation**, which is the whole defect: the
  ladder's third rung now reads `49` where it read `60`;
- `__free`, `__collect`, `__visit`, `__visit_members` and `__visit_globals` lower to
  nothing, so the guest collector cannot run over objects it did not allocate;
- linear memory **grows and is never reclaimed** — 200 000 × 64-byte payloads take
  `memory.size()` to **295 pages (18 MiB, 96.7 B of span per payload)**, and the same
  address is never returned twice (`firstAddressReuse(200000) == 0`, measured).

  (GC19 quoted 490 pages here. That was measured after *two* 200 000-allocation loops
  in one instance — the ladder's churn and then the reuse probe — so it was a number for
  400 000 payloads, not 200 000. The figure above is one defined workload,
  `tests/gc/workload`-shaped: exactly 200 000 payloads, in a fresh instance.)

**The reservation arithmetic, and the bug it had.** A block's span is
`(object + 20 + size + 15) & -16` — header, payload, rounded **up** to the 16-byte
alignment. GC19 shipped it without the `+ 15`, and `& -16` floors, so the span ended
*below* the payload's last byte and the next block's header landed inside the payload.
Measured before the fix, filling a payload with `0xA5` and allocating once:

```
payload  8 B: survivor mask 0x00000000   the whole payload (the floored end landed
                                         before the payload even began)
payload 16 B: survivor mask 0x00000fff   last 4 bytes
payload 32 B: survivor mask 0x0fffffff   last 4 bytes
payload 64 B: 60 of 64 bytes
```

After the fix every one of those is all-ones, and the cost is visible: a 16-byte
payload's span went from 32 bytes to 48 (overhead 16 → 32 bytes per block). That is
the delta, and it is also why the 200 000-payload figure moved from 247 to 295 pages.

`tests/gc/linearheap.ts` now fills the **whole** payload with a sentinel and checks a
mask of survivors, writes the last byte explicitly, and checks two consecutive blocks in
both directions. Its header says the durable part: a two-byte-front-of-buffer assertion
is not a liveness proof — what a wrong reservation damages is the tail.

The cost is exact for a sandbox guest whose arena dies with its instance, and the
change is reversible: it is a stopgap, not the answer below. Measured cost per frame
for a guest that rebuilds its submit buffer and a scratch array each frame: **262
bytes** (10 sprites × 28-byte records + a 4-element `Array`), which is ~2.05 M frames
— about 9.5 hours at 60 fps — inside a 512 MiB maximum. A guest that reuses its
buffers, as `hello-sprites` does, pays nothing per frame.

### The three candidate answers

1. **GC arrays for payloads, copy at the ABI boundary.** Correct and uniformly traced; costs the
   zero-copy property the framework's wire path is built around.
2. **A non-collecting linear arena.** Nothing sweeps, so nothing corrupts. Buffers become
   arena-scoped — exact for a sandbox guest whose arena dies with the instance, a growth problem for
   a long-lived one.
3. **Root the linear heap explicitly** (pins, or an equivalent the collector can see). Keeps
   zero-copy; makes lifetime a discipline that has to be enforced rather than a property.

This choice is architectural and changes the memory model. It is not made here.

Two facts from the section above narrow it. The internal corruption (the sweep and
free-list asserts) is not merely a lost payload: it means the collector's bookkeeping
is being applied to a heap whose reachability it can no longer compute, so *any* answer
that leaves `itcms` running over graphless objects keeps the corruption. And option 3
is not reachable by toggling the shadow stack — `Module#tostack` refuses a reference.

## The report separates fixable from permanent

Because the two kinds of refusal are not the same kind of problem:

- **`TS6414` — fixable.** A representation change this project intends to make. `TypedArray` was
  here and is done; `ArrayBuffer`, `Map`, and function values are here now.
- **`TS6415` — permanent.** Refused by the memory model itself. An inline value field in a GC class
  cannot become migratable without becoming a different type.

- **`TS6415` — exempt** (reported from GC25, and the first version of this page called the category
  "owed"). A generated wire record is linear by contract and trace-free by measurement (see below),
  so it is neither a work item nor a rule refusal — it is the C ABI, and the report says
  `N of M on the GC ABI; K exempt (C-ABI records, trace-free: …)` rather than counting it against
  the program. The arithmetic closes: **GC + exempt + refused = total**, asserted as a test.

A fourth entry belongs here now, and it is **a limitation rather than an absence**:

> **`Map<string, V>` and `Set<string>` are unsupported under `--wasmGc`.** `MapEntry<K, V>` is
> `@unmanaged` — a packed linear block addressed by `changetype<usize>`, at 11 arithmetic sites in
> `map.ts` plus the `set.ts` equivalents — so a *reference* key or value has no representation in it.
> A container instantiated with one is therefore ineligible, which holds the whole program on the
> pointer ABI where it works. Scalar entries (`Map<i32,i32>`, `Set<i32>`) do migrate.
>
> **Scope of a fix, measured rather than estimated:** 11 address-arithmetic sites in `map.ts`; and
> when `K` or `V` is a reference, `entries`/`buckets` stop being byte buffers and become a GC array
> plus an index table, with the load factor and probe arithmetic rewritten against it. `hashStr` is a
> separate blocker that bites at the same moment: it is `@inline`, so it inlines into every lookup
> and never reaches the call-site hook `compareImpl` uses, and a replacement was written and
> **withdrawn because it produced a different number** from an independent XXH32 implementation
> (`docs/wasm-gc.md` has the three disagreeing values).
>
> **What would decide it:** whether a GC-uniform program ever needs a *bulk* string-keyed map. Both
> registries in the framework — `Tileset.named`, `Logger.registry` — are bounded name→object tables
> reaching **6** and **2** distinct names in this tree, so they are now a linear `NamedTable<T>`
> (`tension-framework/assembly/runtime/named-table.ts`), which costs nothing and removes the last
> declared obstacle in the 2D guest. A bulk map would be a different argument, and nothing measured
> here makes one.

A report that lists any two of these three together tells a reader every refusal is the same kind of
work item, and the natural next step from that reading breaks the C ABI. The split is load-bearing.

## Graphics handles: who owns what, and why that is the right shape

The engine-side ownership ruling, in the user's words:

> "Graphic units should own these objects, they must create them and destroy them … the representing
> values in client naturally has to be non-gc objects. What we can do in wasm client side is only
> this: we can put them as GC objects holding these unmanaged pointers and they may call graphic
> interface to free them when they fell from DOM model, and dom model is completely lives in wasm
> client."

Three tiers, and they are not interchangeable:

- **GPU/native objects** — owned by the graphics unit (the Ogre DSO, `tension-2d`). Only the graphics
  API knows how they were allocated or how to deallocate them. They are **not represented in wasm
  memory at all**.
- **Handles** — an integer naming such an object: a slot index, or an unmanaged pointer. Unmanaged by
  definition.
- **DOM objects** — client-side, wasm-resident, GC-eligible. They hold handles as scalars and never
  the object itself.

The tree already implements exactly this:

```
Sprite  { scene: Scene; index: i32 }     // `index` is the handle; Scene owns the slot arrays
Node    { doc: Document; id: i32 }       // every property reads through `Document`
```

- `Scene.destroy(index)` marks the slot dead and pushes it to `freeSlots` — **the free list belongs to
  the owner, not to the handle**. `Document` has the same shape with its slot arrays.
- `Sprite.isValid()` / `Node.isValid()` are the "does this handle still name a live node" test, which
  is what makes a stale handle detectable instead of a dangling pointer.

Why the user chose this, and both reasons are structural rather than stylistic:

1. **Most graphics objects are hints of objects that live in the GPU.** A wasm-side object could only
   ever describe one; it could never be one.
2. **The 4 GiB wasm32 limit.** Keeping payloads out of the guest address space is what makes a scene
   of a given size possible at all.

### The consequence for the GC arc

**A DOM class holding an `i32` handle is GC-eligible today**, the same way a function value and an
`ArrayBuffer` are. The handle is a scalar; nothing about it needs tracing, and nothing about the
graphics model forbids the class from being a struct. So `Sprite`/`Node`-shaped classes crossing to GC
is not blocked by the ownership design — it is helped by it, because the design already keeps every
managed reference out of the class.

## Wire records are linear by contract, and trace-free by measurement

The six classes the report calls permanent are the generated Ogre wire records, and the reason is not
that they failed to migrate. Every field type in `ogre/generated/ogre.generated.ts`, counted:

```
43 f32   41 u32   10 Vec3fValue   6 u64   5 QuatfValue   3 i32
```

**108 fields. Zero references.** Not one `string`, `Array`, `Map`, or class-typed field.

That is by construction, not by luck: a record the C side reads through a pointer must have a layout
the C struct declaration describes, and a GC reference has no place in such a layout. Every one of
those records is trace-free — which means it needs no tracing. The collector has no business with it.

So these are not classes that failed a test. They are **linear by contract**, and the honest category
for them is a third one: **exempt**, not refused.

## The latch should be a partition, not a global switch

`gcUniform` is all-or-nothing: one ineligible class and the whole program keeps the pointer ABI. That
is what turns six correct wire records into a total block on 135 other classes.

The reported reason for the switch is real — mixing aborts inside Binaryen
(`isBasic() && "Basic type expected"`) — but that abort is a **crossing** hazard, not a coexistence
one. It happens when one field is stored two ways: a pointer-shaped class holding a field whose class
is GC, so the field is an `i32` offset in one layout and a `(ref null $C)` in the other. A linear
record that holds only scalars and inline values never borrows a GC reference, so there is nothing to
store two ways.

The partition that follows:

- **ABI-fixed** — a generated wire record, or more generally a class whose fields are all
  value/scalar and which crosses the C boundary. Stays linear, always, and is not a refusal.
- **GC** — fields storable, by the existing predicate.
- **Pointer** — holds something neither representation can carry.
- **The invariant: a linear class may not hold a GC reference.** That is the only thing that has to
  be enforced, and it is exactly what Binaryen already refuses.

Under that rule the 2D guest is 135 GC classes and 6 linear ones, and neither borrows the other.

**Not implemented.** Recorded because the current switch is the only reason the arc has a ceiling at
all, and the ceiling is an artefact of the switch rather than of the design or of the C ABI.

## Lifetime is DOM-driven, never GC-driven

"Call the graphics interface to free them when they fall from the DOM" is not a GC finalizer, and it
must not be. Two reasons, the first of them hard:

- **The wasm GC proposal has no finalizer.** There is no hook the engine calls when a struct becomes
  unreachable; a collection happens and returns. A design that depends on the collector telling us
  cannot be built on wasm GC.
- **This system has no such hook either.** `__finalize` exists in the itcms runtime
  (`std/assembly/rt/itcms.ts:249`) and is called on sweep — but under `--wasmGc` the arena lowers
  `__free` and `__collect` to nothing, so nothing is swept and `__finalize` never fires. And no file
  under `std/` defines it, so nothing in the framework relies on it today.

So reclamation is an **event in the DOM**, not an observation of the collector: removal from the tree
calls `destroy`, which returns the slot to the owner's free list. `Scene.destroy` and `Document`'s
slot arrays are already that shape.

Deterministic release is also the right default for GPU resources independently of wasm: no one wants
a VRAM allocation's lifetime decided by when a collector happens to run.

## Why this reaches the async plan

`TaskState` — the base class of every lowered state machine — holds
`resume!: (state: TaskState) => void`. A function-typed field has no GC representation, so
`TaskState` cannot migrate, so any guest containing an `async` function cannot be GC-uniform. The 2D
guests reach it through `async function drive(...)` in the frame loop.

That is a cycle:

- Backend A (state machines) does not need GC — its frames are ordinary stack frames.
- Backend B (WasmFX) needs GC — a parked continuation frame is not in the shadow stack's range, so a
  pointer-collector cannot see its objects.
- But Backend A's own carrier, `TaskState`, is what blocks the GC migration.

To migrate a real async guest to GC, the guest must stop using the state machine; to stop using the
state machine, Backend B must exist; and Backend B's safety argument rests on GC.

Two ways out, and the choice is architectural:

- **Give function values a GC representation** (`ref func`, or a table index kept as a scalar). Then
  `TaskState` migrates, the cycle opens, and both backends coexist during the transition.
- **Prove GC on a guest with no async at all.** Then the arc has one fully migrated real program and
  the async path follows Backend B.

Note that the second option still runs into the linear-heap rooting problem above as soon as that
guest holds a buffer.

## A predicate and an emitter must agree

The hazard this page exists to prevent, measured: `gcStructFieldSupported` said a class holding a
function-typed field was GC-eligible, the report said `1 of 1 managed class on the GC ABI`, and
constructing the class aborted the compiler at `gcFieldTypeRef`'s `assert(false)`.

The cause is that the two answers came from different predicates. Eligibility switched on `TypeKind`,
and a signature type's kind **is** `usizeType.kind` (`Type.fromSignature` builds it with
`TypeFlags.Reference` and the `Value` bit cleared), so a function-typed field looked numeric and
therefore storable; emission tested `isInternalReference`, found it true, found `classReference` null,
and asserted. **`kind` is not the discriminator — `isValue` is.**

Both sides now ask one function, and `gcFieldTypeRef` throws a named error if it is ever handed a
refused field, because that is a compiler defect rather than a program's problem. The invariant is a
test: one fixture per field kind, each must either report coverage *and* carry a struct type in the
module, or refuse with a named reason — never both, never neither, never a crash.

That test immediately showed the report had been inflated: `hello-sprites` was announced as "138
eligible" when seven of those could not be built (six holding `@inline Vec3fValue`, one a function
value). Had the latch ever been true for that guest, the compiler would have died the way the repro
did. **An eligibility predicate that is not the same function as the emitter's field-type
construction will always drift, and the report built on it will state a fact that is not true.**
