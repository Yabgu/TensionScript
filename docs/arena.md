# Arenas: one heap per thread, in one shared memory

`--sharedMemory` lets several instances address one buffer. It does not, by itself, make the
runtime safe for them, and this page is the record of why — and of the one shape that is.

## The measurement that starts this

A module compiled at `3238905b` with
`--runtime incremental --enable threads --sharedMemory --maximumMemory 1`, containing a `new K()`
loop:

```
memory: (memory $0 1 1 shared)
atomic instructions in the whole module: 0
  in __new/__alloc/tlsf paths:           0
total functions:                         60
```

Zero atomics. That is not a saving, it is two defects wearing one number:

1. **`tlsf` has no synchronization.** Its free lists are linked structures mutated on every
   alloc/free — `block.next.prev = …`, `flMap`/`slMap` bitmaps. Two threads allocating against one
   heap interleave those writes and corrupt the lists on the first concurrent allocation.
2. **`itcms.visitStack` walks this instance's stack.** The window is
   `[__stack_pointer, __heap_base)`, and both are per-instance globals. A collection in thread A
   cannot see thread B's stack, so anything reachable only from B is unmarked, swept, and still
   live. Use-after-free.

## Why not atomics plus a cross-thread collector

Because a store's stack is not visible from another store. Stop-the-world across threads needs every
thread's roots, and the roots are in stacks the collector cannot read. There is no fix at that layer:
the sentence "collect while another thread runs" has no meaning here. So the answer is not a better
shared collector, it is **one heap per thread**.

## The arena

An **arena** is a `[base, end)` span of linear memory that owns

- its allocator state (the TLSF root: `flMap`, `slMap`, the heads, the tail),
- its collector state (the three space heads `fromSpace` / `toSpace` / `pinSpace`, and — as wasm
  globals, per instance already — the colours, counters, phase and threshold),
- and its stack region.

Each instance gets a disjoint arena. That buys both fixes at once:

- **The allocator needs no atomics**, because no two threads ever touch the same free list. This is
  the same bargain a thread-local allocator makes in any C runtime.
- **`visitStack` is correct as written**, because `__stack_pointer` and the heap base are that
  instance's own, so the window is exactly that instance's stack.

Nothing but bytes crosses between threads — which is what the completion ring already does.

## The interface

One guest function, exported under `--sharedMemory` together with the rest of the runtime
(`--exportRuntime`, the switch that says a host drives this module's runtime):

```
__arenaInit(base: usize, size: usize): void
```

A host calls it on every instance it creates, which is how a spawned thread learns where its heap is.
It is safe to call more than once: each call re-initializes that instance's runtime state (fresh
allocator root, empty collector spaces, threshold from the new size) and drops the previous arena's
objects — any handle from before the call is dangling, exactly as `memory.reset()` would leave it.
It moves `__stack_pointer`, so it must be called with no live guest frame: at instantiation, from
the host, or from a guest frame that immediately returns.

Two read-backs exist for hosts and for tests, and no more:

```
__arenaHeapBase(): usize   // where this instance allocates from; 0-config default is __heap_base
__arenaEnd(): usize        // the arena's end, or 0 when no arena is configured
```

## The layout inside an arena

The default layout, mirrored — that is the point, because the invariant `visitStack` relies on must
not change:

```
base                            heapBase                          end
 ├────────── stack region ──────┼─ space heads ─┬─ TLSF root ─┬─ free memory ─┤
 │  grows down from heapBase    │  from/to/pin  │             │               │
 └──────────────────────────────┴───────────────┴─────────────┴───────────────┘
```

- **Stack region**: `[base, heapBase)`, sized as this module's `--stackSize` sized the default one
  (`__heap_base - __data_end`). `__stack_pointer` is set to `heapBase` and grows down.
- **Space heads**: three `Object` sentinels, `offsetof<Object>()` apart. They must be *inside* the
  arena, not simply re-pointed: they live in memory, so two instances sharing one memory would
  otherwise share one set of chains, and each one's sweep would free the other's objects. (Measured
  before the move: after A's collection, A's next allocation landed in B's arena.)
- **TLSF root**, then all remaining bytes as one free block.

## Default behaviour is unchanged

If no arena is configured, `HEAP_BASE == __heap_base` and the runtime spans the whole memory exactly
as before. The switch is a compile-time fold — `ASC_ARENA` is registered only under `--sharedMemory`,
and the runtime folds on `isDefined(ASC_ARENA)` — so a build that does not share memory emits the
module it emitted before arenas existed, with no extra global and no extra instruction. Measured:
identical `.wat` for a fixed sample program, before and after this change.

## The atomic count is still zero, and that is now correct

The allocator still contains no atomics, and it must not: it is confined to one arena, and one
arena has exactly one owner. The measurement is part of the test
(`tests/rt/arena.js` §6) so that a later round that reintroduces sharing notices.

## What an arena refuses

- **Exhaustion traps.** An arena's free lists already hold every byte of `[heapBase, end)`, so a
  failed search means the arena is out, and `growMemory` is not called at all — growing linear
  memory would hand out pages outside the arena. The trap is the same one `memory.grow` failing
  produces.
- **A pointer the arena does not own is not a root.** `__visit` (and `__link`) skip it. Without that,
  a global still holding an object from before `__arenaInit` makes the collector read and colour a
  header this instance no longer owns — measured: `memory access out of bounds` in the sweep.
- **`--wasmGc` has no arena.** Under that flag the linear allocator is the compiler's own bump
  allocator (`~gc/linNew`), not `std/assembly/rt`, so a runtime-side arena would bound nothing. The
  compiler therefore exports no `__arenaInit` in that ABI: a host gets "not a function" rather than a
  heap it believes it configured. Parametrizing that allocator is a separate front.
- **The stub runtime takes bounds too**, since it is the other linear ABI and a bump allocator with a
  hard end is already an arena. `tcms` takes them as well, for the same reason `itcms` does.

## Where this is measured

`tests/rt/arena.js` (wired as `npm run test:arena`), 68 checks across both linear ABIs:

1. the default path spans the whole memory and allocates above `__heap_base`;
2. a build without `--sharedMemory` emits no arena machinery at all;
3. arena bounds: every returned pointer is in `[base, base+size)`, `__arenaHeapBase()` reflects the
   new base, the stack pointer is inside the arena below it;
4. a second `__arenaInit` with different bounds re-initializes cleanly and allocations land in the
   new arena;
5. a collection inside the arena writes nothing outside it — guard bytes on both sides survive —
   and live objects survive it;
6. two arenas in one shared memory: one `--importMemory` module instantiated twice with different
   bounds, both allocating independently, each one's collection leaving the other's payload alone
   (host-side, in Node — there is no `statushost/` host in this tree);
7. the stub runtime takes the same bounds;
8. `--wasmGc --sharedMemory` compiles and exports no arena entry point.

## Out of scope, deliberately

This round parametrizes the runtime and nothing else. There is no `__startThread`, no thread spawn,
no change to the async lowering, the await site, `TaskPolicy`, the ring or the executor, and no change
to `--sharedMemory` semantics.
