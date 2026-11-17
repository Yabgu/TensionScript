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

## The linear heap is unrooted under the flag — measured

`--wasmGc` drops the shadow stack, because `hasShadowStack = !gcActive && stackSize > 0`. The shadow
stack was the linear heap's **only** root set. So under the flag:

- GC structs are traced by wasmtime's collector;
- anything allocated from linear memory by `__new` has **no root at all**.

Measured, both from the same source with `--wasmGc`, run on Node:

```
class Box { v: Uint8Array = new Uint8Array(16); tag: i32 = 0; }

stab()      heap-held view: write 42 and 7, churn 200k x Uint8Array(64), read back
            -> 9      expected 49
local()     local view:      write 42,      churn 200k x Uint8Array(64), read back
            -> 9      expected 42

same program without --wasmGc
stab()      -> 49     correct
```

`9` is the churn's own first byte: the payload was freed and its memory handed to the next
allocation. The view handle is alive and correctly traced; the bytes it points at are not.

The existing GC suite does not catch this. Every runtime assertion in it reads its values immediately,
before a threshold is reached, so no collection happens between a write and its read. It is a genuine
test gap: the suite proves values *current*, never values *live*.

**So no buffer payload may live in linear memory under the flag until the linear heap has a root
story.** That includes `ArrayBuffer`, which is why it was not migrated: the blocker is not `__new`
mechanics, it is rooting. Compiling it would have produced modules that run and then corrupt.

### The three candidate answers

1. **GC arrays for payloads, copy at the ABI boundary.** Correct and uniformly traced; costs the
   zero-copy property the framework's wire path is built around.
2. **A non-collecting linear arena.** Nothing sweeps, so nothing corrupts. Buffers become
   arena-scoped — exact for a sandbox guest whose arena dies with the instance, a growth problem for
   a long-lived one.
3. **Root the linear heap explicitly** (pins, or an equivalent the collector can see). Keeps
   zero-copy; makes lifetime a discipline that has to be enforced rather than a property.

This choice is architectural and changes the memory model. It is not made here.

## The report separates fixable from permanent

Because the two kinds of refusal are not the same kind of problem:

- **`TS6414` — fixable.** A representation change this project intends to make. `TypedArray` was
  here and is done; `ArrayBuffer`, `Map`, and function values are here now.
- **`TS6415` — permanent.** Refused by the memory model itself. An inline value field in a GC class
  cannot become migratable without becoming a different type.

A report that lists both together tells a reader every refusal is the same kind of work item, and the
natural next step from that reading breaks the C ABI. The split is load-bearing.

## The ceiling, and it reaches the 2D guests

`--wasmGc` is all-or-nothing: one ineligible class puts the whole program back on the pointer ABI.

`examples/2d/hello-sprites` reports:

```
WARNING TS6415: wasm-gc: 6 classes can never be on the GC ABI - 6 holding an inline record
(a Vec3fValue). A value has no address, so it cannot be a field of a reference type; this is the
memory model's rule, not a work item.

WARNING TS6414: wasm-gc: no class migrated - 0 of 141 managed classes on the GC ABI - the program
is not uniform: 1 holding an ArrayBuffer, 1 holding a function value, 1 extending a class that is not
GC (TaskState), 1 more reason; permanent, not a work item: 6 holding an inline record (a Vec3fValue)
(and 131 eligible, held back only by the latch)
```

`Vec3fValue` is a generated wire record (`ogre/generated/ogre.generated.ts`), 12 bytes, three `f32`s,
declared as a plain `struct` — inline **because the C side needs it inline**. Those six classes can
never be GC, so this guest can never be uniform, so **the 2D guest path is permanently outside the
wasm GC arc** in its present shape.

That is a collision between two designs that were each right on their own:

- the framework's records are inline values **for the C ABI**;
- wasm GC uniformity forbids inline values in managed classes.

Nothing in this repository resolves it, and a round spent trying to migrate those six classes would
break the interop property the records exist for.

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
