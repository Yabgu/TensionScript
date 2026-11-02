// Compile-time verification that the published headers match the ABI the
// TensionScript compiler emits.
//
// Nothing here runs: every claim is a `TS_STATIC_ASSERT`, so a divergence is a
// build failure rather than a wrong number at runtime. That is deliberate — a
// buffer built against a stale header is not something a runtime check can
// rescue, because the guest reads it at the offsets *it* believes in.
//
// The two gates this file must pass:
//
//   gcc -std=c11   -I include -fsyntax-only tests/headers/compile-check.c
//   c++ -std=c++17 -I include -fsyntax-only tests/headers/compile-check.c
//
// `scripts/check-headers.sh` runs both, plus `-Wall -Wextra -pedantic`.

#include "tension/dynamic_array.h"
#include "tension/ogre/bodystate.h"
#include "tension/ogre/vec3f.h"

// --- the generic formula ---------------------------------------------------
//
// These four lines are the whole contract: header size is align_up(4, alignof).
// A producer that computes anything else writes a buffer the guest misreads.

TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_HEADER_SIZE(uint8_t) == 4, "u8 header");
TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_HEADER_SIZE(uint32_t) == 4, "u32 header");
TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_HEADER_SIZE(uint64_t) == 8, "u64 header");
TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_HEADER_SIZE(double) == 8, "f64 header");

TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_ABI_VERSION == 1, "ABI version");
TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_MAX_LEN == 2147483647, "length bound");

// --- total buffer sizes ----------------------------------------------------
//
// Vec3f: header 4, element 12. A 10-element buffer is 4 + 120 = 124 bytes.
// BodyState: header 8, element 32. A 10-element buffer is 8 + 320 = 328 bytes.

TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_SIZE(TensionVec3f, 10) == 124,
                 "Vec3f[10] total size");
TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_SIZE(TensionBodyState, 10) == 328,
                 "BodyState[10] total size");

// --- Vec3f: 12 bytes, aligned 4, data at 4 ---------------------------------

TS_STATIC_ASSERT(sizeof(TensionVec3f) == 12, "Vec3f size");
TS_STATIC_ASSERT(TS_ALIGNOF(TensionVec3f) == 4, "Vec3f align");
#if !defined(__cplusplus)
TS_STATIC_ASSERT(offsetof(TensionVec3fDynamicArray, data) == 4, "Vec3f data offset");
#endif

// --- BodyState: 32 bytes, aligned 8, data at 8 -----------------------------
//
// The offsets are the ones the collision solver indexes with (`(i << 5)`, plus
// the per-field constants 0/8/16/24), so this is the header agreeing with the
// engine rather than with a document about it.

TS_STATIC_ASSERT(sizeof(TensionBodyState) == 32, "BodyState size");
TS_STATIC_ASSERT(TS_ALIGNOF(TensionBodyState) == 8, "BodyState align");
TS_STATIC_ASSERT(offsetof(TensionBodyState, x) == 0, "BodyState.x");
TS_STATIC_ASSERT(offsetof(TensionBodyState, y) == 8, "BodyState.y");
TS_STATIC_ASSERT(offsetof(TensionBodyState, vx) == 16, "BodyState.vx");
TS_STATIC_ASSERT(offsetof(TensionBodyState, vy) == 24, "BodyState.vy");
#if !defined(__cplusplus)
TS_STATIC_ASSERT(offsetof(TensionBodyStateDynamicArray, data) == 8, "BodyState data offset");
#endif

// --- the macros and the structs must agree --------------------------------
//
// If the struct form and the computed form ever disagreed, a caller could
// allocate with one and index with the other.

// The struct spelling is C only (a trailing `data[]` is a flexible array
// member), so these two agreement checks are too. The formula's own value is
// asserted above in both languages.
#if !defined(__cplusplus)
TS_STATIC_ASSERT(offsetof(TensionBodyStateDynamicArray, data) ==
                 TENSION_DYNAMIC_ARRAY_HEADER_SIZE(TensionBodyState),
                 "BodyState header agrees with the formula");

TS_STATIC_ASSERT(offsetof(TensionVec3fDynamicArray, data) ==
                 TENSION_DYNAMIC_ARRAY_HEADER_SIZE(TensionVec3f),
                 "Vec3f header agrees with the formula");
#endif

// --- the macros are usable, not just well-typed ---------------------------
//
// A static assert can check arithmetic; it cannot check that a macro produces an
// assignable lvalue. So `main` uses the accessors the way a consumer would: the
// length is written by the producer and read back, and the data pointer is
// derived from the header. This compiles or it does not — and if
// `TENSION_DYNAMIC_ARRAY_SET_LEN` regressed to a read-only expression, this is
// the only thing that would notice.
int main(void) {
    static unsigned char storage[TENSION_DYNAMIC_ARRAY_SIZE(TensionVec3f, 2)];
    void *buf = storage;

    TENSION_DYNAMIC_ARRAY_SET_LEN(buf, 2);
    if (TENSION_DYNAMIC_ARRAY_LEN(buf) != 2) return 1;

    TensionVec3f *data = TENSION_DYNAMIC_ARRAY_DATA(TensionVec3f, buf);
    data[0].x = 1.0f;
    data[1].z = 3.0f;

#if !defined(__cplusplus)
    // The struct form must address the same bytes as the macro form. C only:
    // the type has a flexible array member.
    TensionVec3fDynamicArray *typed = (TensionVec3fDynamicArray *)buf;
    if (typed->data != data) return 2;
    if (typed->length != 2) return 3;
#else
    // C++ reaches the same bytes through the offset the formula gives.
    if ((unsigned char *)buf + TENSION_DYNAMIC_ARRAY_HEADER_SIZE(TensionVec3f)
        != (unsigned char *)data) return 4;
#endif

    return 0;
}
