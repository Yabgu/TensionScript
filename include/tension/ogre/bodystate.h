// BodyState — the collision solver's per-body state, and its dynamic array.
//
// The shape is **measured from the engine**, not assumed:
// `Tension/examples/solver/collision/game.ts` declares
//
//     @unmanaged
//     struct BodyState {
//       x: f64;
//       y: f64;
//       vx: f64;
//       vy: f64;
//     }
//
// i.e. four `f64` slots — position and velocity — so **32 bytes, align 8**, with
// x at 0, y at 8, vx at 16 and vy at 24. The file's own comment records why the
// layout is exactly this: "The solver hands `_derivative` four f64 slots per
// body — [x, y, vx, vy], no time slot, because `t` is a parameter — so a body's
// view is exactly this record at `(i << 5)`."
//
// That `i << 5` is the same 32 this header asserts, arrived at independently:
// the engine indexes with a shift, this header uses `sizeof`, and a divergence
// would break the static asserts below rather than produce a silently wrong
// read.
//
// Header size is 8, not 4: four bytes of length, then four bytes of padding so
// that the first `f64` lands on an 8-byte boundary. That padding is part of the
// contract — a producer that omits it shifts every element by four bytes.

#ifndef TENSION_OGRE_BODYSTATE_H
#define TENSION_OGRE_BODYSTATE_H

#include "tension/dynamic_array.h"

#ifdef __cplusplus
extern "C" {
#endif

// BodyState: 32 bytes, align 8.
typedef struct TensionBodyState {
    double x;
    double y;
    double vx;
    double vy;
} TensionBodyState;

TS_STATIC_ASSERT(sizeof(TensionBodyState) == 32, "TensionBodyState size must be 32");
TS_STATIC_ASSERT(TS_ALIGNOF(TensionBodyState) == 8, "TensionBodyState align must be 8");
TS_STATIC_ASSERT(offsetof(TensionBodyState, x) == 0,  "TensionBodyState.x offset");
TS_STATIC_ASSERT(offsetof(TensionBodyState, y) == 8,  "TensionBodyState.y offset");
TS_STATIC_ASSERT(offsetof(TensionBodyState, vx) == 16, "TensionBodyState.vx offset");
TS_STATIC_ASSERT(offsetof(TensionBodyState, vy) == 24, "TensionBodyState.vy offset");

// A dynamic array of BodyState:
//
//   [uint32_t length][4 bytes padding][BodyState data[length]]
//
// Header size 8, because alignof(BodyState) is 8. Data begins at offset 8 — and
// a 10-element buffer is 8 + 10*32 = 328 bytes, not 8 + 10*16.
// C only, for the reason `vec3f.h` records: C++ has no flexible array member.
#if !defined(__cplusplus)
typedef struct TensionBodyStateDynamicArray {
    uint32_t length;
    uint32_t padding;   // keeps data 8-aligned; always zero
    TensionBodyState data[];
} TensionBodyStateDynamicArray;

TS_STATIC_ASSERT(offsetof(TensionBodyStateDynamicArray, data) == 8,
                 "BodyState dynamic array data offset must be 8");
#endif

TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_HEADER_SIZE(TensionBodyState) == 8,
                 "BodyState dynamic array header size must be 8");

#ifdef __cplusplus
}
#endif

#endif  // TENSION_OGRE_BODYSTATE_H
