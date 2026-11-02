# The C ABI for `@unmanaged @dynamic [T * n]`

This is the **external interop contract** for TensionScript's dynamic arrays.
The compiler uses its own internal types; `include/tension/` publishes what
outside code needs to build buffers that a guest accepts, and to read buffers
a guest produces. Same posture as the engine's async/wakeup contract: one side
publishes, the other consumes, and neither reaches into the other's
representation.

Audience: C programs, C++ engines via an adapter, WASI hosts, wasmtime
embedders — anything that is not the compiler.

## The layout

A dynamic array is **one pointer**. Not a struct passed by value, not a
two-word (pointer, length) pair: the length lives in the buffer it points at.

```
   header pointer ─┐
                   ▼
                 ┌────────────┬─────────────┬─────────┬─────────┬─────┐
                 │ uint32 len │  padding    │ data[0] │ data[1] │ ... │
                 └────────────┴─────────────┴─────────┴─────────┴─────┘
   offset          0            4 .. H-1       H        H+sizeof(T)
```

`H = align_up(4, alignof(T))` — the length word is the floor, and a stricter
element alignment raises it:

- `alignof(T) <= 4` → `H = 4`. Covers `u8`/`u16`/`u32`/`i32`/`f32`, and
  `Vec3f` (12 bytes, align 4).
- `alignof(T) == 8` → `H = 8`. Covers `u64`/`i64`/`f64`, and `BodyState`
  (32 bytes, align 8). The four bytes after the length are padding and must be
  zero.
- `alignof(T) > 8` — not applicable today. WASM has no scalar wider than 8
  bytes except `v128`, and `v128` elements are not admitted.

Every element sits at exactly `alignof(T)`, which is what makes a plain
`memcpy` of a whole record valid under `-fsanitize=alignment`.

## The three rules

1. **Length is `uint32`, little-endian, at offset 0.** WASM is little-endian
   natively, so there is no swapping at the boundary. A conforming producer
   never writes a length above `TENSION_DYNAMIC_ARRAY_MAX_LEN` (2 147 483 647);
   TensionScript traps when such a header enters its type system, so values in
   `[2^31, 2^32)` are out of contract rather than merely unusual.

2. **Padding is `align_up(4, alignof(T))`.** This is the whole formula. A
   producer that lays elements out at `offset 4` regardless of alignment shifts
   every `f64` element by four bytes, and the guest reads them misaligned.

3. **Ownership is the caller's.** The caller allocates and frees. TensionScript
   reads and writes elements and never owns the buffer — which is also why it
   refuses GC-managed element types: an unscanned buffer cannot hold a root.

## Using it

```c
#include "tension/dynamic_array.h"
#include "tension/ogre/bodystate.h"

/* 10 bodies, header 8 + 10 * 32 = 328 bytes */
size_t bytes = TENSION_DYNAMIC_ARRAY_SIZE(TensionBodyState, 10);
void *buf = malloc(bytes);
memset(buf, 0, bytes);                  /* padding must be zero */

TENSION_DYNAMIC_ARRAY_SET_LEN(buf, 10); /* the length word */

TensionBodyState *bodies = TENSION_DYNAMIC_ARRAY_DATA(TensionBodyState, buf);
bodies[3].x  = 1.0;
bodies[3].y  = 2.0;
bodies[3].vx = 0.0;
bodies[3].vy = 0.0;

/* hand `buf` — the header pointer, not `bodies` — to the guest */
extern void step(void *bodies_header, int32_t n);
step(buf, 10);

free(buf);
```

The value passed across the boundary is the **header** pointer. `bodies` is a
derived convenience, not the ABI value.

`TENSION_DYNAMIC_ARRAY_LEN` reads the length; `TENSION_DYNAMIC_ARRAY_SET_LEN`
writes it. Both are needed — a contract that could only read the length would
describe buffers but not let anyone build one.

### The struct spellings are C only

`TensionVec3fDynamicArray` and `TensionBodyStateDynamicArray` end in a flexible
array member (`data[]`). C11 has them; **C++ does not**, and `-Wpedantic`
rejects them, so those two typedefs exist only when not compiling as C++. C++
consumers use the macros, which are the common surface and carry no such
caveat. The header-size assertions hold in both languages; the `offsetof` ones
against the struct spelling are C-only.

## Adding a type

Copy `include/tension/ogre/vec3f.h` and change the fields. Two assertions
carry the weight, and both must match what TensionScript reports for the same
struct:

```c
TS_STATIC_ASSERT(sizeof(YourType) == N, "...");
TS_STATIC_ASSERT(TS_ALIGNOF(YourType) == A, "...");
```

Get `N` and `A` from the compiler, not from arithmetic you did by hand — an
extra `bool` or a field-order change moves them:

```ts
// in TensionScript
export function s(): u32 { return offsetof<YourType>(); }
export function a(): u32 { return alignof<YourType>(); }
```

`offsetof<T>()` is the extent for an `@unmanaged struct`; `sizeof<T>()` is not
(the compiler answers the 4-byte reference there), which is why the engine's own
solver code uses `offsetof` for its stride constants.

## How this evolves

`TENSION_DYNAMIC_ARRAY_ABI_VERSION` is `1`. It bumps only on a **breaking**
change to the layout or the call convention. Additive changes — a new per-type
header — do not bump it, because an existing consumer cannot observe them.

The version is a compile-time constant, not a runtime field. There is no room in
the buffer for one: the length word is at offset 0 and the data follows it.
A future incompatible layout would add a second header file rather than a
second field.

## Scope and deferral

**Per-type headers are hand-written today.** They are reference instances, not
generated output. Six records exist in `schema/ogre.json` and more will follow;
hand-copying each one does not scale.

Generation already exists for the *engine*: `Tension/tools/codegen/generate.mjs`
reads `schema/ogre.json` and emits `tension-ogre/src/generated/ogre.generated.h`.
That header is **C++-only** (`<cstddef>`, `<cstdint>`, `namespace tension_ogre`,
default member initialisers), so it does not serve the C and WASI audience this
directory is for. The two describe the same bytes with different spellings —
`Vec3fValue` in namespace `tension_ogre` there, `TensionVec3f` here.

Generating *these* headers from the same schema is the follow-on: one schema,
two emitters, no hand-copying. Until then, treat a new per-type header here as
requiring the same review as a schema change, because that is what it is.

## What is not covered

- **Producing a buffer from TensionScript.** Returning a dynamic array is still
  refused by the compiler — there is no allocation path for the header. A guest
  can read and write a caller's buffer; it cannot make one yet.
- **`@managed @dynamic`.** Not implemented. These headers describe the unmanaged
  (C-compatible) form only.
- **A capacity separate from length.** There is one word. A growable array needs
  a reallocating owner, which is a different contract.
