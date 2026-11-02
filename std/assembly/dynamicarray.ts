/// <reference path="./rt/index.d.ts" />

/**
 * The descriptor behind `@managed @dynamic [T * n]`.
 *
 * A managed dynamic array is a **GC reference** to one of these, so the value is
 * traced, rooted and nullable exactly like any other class reference. That is
 * the whole reason this is a class rather than a compiler-internal `Type` with
 * a "managed" flag: a `TypeKind.DynamicArray` carries `TypeFlags.None`, which
 * makes `Type#isManaged` answer false (`types.ts`), which makes the collector
 * skip a local holding it. The buffer would then be freed under a live
 * descriptor — use-after-free by construction.
 *
 * Layout note: the **data buffer is bare**. It has no length header, unlike
 * `@unmanaged @dynamic [T * n]`, because this descriptor owns the length. So
 * `y[i]` is `dataPtr + i*sizeof(T)`, with no header offset — the opposite of the
 * unmanaged form, where the buffer describes itself so that C can build one.
 *
 * Two layouts, one syntax family, differing only by memory model. That is
 * deliberate: `@unmanaged` is the self-describing C-facing form, `@managed` is
 * the GC-traced form whose length travels in this object. Putting a header in
 * front of the data as well would give one length two sources of truth.
 *
 * This class is not meant to be constructed by user code. Landing 4d.1 makes
 * `@managed @dynamic [T * n]` **resolve** to it; construction (the two-argument
 * `changetype`) and indexing are Landing 4d.2.
 */
@final
export class DynamicArray<T> {
  /** Address of the first element. Caller-owned; not traced. */
  dataPtr: usize;
  /** Number of elements. Read as a class field, so no header load. */
  length: u32;

  constructor(dataPtr: usize, length: u32) {
    this.dataPtr = dataPtr;
    this.length = length;
  }
}
