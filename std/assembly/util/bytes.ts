export function REVERSE<T>(ptr: usize, len: usize): void {
  if (len > 1) {
    let
      i: usize = 0,
      tail: usize,
      hlen: usize = len >> 1;

    if (ASC_SHRINK_LEVEL < 1) {
      if (sizeof<T>() == 1) {
        // TODO: Decide later: Does we need this fast path cases?
        //
        // if (len == 4) {
        //   store<u32>(ptr, bswap(load<u32>(ptr)));
        //   return;
        // }
        // if (len == 8) {
        //   store<u64>(ptr, bswap(load<u64>(ptr)));
        //   return;
        // }
        tail = len - 8;
        while (i + 7 < hlen) {
          let front = ptr + i;
          let back  = ptr + tail - i;
          let temp  = bswap(load<u64>(front));
          store<u64>(front, bswap(load<u64>(back)));
          store<u64>(back, temp);
          i += 8;
        }
      }

      if (sizeof<T>() == 2) {
        tail = len - 2;
        while (i + 1 < hlen) {
          let front = ptr + (i << 1);
          let back  = ptr + (tail - i << 1);
          let temp  = rotr(load<u32>(back), 16);
          store<u32>(back, rotr(load<u32>(front), 16));
          store<u32>(front, temp);
          i += 2;
        }
      }
    }

    tail = len - 1;
    while (i < hlen) {
      let front = ptr + (i << alignof<T>());
      let back  = ptr + (tail - i << alignof<T>());
      let temp  = load<T>(front);
      store<T>(front, load<T>(back));
      store<T>(back, temp);
      i++;
    }
  }
}

export function FILL<T>(
  ptr: usize,
  len: usize,
  value: T,
  start: isize,
  end: isize
): void {
  start = start < 0 ? max(len + start, 0) : min(start, len);
  end   = end   < 0 ? max(len + end,   0) : min(end,   len);

  if (sizeof<T>() == 1) {
    if (start < end) {
      memory.fill(
        ptr + <usize>start,
        u8(value),
        <usize>(end - start)
      );
    }
  } else {
    if (ASC_SHRINK_LEVEL <= 1) {
      if (isInteger<T>()) {
        // @ts-ignore
        if (value == <T>0 | value == <T>-1) {
          if (start < end) {
            memory.fill(
              ptr + (<usize>start << alignof<T>()),
              u8(value),
              <usize>(end - start) << alignof<T>()
            );
          }
          return;
        }
      } else if (isFloat<T>()) {
        // for floating non-negative zeros we can use fast memory.fill
        if ((sizeof<T>() == 4 && reinterpret<u32>(f32(value)) == 0) ||
            (sizeof<T>() == 8 && reinterpret<u64>(f64(value)) == 0)) {
          if (start < end) {
            memory.fill(
              ptr + (<usize>start << alignof<T>()),
              0,
              <usize>(end - start) << alignof<T>()
            );
          }
          return;
        }
      }
    }
    for (; start < end; ++start) {
      store<T>(ptr + (<usize>start << alignof<T>()), value);
    }
  }
}

/**
 * Copies one `T`-layout value: `dst` receives `offsetof<T>()` bytes from `src`.
 *
 * **This is the struct copy.** `store<T>(ptr, value)` is not one: `T`'s byte
 * size is the size of a `T`-*typed value*, which for a class is one reference,
 * so `store<T>` writes one word. `offsetof<T>()` is the layout size — the sum
 * of the fields with inter-field alignment, and the same number the compiler
 * passes to `__alloc` for an `@unmanaged` class — which is what a copy of the
 * whole record needs.
 *
 * Both arguments are addresses. For an `@unmanaged` class `v`, that is
 * `changetype<usize>(v)`; the copy is a byte move, so the destination must hold
 * `offsetof<T>()` bytes and the two regions must not require the allocator's
 * bookkeeping (this neither links nor traces — it is the wire's copy, for
 * memory the guest addresses directly).
 *
 * `T` may be a managed class: its layout is its fields' layout, and
 * `offsetof<T>()` reports it (measured: 32 for the eight `i32`/`f32` fields of
 * `TaskRecord`). What the copy cannot do is make the destination a *traced*
 * reference — so a managed record copied into a raw buffer is the caller's
 * responsibility, exactly as `memory.copy` always is.
 */
// @ts-ignore: decorator
@inline
export function COPY_STRUCT<T>(dst: usize, src: usize): void {
  memory.copy(dst, src, offsetof<T>());
}
