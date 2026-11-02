// TensionScript dynamic array ABI, version 1
//
// This header publishes the ABI for `@unmanaged @dynamic [T * n]` arrays as
// consumed and produced by TensionScript. External code — C programs, C++
// game engines via an adapter, WASI hosts, wasmtime embedders — includes this
// header to construct buffers that TensionScript functions accept, and to
// interpret buffers that TensionScript produces.
//
// Layout (little-endian; WASM native, so no byte swapping at the boundary):
//
//   offset 0:              uint32_t length
//   offset 4 .. H-1:       zero padding, to alignof(T)
//   offset H:              T data[0]
//   offset H + sizeof(T):  T data[1]
//   ...
//
//   where H = align_up(4, alignof(T)):
//     alignof(T) <= 4  ->  H = 4   (u8, u16, u32, i32, f32, a 12-byte Vec3f)
//     alignof(T) == 8  ->  H = 8   (u64, i64, f64, a 32-byte four-f64 record)
//
// The value TensionScript passes and receives is **one pointer** — the address
// of the length word, not of the data. That is the whole ABI on the call side;
// everything else is this layout.
//
// Ownership: the caller allocates the buffer and is responsible for freeing it.
// TensionScript reads and writes elements but does not own the memory. Nothing
// in this ABI transfers ownership, and nothing in it asks the caller to
// register the buffer with a collector — the TensionScript side refuses
// GC-managed element types precisely because these buffers are unscanned.
//
// Length upper bound: TENSION_DYNAMIC_ARRAY_MAX_LEN (2,147,483,647). The field
// is a `uint32_t`, but TensionScript rejects a length above `INT32_MAX` when a
// header pointer enters the type system, so a conforming producer never writes
// one. Values in [2^31, 2^32) are out of contract.
//
// Total byte size for a buffer of n elements: H + n * sizeof(T), computed by
// TENSION_DYNAMIC_ARRAY_SIZE(T, n).
//
// The mirror of this contract on the compiler side is
// `Compiler#dynamicArrayHeaderSize` and `Compiler#compileDynamicArrayElementAddress`
// (`src/compiler.ts`); the static asserts below are what keep the two honest.

#ifndef TENSION_DYNAMIC_ARRAY_H
#define TENSION_DYNAMIC_ARRAY_H

#include <stddef.h>
#include <stdint.h>

// Portability shim for alignof and static assertions across C11 / C++ / the
// GCC and Clang extensions. The C11 branch is the one the compile gate
// exercises under `-std=c11`; the C++ branch under `-std=c++17`.
#if defined(__cplusplus)
  #define TS_ALIGNOF(T) alignof(T)
  #define TS_STATIC_ASSERT(c, m) static_assert(c, m)
#elif defined(__STDC_VERSION__) && __STDC_VERSION__ >= 201112L
  #define TS_ALIGNOF(T) _Alignof(T)
  #define TS_STATIC_ASSERT(c, m) _Static_assert(c, m)
#elif defined(__GNUC__) || defined(__clang__)
  #define TS_ALIGNOF(T) __alignof__(T)
  #define TS_STATIC_ASSERT(c, m) _Static_assert(c, m)
#else
  #error "TensionScript headers require C11, C++, or the GCC/Clang extensions"
#endif

/// Bumped only by a breaking change to the layout or the call convention.
#define TENSION_DYNAMIC_ARRAY_ABI_VERSION 1

/// Largest length a conforming producer writes. TensionScript traps above this.
#define TENSION_DYNAMIC_ARRAY_MAX_LEN 0x7FFFFFFF

/// Header size = align_up(4, alignof(T)).
#define TENSION_DYNAMIC_ARRAY_HEADER_SIZE(T) \
    ((size_t)(((4 + TS_ALIGNOF(T) - 1) / TS_ALIGNOF(T)) * TS_ALIGNOF(T)))

/// Total byte size of a buffer holding `n` elements of `T`.
#define TENSION_DYNAMIC_ARRAY_SIZE(T, n) \
    (TENSION_DYNAMIC_ARRAY_HEADER_SIZE(T) + (size_t)(n) * sizeof(T))

/// Element pointer (T*) from a header pointer.
#define TENSION_DYNAMIC_ARRAY_DATA(T, hdr) \
    ((T*)((char*)(hdr) + TENSION_DYNAMIC_ARRAY_HEADER_SIZE(T)))

/// Length from a header pointer. The header is a uint32_t by contract, so this
/// read is not a reinterpretation of someone else's object.
#define TENSION_DYNAMIC_ARRAY_LEN(hdr) \
    (((const uint32_t*)(hdr))[0])

/// Set the length word of a header. The caller owns the buffer, so the caller
/// writes its length; a producer that cannot write this field cannot construct
/// a buffer at all.
///
/// No range check here: a macro cannot report a failure, and aborting from a
/// header is not this layer's business. `n` must be within
/// TENSION_DYNAMIC_ARRAY_MAX_LEN or the guest's `changetype` will trap — which
/// is a refusal, not a misread, so the failure is safe if late.
#define TENSION_DYNAMIC_ARRAY_SET_LEN(hdr, n) \
    (((uint32_t*)(hdr))[0] = (uint32_t)(n))

// --- elementary layout sanity ---------------------------------------------
//
// These are the two header sizes the compiler emits. If either fails, this
// header and `Compiler#dynamicArrayHeaderSize` have diverged and no buffer
// built with it is safe to hand to a guest.

TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_HEADER_SIZE(uint32_t) == 4,
                 "u32 dynamic array header size must be 4");
TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_HEADER_SIZE(uint64_t) == 8,
                 "u64 dynamic array header size must be 8");
TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_HEADER_SIZE(uint8_t) == 4,
                 "u8 dynamic array header size must be 4");
TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_HEADER_SIZE(double) == 8,
                 "double dynamic array header size must be 8");

#endif  // TENSION_DYNAMIC_ARRAY_H
