import { ArrayBufferView } from "./arraybuffer";
import { E_INDEXOUTOFRANGE } from "./util/error";

export namespace Atomics {

  // @ts-ignore: decorator
  @inline
  export function load<T extends ArrayBufferView>(array: T, index: i32): valueof<T> {
    const align = alignof<valueof<T>>();
    if (index < 0 || (index << align) >= array.byteLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return atomic.load<valueof<T>>(
      changetype<usize>(array.buffer) + (index << align) + array.byteOffset
    );
  }

  // @ts-ignore: decorator
  @inline
  export function store<T extends ArrayBufferView>(array: T, index: i32, value: valueof<T>): void {
    const align = alignof<valueof<T>>();
    if (index < 0 || (index << align) >= array.byteLength) throw new RangeError(E_INDEXOUTOFRANGE);
    atomic.store<valueof<T>>(
      changetype<usize>(array.buffer) + (index << align) + array.byteOffset,
      value
    );
  }

  // @ts-ignore: decorator
  @inline
  export function add<T extends ArrayBufferView>(array: T, index: i32, value: valueof<T>): valueof<T> {
    const align = alignof<valueof<T>>();
    if (index < 0 || (index << align) >= array.byteLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return atomic.add<valueof<T>>(
      changetype<usize>(array.buffer) + (index << align) + array.byteOffset,
      value
    );
  }

  // @ts-ignore: decorator
  @inline
  export function sub<T extends ArrayBufferView>(array: T, index: i32, value: valueof<T>): valueof<T> {
    const align = alignof<valueof<T>>();
    if (index < 0 || (index << align) >= array.byteLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return atomic.sub<valueof<T>>(
      changetype<usize>(array.buffer) + (index << align) + array.byteOffset,
      value
    );
  }

  // @ts-ignore: decorator
  @inline
  export function and<T extends ArrayBufferView>(array: T, index: i32, value: valueof<T>): valueof<T> {
    const align = alignof<valueof<T>>();
    if (index < 0 || (index << align) >= array.byteLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return atomic.and<valueof<T>>(
      changetype<usize>(array.buffer) + (index << align) + array.byteOffset,
      value
    );
  }

  // @ts-ignore: decorator
  @inline
  export function or<T extends ArrayBufferView>(array: T, index: i32, value: valueof<T>): valueof<T> {
    const align = alignof<valueof<T>>();
    if (index < 0 || (index << align) >= array.byteLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return atomic.or<valueof<T>>(
      changetype<usize>(array.buffer) + (index << align) + array.byteOffset,
      value
    );
  }

  // @ts-ignore: decorator
  @inline
  export function xor<T extends ArrayBufferView>(array: T, index: i32, value: valueof<T>): valueof<T> {
    const align = alignof<valueof<T>>();
    if (index < 0 || (index << align) >= array.byteLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return atomic.xor<valueof<T>>(
      changetype<usize>(array.buffer) + (index << align) + array.byteOffset,
      value
    );
  }

  // @ts-ignore: decorator
  @inline
  export function exchange<T extends ArrayBufferView>(array: T, index: i32, value: valueof<T>): valueof<T> {
    const align = alignof<valueof<T>>();
    if (index < 0 || (index << align) >= array.byteLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return atomic.xchg<valueof<T>>(
      changetype<usize>(array.buffer) + (index << align) + array.byteOffset,
      value
    );
  }

  // @ts-ignore: decorator
  @inline
  export function compareExchange<T extends ArrayBufferView>(
    array: T,
    index: i32,
    expectedValue: valueof<T>,
    replacementValue: valueof<T>
  ): valueof<T> {
    const align = alignof<valueof<T>>();
    if (index < 0 || (index << align) >= array.byteLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return atomic.cmpxchg<valueof<T>>(
      changetype<usize>(array.buffer) + (index << align) + array.byteOffset,
      expectedValue,
      replacementValue
    );
  }

  // @ts-ignore: decorator
  @inline
  export function wait<T extends ArrayBufferView>(array: T, value: valueof<T>, timeout: i64 = -1): AtomicWaitResult {
    return atomic.wait<valueof<T>>(changetype<usize>(array.buffer) + array.byteOffset, value, timeout);
  }

  // @ts-ignore: decorator
  @inline
  export function notify<T extends ArrayBufferView>(array: T, index: i32, count: i32 = -1): i32 {
    const align = alignof<valueof<T>>();
    if (index < 0 || (index << align) >= array.byteLength) throw new RangeError(E_INDEXOUTOFRANGE);
    return atomic.notify(changetype<usize>(array.buffer) + (index << align) + array.byteOffset, count);
  }

  export function isLockFree(size: usize): bool {
    return size == 1 || size == 2 || size == 4;
  }

  /**
   * A sequentially consistent full fence: no memory operation before it may be
   * reordered with one after it.
   *
   * The exception to the index shape above, because a fence has no address — it
   * orders *all* of this agent's accesses, so there is nothing to point at. This
   * is also the one member absent from the address-facing surface below (a
   * `atomicFence` there would be the same function under a second name).
   */
  // @ts-ignore: decorator
  @inline
  export function fence(): void {
    atomic.fence();
  }
}

// === Address-facing surface ===============================================================
//
// `Atomics.*` above takes an `ArrayBufferView` because that is the JavaScript shape: an
// index into a view, bounds-checked, with the address derived from `buffer`/`byteOffset`.
// Runtime code and C interop do not hold views — they hold an **address**, usually one
// handed over by the host or produced by `changetype<usize>(...)` — and building a view to
// pass an address to `Atomics` is not possible without inventing a length.
//
// So these take the `usize` the builtin `atomic.*` takes and forward it with **no**
// arithmetic, no bounds check and no conversion: exactly the builtin's semantics, under
// names a reader can find. Everything the builtins offer is here, one function per
// builtin, so a caller never has to reason about which layer it is calling into.
//
// **The read-modify-write family returns the OLD value.** That is what `i32.atomic.rmw.add`
// and its siblings compute in wasm, it is what `atomic.add` returns, and it is what these
// return — `atomicAdd<T>(p, 1)` yields the value the location held *before* the add. The
// new value is the old one plus the delta, and a caller that wants it computes it; nothing
// here silently switches to the other convention.
//
// **The pointer is not checked and not dereferenced by the compiler.** A wrong address is a
// trap or a write into the wrong object, exactly as with `atomic.load` — these functions
// remove the *view*, not the responsibility. Naming that here is the point: the surface is
// not unsafe because it is hidden, it is unsafe because addresses are.

/** Atomically loads an integer value from `ptr` and returns it. */
// @ts-ignore: decorator
@inline
export function atomicLoad<T>(ptr: usize): T {
  return atomic.load<T>(ptr);
}

/** Atomically stores `value` at `ptr`. */
// @ts-ignore: decorator
@inline
export function atomicStore<T>(ptr: usize, value: T): void {
  atomic.store<T>(ptr, value);
}

/** Atomically adds `value` at `ptr` and returns the **old** value. */
// @ts-ignore: decorator
@inline
export function atomicAdd<T>(ptr: usize, value: T): T {
  return atomic.add<T>(ptr, value);
}

/** Atomically subtracts `value` at `ptr` and returns the **old** value. */
// @ts-ignore: decorator
@inline
export function atomicSub<T>(ptr: usize, value: T): T {
  return atomic.sub<T>(ptr, value);
}

/** Atomically ANDs `value` into `ptr` and returns the **old** value. */
// @ts-ignore: decorator
@inline
export function atomicAnd<T>(ptr: usize, value: T): T {
  return atomic.and<T>(ptr, value);
}

/** Atomically ORs `value` into `ptr` and returns the **old** value. */
// @ts-ignore: decorator
@inline
export function atomicOr<T>(ptr: usize, value: T): T {
  return atomic.or<T>(ptr, value);
}

/** Atomically XORs `value` into `ptr` and returns the **old** value. */
// @ts-ignore: decorator
@inline
export function atomicXor<T>(ptr: usize, value: T): T {
  return atomic.xor<T>(ptr, value);
}

/** Atomically exchanges `value` at `ptr` and returns the **old** value. */
// @ts-ignore: decorator
@inline
export function atomicExchange<T>(ptr: usize, value: T): T {
  return atomic.xchg<T>(ptr, value);
}

/**
 * Atomically compares the value at `ptr` with `expect` and, only if equal, replaces it
 * with `replace`. Returns the value the location held before the operation — which equals
 * `expect` when the exchange happened, so `atomicCompareExchange(p, e, r) == e` is the
 * "it succeeded" test.
 */
// @ts-ignore: decorator
@inline
export function atomicCompareExchange<T>(ptr: usize, expect: T, replace: T): T {
  return atomic.cmpxchg<T>(ptr, expect, replace);
}

/** A sequentially consistent full fence. See `Atomics.fence`. */
// @ts-ignore: decorator
@inline
export function atomicFence(): void {
  atomic.fence();
}

/**
 * Blocks this agent while the value at `ptr` still equals `expect`, or until `timeout`
 * (nanoseconds, `-1` for no timeout) elapses. Returns why it returned: `OK` (notified),
 * `NOT_EQUAL` (the value was not `expect`), or `TIMED_OUT`.
 */
// @ts-ignore: decorator
@inline
export function atomicWait<T>(ptr: usize, expect: T, timeout: i64 = -1): AtomicWaitResult {
  return atomic.wait<T>(ptr, expect, timeout);
}

/** Wakes up to `count` agents waiting on `ptr` (`-1` for all of them). Returns the count woken. */
// @ts-ignore: decorator
@inline
export function atomicNotify(ptr: usize, count: i32 = -1): i32 {
  return atomic.notify(ptr, count);
}
