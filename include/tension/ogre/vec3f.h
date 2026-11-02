// Vec3f — a 12-byte, 4-aligned three-float record, and its dynamic array.
//
// This is one of the two reference instances that show how a concrete type is
// published for an `@unmanaged @dynamic [T * n]` parameter. Copy this file's
// pattern for a new type; see `docs/interop-c-abi.md`.
//
// The record matches `schema/ogre.json`'s `Vec3fValue` (12 bytes, fields x, y, z
// as f32). The engine's own generated header spells that record `Vec3fValue` in
// `namespace tension_ogre` and is C++-only; this spelling is the C-facing one
// and both describe the same bytes, so a program mixing them sees one layout.

#ifndef TENSION_OGRE_VEC3F_H
#define TENSION_OGRE_VEC3F_H

#include "tension/dynamic_array.h"

#ifdef __cplusplus
extern "C" {
#endif

// Vec3f: 12 bytes, align 4.
typedef struct TensionVec3f {
    float x;
    float y;
    float z;
} TensionVec3f;

TS_STATIC_ASSERT(sizeof(TensionVec3f) == 12, "TensionVec3f size must be 12");
TS_STATIC_ASSERT(TS_ALIGNOF(TensionVec3f) == 4, "TensionVec3f align must be 4");
TS_STATIC_ASSERT(offsetof(TensionVec3f, y) == 4, "TensionVec3f.y offset");
TS_STATIC_ASSERT(offsetof(TensionVec3f, z) == 8, "TensionVec3f.z offset");

// A dynamic array of Vec3f:
//
//   [uint32_t length][Vec3f data[length]]
//
// Header size 4, because alignof(Vec3f) is 4 — no padding after the length
// word. Data begins at offset 4.
//
// The struct spelling is **C only**: a trailing `data[]` is a flexible array
// member, which C11 has and C++ does not (`-Wpedantic` rejects it, and GCC
// accepts it only as an extension). C++ consumers use the macros in
// `dynamic_array.h`, which are the common surface and have no such caveat.
#if !defined(__cplusplus)
typedef struct TensionVec3fDynamicArray {
    uint32_t length;
    TensionVec3f data[];
} TensionVec3fDynamicArray;

TS_STATIC_ASSERT(offsetof(TensionVec3fDynamicArray, data) == 4,
                 "Vec3f dynamic array data offset must be 4");
#endif

// This one holds in both languages — it is about the type, not the spelling.
TS_STATIC_ASSERT(TENSION_DYNAMIC_ARRAY_HEADER_SIZE(TensionVec3f) == 4,
                 "Vec3f dynamic array header size must be 4");

#ifdef __cplusplus
}
#endif

#endif  // TENSION_OGRE_VEC3F_H
