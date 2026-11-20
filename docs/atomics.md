# Atomics

The atomics surface exists for threads and async. This page is the round that
closed the gaps: a bug in `atomic.fence()`, the missing thirteenth member of
`Atomics`, an address-facing API for runtime and C code, and `@atomic` on a
field. Scope is deliberately the operations threads/async need — load, store,
compareExchange, add, wait, notify, fence — at **seq_cst**, which is wasm's
default and the only ordering this compiler names.

## 1. The fence bug

```ts
export function f(): void { atomic.fence(); }
```

```
wasm-validator error in function f: Atomic fence cannot be unordered
```

`src/builtins.ts` called `module.atomic_fence()` with no argument, and the
wrapper passed a *cached string* where the C API takes a `MemoryOrder` —
`BinaryenAtomicFence(module, order)`. The value that reached Binaryen was the
zero of the enum, `Unordered`, and a fence cannot be unordered: it has no
address to be unordered *about*, it orders everything.

The fix is the order, not a workaround: `module.atomic_fence(order)` now takes a
`MemoryOrder` (default `SeqCst`) and `builtin_atomic_fence` passes `SeqCst`
explicitly. A fence names no order at the source level — `atomic.fence()` takes
no arguments — so `SeqCst` is the only order the instruction can carry.

Nothing caught this because no test called `fence`. `tests/rt/atomics.js` §1
compiles the ticket's exact source, validates the bytes with `wasm-tools`, and
runs it.

## 2. Two shapes of the same instructions

`std/assembly/atomics.ts` now exposes both, and the reason is that they take
different things:

- **`Atomics.*`** — the JavaScript shape. An `ArrayBufferView` and an index;
  the address is derived (`buffer + byteOffset + index << align`) and the index
  is bounds-checked. `fence()` was the one missing member (12 of 13).
- **The address-facing surface** — `atomicLoad`, `atomicStore`, `atomicAdd`,
  `atomicSub`, `atomicAnd`, `atomicOr`, `atomicXor`, `atomicExchange`,
  `atomicCompareExchange`, `atomicFence`, `atomicWait`, `atomicNotify`. These
  take the `usize` the builtin takes and forward it with **no arithmetic, no
  bounds check and no conversion**, because runtime code and C interop hold an
  address — often one the host handed over — and cannot manufacture a view for
  it without inventing a length.

They live in the same file, one function per builtin, so the two surfaces are
read together and cannot drift.

**The RMW family returns the OLD value.** `atomicAdd<T>(p, 1)` answers what the
location held *before* the add — that is what `i32.atomic.rmw.add` computes and
what `atomic.add` returns. The new value is the old one plus the delta, and a
caller that wants it computes it. `tests/rt/atomics.js` §3 pins this by giving
every step a distinct expected *pair* (old value, value left in memory), so a
silent switch to the new-value convention fails nine checks rather than looking
different.

## 3. `@atomic` on a field

```ts
class Ring {
  @atomic head: i32;
  tail: i32;
}
```

`@atomic` is an **access modifier**, and the guarantee is placed where it cannot
be bypassed. Field access already routes through generated accessors:

```wat
(func $Ring#get:head (param $0 i32) (result i32)
  local.get $0
  i32.atomic.load)
(func $Ring#set:head (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  i32.atomic.store)
```

The compiler emits the atomic instruction **inside `get:`/`set:`**, not at each
use site. Every read and every write of the field goes through those two
functions — `this.head`, `obj.head`, `arr[i].head`, the constructor's own
initialisation, a view over bytes — so there is no path that reads the field
non-atomically, because there is no path that does not call them. Uses that
genuinely have no accessor are refused by name rather than emitted as plain
accesses (§4).

### Allowed positions

- class field — yes
- `@unmanaged struct` field — yes: this is the C `_Atomic` member
- `@managed struct` field — yes
- plain / `@inline struct` field **when it lives in memory** — yes

### Refused positions

- plain / `@inline struct` field in **SROA** position — a WASM local has no
  address, so there is no `atomic.load` to emit
- local variable — SROA, no address
- global, and a class's `static` field — a global may compile to a WASM
  **global**, which is not in linear memory at all
- a field of an ambient (`declare`) class — its memory and its accessors belong
  to the external host
- without `--enable threads` — the instructions are the threads proposal

### Element types

Allowed: `i8`…`i64`, `u8`…`u64`, `isize`, `usize`, `bool` — the integer widths
wasm's atomic instructions take.

**`f32`/`f64` are refused.** wasm has no float atomics; making one work means
reinterpreting the float's bits as an integer at every access, so the field would
mean something its type does not say. The message says so and points at the
explicit route: an `i32`/`i64` field, bitcast where the reader can see it.

## 4. The one thing refused on purpose: `+=`

```ts
ring.head += 1; // refused
```

```
an @atomic field cannot be updated with `+=` (a read then a write is two atomic
steps, not one). Use `atomic.add<T>(addressOf(aField), delta)` for a single
read-modify-write — the field's address is `changetype<usize>(instance) +
offsetof<Class>("field")`.
```

The composite is the problem: `+=` desugars to get + add + set, which is one
atomic load, arithmetic, and one atomic store, with a gap another agent can
observe. The same holds for every other compound operator and for `++`/`--`.

It is **not** desugared to `fetch_add`. Quietly turning `+=` into one RMW would
make this one operator mean something different from every other compound
operator in the language (`*=` on the same field would still be a read plus a
write), and "atomic only when we can guess" is an invisible change this project
refuses. The user writes the RMW, and the source then says exactly what the
machine does.

## 5. `@atomic` changes no layout

`@atomic` is an access modifier only: `sizeof`, `offsetof` and field order are
identical with and without it, and `tests/rt/atomics.js` §4 compares the two
builds' `sizeof`/`offsetof` numbers to prove it (the build without the decorator
also emits **no** atomic instruction at all, so the decorator cannot have leaked
into the class).

## 6. The GC ABI

A wasm GC struct field is read and written by `struct.get`/`struct.set`, which
take no memory order and have **no atomic form**. So an `@atomic` field makes its
class ineligible for the GC representation (`src/types.ts`,
`gcStructFieldsSupported`), and — because the program is uniform or it is not —
the program keeps the pointer ABI, where `i32.atomic.load`/`store` exist. The
`--wasmGc` coverage line names the field as the obstacle rather than the latch:

```
permanent, not a work item: 1 holding an @atomic field (atomic loads and stores
are linear-memory instructions; a wasm GC struct field has no atomic form)
```

Both ABIs are tested, and the numbers they produce agree.

## 7. What is not here

- **No relaxed/acquire/release.** wasm defaults to seq_cst, which is correct;
  nothing in this round names another order.
- **No atomic floats.** Refused, with the reason (§3).
- **No 64-bit futexes.** `atomicWait` is the builtin's dispatch: `i32`/`i64`-sized
  integer kinds, as wasm defines.
- **No compound-assignment atomicity.** Refused (§4).
- **The ring is untouched.** `std/assembly/thread.ts` keeps using `Atomics.*`
  over its view; converting it to `@atomic` fields is a separate round, and it
  works as written.

## 8. Evidence

`npm run test:atomics` (71 checks): the fence compiles, validates and runs;
`Atomics.fence()` exists and round-trips a view; every address-facing operation
round-trips and returns the old value; `@atomic` emits atomic accessors, leaves
its neighbours plain, keeps the layout, and works in both ABIs; an `@unmanaged
struct` field round-trips through its accessors and its address; each refusal
fires with its own message; and two threads over one `--sharedMemory
--importMemory` module, each with its own instance, increment one `@atomic`
counter 20 000 times each — 40 000 exactly, with the same harness losing
thousands of increments when the guest does a load-then-store instead.
