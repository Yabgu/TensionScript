// Alignment guarantees

// @ts-ignore: decorator
@inline export const AL_BITS: u32 = 4; // 16 bytes to fit up to v128
// @ts-ignore: decorator
@inline export const AL_SIZE: usize = 1 << <usize>AL_BITS;
// @ts-ignore: decorator
@inline export const AL_MASK: usize = AL_SIZE - 1;

// Extra debugging

// @ts-ignore: decorator
@inline export const DEBUG = true;
// @ts-ignore: decorator
@inline export const TRACE = false;
// @ts-ignore: decorator
@inline export const RTRACE = isDefined(ASC_RTRACE);
// @ts-ignore: decorator
@inline export const PROFILE = isDefined(ASC_PROFILE);

/**
 * `--sharedMemory`: the runtime may be pointed at a per-instance arena. Folds at
 * compile time, so every `ARENA ? arena : __heap_base` below emits the plain
 * `__heap_base` read — byte for byte the pre-arena module — when it is off.
 */
// @ts-ignore: decorator
@inline export const ARENA: bool = isDefined(ASC_ARENA);

// Memory manager

// ╒════════════ Memory manager block layout (32-bit) ═════════════╕
//    3                   2                   1
//  1 0 9 8 7 6 5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0  bits
// ├─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┤
// │                           MM info                             │ -4
// ╞>ptr═══════════════════════════════════════════════════════════╡
// │                              ...                              │
@unmanaged export class BLOCK {
  /** Memory manager info. */
  mmInfo: usize;
}

/** Overhead of a memory manager block. */
// @ts-ignore: decorator
@inline export const BLOCK_OVERHEAD: usize = offsetof<BLOCK>();

/** Maximum size of a memory manager block's payload. */
// @ts-ignore: decorator
@inline export const BLOCK_MAXSIZE: usize = (1 << 30) - BLOCK_OVERHEAD;

// Garbage collector

// ╒══════════ Garbage collector object layout (32-bit) ═══════════╕
//    3                   2                   1
//  1 0 9 8 7 6 5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0 9 8 7 6 5 4 3 2 1 0  bits
// ├─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┤
// │                     Memory manager block                      │ -20
// ╞═══════════════════════════════════════════════════════════════╡
// │                            GC info                            │ -16
// ├───────────────────────────────────────────────────────────────┤
// │                            GC info                            │ -12
// ├───────────────────────────────────────────────────────────────┤
// │                            RT id                              │ -8
// ├───────────────────────────────────────────────────────────────┤
// │                            RT size                            │ -4
// ╞>ptr═══════════════════════════════════════════════════════════╡
// │                              ...                              │
@unmanaged export class OBJECT extends BLOCK {
  /** Garbage collector info. */
  gcInfo: u32;
  /** Garbage collector info. */
  gcInfo2: u32;
  /** Runtime class id. */
  rtId: u32;
  /** Runtime object size. */
  rtSize: u32;
}

/** Overhead of a garbage collector object. Excludes memory manager block overhead. */
// @ts-ignore: decorator
@inline export const OBJECT_OVERHEAD: usize = (offsetof<OBJECT>() - BLOCK_OVERHEAD + AL_MASK) & ~AL_MASK;

/** Maximum size of a garbage collector object's payload. */
// @ts-ignore: decorator
@inline export const OBJECT_MAXSIZE: usize = BLOCK_MAXSIZE - OBJECT_OVERHEAD;

/** Total of memory manager and garbage collector overhead. */
// @ts-ignore: decorator
@inline export const TOTAL_OVERHEAD: usize = BLOCK_OVERHEAD + OBJECT_OVERHEAD;

// Arenas
//
// An **arena** is a `[base, end)` span of linear memory that owns its own
// allocator state, its own collector state and its own stack region. A shared
// memory lets several instances (threads) address one buffer, but a store's
// stack is not visible from another store, so the runtime cannot stop the world
// across them: `visitStack` would miss thread B's roots and sweep live objects.
// One heap per thread is the answer, and an arena is what that heap is.
//
// Under `--sharedMemory` (`ASC_ARENA`) the heap base every part of the runtime
// consults is `HEAP_BASE` instead of `__heap_base`; it starts out equal to
// `__heap_base`, so a module whose host never calls `__arenaInit` spans the whole
// memory exactly as it always did. The switch folds at compile time, so a build
// that does not share memory emits the module it emitted before arenas existed.

/** End of this instance's arena. 0 until an arena is configured. */
// @ts-ignore: decorator
@lazy export let ARENA_END: usize = 0;
/**
 * Heap base in effect: the arena's once one is configured, `__heap_base`
 * otherwise. Everything that used to ask `__heap_base` asks this instead, so the
 * invariant `visitStack` relies on — live stack in `[__stack_pointer, HEAP_BASE)`
 * — holds inside an arena exactly as it holds outside one.
 */
// @ts-ignore: decorator
@lazy export let HEAP_BASE: usize = __heap_base;

/**
 * Whether `ptr` lies outside this instance's arena. False while no arena is
 * configured, which is what keeps the default path's collector exactly as it was
 * — and true for every byte the arena does not own once one is, so the collector
 * can refuse to follow a pointer it must not look at (a root that outlived the
 * arena it was allocated in, say) instead of trusting it.
 */
export function outsideArena(ptr: usize): bool {
  let end = ARENA_END;
  return end != 0 && (HEAP_BASE > ptr || ptr >= end);
}

/** Heap base this instance allocates above right now. */
// @ts-ignore: decorator
@global
export function __arenaHeapBase(): usize {
  return HEAP_BASE;
}

/** End of this instance's arena, or 0 when the runtime spans the whole memory. */
// @ts-ignore: decorator
@global
export function __arenaEnd(): usize {
  return ARENA_END;
}

/**
 * The smallest arena this runtime will accept: room for the TLSF root (about
 * 716 bytes on wasm32) and one usable block.
 */
// @ts-ignore: decorator
@inline const MIN_ARENA_HEAP: usize = 1024;

/**
 * Computes the layout inside `[base, base + size)` and records it, answering the
 * arena's heap base. The region mirrors the default layout — the stack region at
 * the bottom, sized as this module's `--stackSize` sized it, then the heap — so
 * `visitStack`'s window `[__stack_pointer, HEAP_BASE)` covers exactly this
 * instance's stack and nothing else.
 *
 * A module with no stack region (`__stack_pointer == __heap_base`, which is what
 * a runtime that never spills emits) gets an empty one, and the window is
 * zero-width exactly as it is outside an arena — never a stack below the base.
 *
 * Traps rather than silently shrinking the stack: a caller that hands over less
 * room than this module's own stack needs cannot be given a correct arena.
 */
export function enterArena(base: usize, size: usize): usize {
  let start = (base + AL_MASK) & ~AL_MASK;
  let end = (base + size) & ~AL_MASK;
  let reserve = __heap_base - __data_end; // the stack region the default layout gives this module
  let heap = (start + reserve + AL_MASK) & ~AL_MASK;
  if (end < heap + MIN_ARENA_HEAP) unreachable();
  ARENA_END = end;
  HEAP_BASE = heap;
  return heap;
}
