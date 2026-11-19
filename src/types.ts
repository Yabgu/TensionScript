/**
 * @fileoverview Mappings from AssemblyScript types to WebAssembly types.
 * @license Apache-2.0
 */

import {
  CommonNames
} from "./common";

import {
  Class,
  ClassPrototype,
  Property,
  PropertyPrototype,
  Program,
  DecoratorFlags,
  ElementKind,
  OperatorKind,
  Function
} from "./program";

import {
  TypeRef,
  createType,
  HeapTypeRef,
  ensureType
} from "./module";

import { DeclarationStatement } from "./ast";
import { CharCode } from "./util";
import * as binaryen from "./glue/binaryen";
import { getMapEntry } from "./util/collections";

/** Indicates the kind of a type. */
export const enum TypeKind {
  /** A 1-bit unsigned integer. */
  Bool,

  // signed integers

  /** An 8-bit signed integer. */
  I8,
  /** A 16-bit signed integer. */
  I16,
  /** A 32-bit signed integer. */
  I32,
  /** A 64-bit signed integer. */
  I64,
  /** A 32-bit/64-bit signed integer, depending on the target. */
  Isize,

  // unsigned integers

  /** An 8-bit unsigned integer. */
  U8,
  /** A 16-bit unsigned integer. */
  U16,
  /** A 32-bit unsigned integer. Also the base of function types. */
  U32,
  /** A 64-bit unsigned integer. */
  U64,
  /** A 32-bit/64-bit unsigned integer, depending on the target. Also the base of class types. */
  Usize,

  // floats

  /** A 32-bit float. */
  F32,
  /** A 64-bit double. */
  F64,

  // vectors

  /** A 128-bit vector. */
  V128,

  // inline storage

  /**
   * A fixed-size inline array, `T[N]`.
   *
   * Not a value and not a reference: it has no runtime representation of its
   * own. Its size and alignment are its element's, replicated, and the only
   * operations are element reads and writes at `base + i * elementSize`, which
   * the field-access paths emit directly.
   */
  FixedArray,

  // references (keep in same order as in Binaryen)

  /** External reference. */
  Extern,
  /** Function reference. */
  Func,
  /** Any reference. */
  Any,
  /** Equatable reference. */
  Eq,
  /** Struct reference. */
  Struct,
  /** Array reference. */
  Array,
  /** 31-bit integer reference. */
  I31,
  /** String reference. */
  String,
  /** WTF8 string view. */
  StringviewWTF8,
  /** WTF16 string view. */
  StringviewWTF16,
  /** String iterator. */
  StringviewIter,

  // other

  /** No return type. */
  Void,

  /**
   * A pointer to `T` with unknown length, `[T *]`.
   *
   * **Appended at the end**, not beside {@link FixedArray}, on purpose. This is
   * a `const enum` with implicit numbering, so an insert would renumber the
   * twelve kinds between `FixedArray` and `Void`; the compiler is self-hosted, so
   * a partial rebuild could then disagree with `dist/` about what
   * `TypeKind.Extern` means -- silently. The order here carries no meaning.
   *
   * One slot holding an address: not a value (no extent to inline), not a
   * reference (the collector owns nothing). `toRef` answers the pointer type,
   * which is what lets a `[T *]` parameter, local, global and return bind as one
   * slot where `T[N]` reaches `Type#toRef`'s `assert(false)`.
   */
  UnmanagedArray,

  /**
   * `@unmanaged @dynamic [T * n]` — a header-prefixed array whose length is a
   * runtime value.
   *
   * Appended for the same reason {@link UnmanagedArray} was: an insert would
   * renumber every kind after it, and the compiler is self-hosted.
   *
   * A separate kind rather than a flag on `UnmanagedArray` because the two have
   * different layouts — one addresses bare elements, the other a
   * `[u32 length][pad][data]` header — and every element access has to know
   * which it is looking at. The storage *model* is a field
   * ({@link dynamicMemoryModel}), not a kind, so `@managed @dynamic` (Landing 4d)
   * is the same kind under a different owner.
   */
  DynamicArray
}

/** Indicates capabilities of a type. */
export const enum TypeFlags {
  None = 0,
  /** Is a signed type that can represent negative values. */
  Signed = 1 << 0,
  /** Is an unsigned type that cannot represent negative values. */
  Unsigned = 1 << 1,
  /** Is an integer type. */
  Integer = 1 << 2,
  /** Is a floating point type. */
  Float = 1 << 3,
  /** Is a varying (in size) type. */
  Varying = 1 << 4,
  /** Is smaller than 32-bits. */
  Short = 1 << 5,
  /** Is larger than 32-bits. */
  Long = 1 << 6,
  /** Is a value type. */
  Value = 1 << 7,
  /** Is a reference type (either a class or a function type). */
  Reference = 1 << 8,
  /** Is a nullable type. */
  Nullable = 1 << 9,
  /** Is a vector type. */
  Vector = 1 << 10,
  /** Is an external type. */
  External = 1 << 11,
  /** Is a class. */
  Class = 1 << 12,
  /** Is a function. */
  Function = 1 << 13
}

/**
 * Whether `--wasm-gc` is on: a user-declared class is a wasm GC struct.
 *
 * **A module-level switch, set once from {@link Options.wasmGc} before any type
 * is converted.** `Type#toRef` is called from the resolver, the binder and the
 * compiler, and threading a flag through all of them would mean every signature
 * builder carried an argument that is the same value everywhere. One process
 * compiles one program, so one switch is the same statement with fewer places to
 * forget it.
 *
 * Off by default, and that is not a detail: with it off `toRef` is byte-for-byte
 * the function it was, so `--wasm-gc` absent cannot change any output.
 */
export let gcClassesEnabled: bool = false;

/**
 * How deep the compiler is inside an **intrinsic** eligibility query.
 *
 * The three representation predicates (`gcStringOf`, `gcArrayElementOf`,
 * `gcDynamicArrayElementOf`) answer "is this type a GC reference", which depends on
 * the program-wide latch — but an eligibility question ("could this class be a GC
 * struct?") has to be answered *as if the latch were on*, or every reason it reports
 * is circular: with the latch off, `String` is not an array, so every class holding
 * one looks ineligible and the report blames strings for a decision strings did not
 * cause. Non-zero here means "ignore the latch".
 */
let gcIntrinsicDepth: i32 = 0;

/** Sets {@link gcClassesEnabled}. Called once, from the compiler's constructor. */
export function setGcClassesEnabled(enabled: bool): void {
  gcClassesEnabled = enabled;
}

/** The subdirectories directly under `std/assembly`, used by {@link isStdlibPath}. */
const stdSubdirectories: string[] = ["bindings", "rt", "shared", "util"];

/**
 * Whether a **source file path** names a file of the compiler's own standard
 * library.
 *
 * The shape of the path is not the answer: `~lib/` means "parsed from a library
 * root", so the standard library, a user package under `node_modules`, and this
 * repo's own `tension-framework` all sit under it. `std/assembly`'s flat files are
 * `~lib/array.ts`, its submodules are `~lib/rt/itcms.ts`, and a dependency is
 * `~lib/<package>/…` — so after the prefix, no slash (or one of the four known
 * subdirectories) means std.
 *
 * **A file path, not a class's internal name.** `~lib/string/TemplateStringsArray`
 * is a class named `TemplateStringsArray` in `string.ts`, and reading it as a path
 * made `string` look like a package directory — which classified a standard-library
 * class as a managed one (measured: it manufactured a `TemplateStringsArray`/`Array`
 * crossing in a fixture that has no template literal).
 */
export function isStdlibPath(internalPath: string): bool {
  let prefix = "~lib/";
  if (!internalPath.startsWith(prefix)) return false;
  let rest = internalPath.substring(prefix.length);
  let slash = rest.indexOf("/");
  if (slash < 0) return true;
  let dir = rest.substring(0, slash);
  for (let i = 0, k = stdSubdirectories.length; i < k; ++i) {
    if (unchecked(stdSubdirectories[i]) == dir) return true;
  }
  return false;
}

/** Whether a declaration's source file is the compiler's own standard library. */
function isStdlibSource(program: Program, declaration: DeclarationStatement | null): bool {
  if (declaration == null) return false;
  let source = declaration.range.source;
  // `program.stdSources` is authoritative: the CLI marks it at the two std parse
  // sites, before `--lib` merges user libraries into the same file map.
  if (program.stdSources.has(source)) return true;
  return isStdlibPath(source.internalPath);
}

/** Whether `prototype` was declared by the compiler's own standard library. */
export function isStdlibPrototype(prototype: ClassPrototype): bool {
  return isStdlibSource(prototype.program, prototype.declaration);
}

/**
 * Whether `cls` was declared by the compiler's own standard library.
 *
 * **This replaced `internalName.startsWith("~lib/")`, and the difference is the
 * whole of GC14.** That test answered "was this parsed from a library", which is
 * *also* true of every class in `tension-framework` and of every example's own
 * `~lib/`-mounted dependencies — 111 framework classes in a real program. Treating
 * them as standard library meant the uniformity latch skipped them, so a framework
 * class holding an `Array<T>` was a mixed-ABI crossing the latch could not see.
 */
export function isStdlibClass(cls: Class): bool {
  return isStdlibSource(cls.program, cls.prototype.declaration);
}

/**
 * Whether any of a class's type arguments is an `@inline struct`.
 *
 * Such a container holds **inline bytes**, not references: an `Array<Res>`'s
 * element is a C-layout record and a wasm GC array's element is a value ref,
 * which an inline struct does not have. Both the eligibility answer and the
 * emission answer consult this, so the program falls back to the linear ABI as a
 * whole instead of emitting half a struct.
 */
function hasInlineStructTypeArgument(cls: Class): bool {
  let typeArguments = cls.typeArguments;
  if (typeArguments == null) return false;
  for (let i = 0, k = typeArguments.length; i < k; ++i) {
    let argumentClass = unchecked(typeArguments[i]).classReference;
    if (
      argumentClass != null &&
      argumentClass.hasDecorator(DecoratorFlags.InlineStruct)
    ) return true;
  }
  return false;
}

/**
 * Whether a class is emitted as a wasm GC struct.
 *
 * **One exclusion, and it is the whole chain.** `~lib/` keeps the pointer ABI:
 * `String`, `Array`, `Map`, `Set` and the runtime's own blocks are linear-memory
 * objects and stay that way until the migration reaches them (a `String` literal
 * is in every program, so it is the last thing that can move). A class is a GC
 * struct only if **every** class it derives from is one — a `(ref $Derived)` is
 * a subtype of `(ref $Base)`, so a GC class cannot inherit from a pointer-shaped
 * one, and `_TypeBuilderSetSubType` refuses it (`InvalidSupertype`).
 *
 * The recursion is on `base`, which is `null` for a class whose only ancestor is
 * the implicit `Object` — that is the common case and it terminates here.
 */
export function isGcClass(cls: Class): bool {
  if (!gcClassesEnabled) return false;
  // **An exempt class stays linear.** It is trace-free, so it needs no collector; giving it
  // a struct would be representing a C record as a heap object, which is the opposite of
  // what the exemption is for.
  if (isGcExempt(cls)) return false;
  // **The whole program is uniform or it is not.** A pointer-shaped class stores a
  // field at a byte offset as an `i32`, a GC struct stores the same field as a
  // `(ref null $C)`, and a program holding both aborts inside Binaryen
  // (`isBasic() && "Basic type expected"`). So GC classes are used only when *every*
  // declared user class is eligible; one `String` field anywhere means the program
  // keeps the pointer ABI, exactly as it does today. `gcUniform` decides once.
  if (!gcUniform(cls.program)) return false;
  if (isStdlibClass(cls)) {
    // **Two kinds of standard-library type are mounted on the GC heap**: `Array<T>`
    // (a synthesised `{ brand, data, length_ }`) and the buffer views — the eleven
    // typed arrays and `DataView` — whose payload stays in linear memory while the
    // *view* becomes a struct of scalars. Everything else in `~lib/` (`String`,
    // `Map`, `Set`, the runtime's own blocks) keeps the pointer ABI until its round.
    //
    // **And it is conditional on the program, which is GC14's rule.** These are GC
    // structs only when the program is uniform *given* that they are; see
    // {@link gcUniform} for why that is the fixed point, and for what happens when
    // it is not — they go back to the pointer ABI, and the whole program with them.
    // **The same rule `isGcEligibleImpl` applies**, or the two answers diverge: a
    // standard-library class is a struct when its layout is synthesised, and otherwise
    // exactly when its fields are storable. Nothing else about it being standard library
    // matters.
    if (hasNonStructGcRepresentation(cls)) return false;
    // An `@inline struct` element means inline bytes on the C layout; a wasm
    // array's element is a value ref, which the value type does not have.
    if (hasInlineStructTypeArgument(cls)) return false;
    if (isStdlibGcClass(cls)) return true;
    let stdlibBase = cls.base;
    if (stdlibBase != null && !cls.prototype.implicitlyExtendsObject && !isGcClass(stdlibBase)) {
      return false;
    }
    return gcStructFieldsSupported(cls);
  }
  let base = cls.base;
  // `implicitlyExtendsObject` distinguishes "extends nothing, so the resolver
  // gave it `Object`" from an actual `extends Object` in the source. The former
  // is a flat class — `Object` is not a field of the struct — while the latter
  // is standard-library rooted and follows `Object`'s ABI. Without this the
  // recursion reaches `~lib/object/Object`, answers false, and no user class is
  // ever a GC struct.
  if (base != null && !cls.prototype.implicitlyExtendsObject) {
    return isGcClass(base);
  }
  // **Every field must be storable in a struct.** `String`, `ArrayBuffer` and the
  // other unmigrated `~lib/` types are linear-memory objects with no heap type, so
  // a class holding one cannot be a struct — and a program that has one
  // (`class App { name: string }`) must keep the pointer ABI rather than crash in
  // `gcFieldTypeRef`'s assertion. The same rule `StaticArray`'s element check uses:
  // unsupported means unchanged, not refused.
  return gcStructFieldsSupported(cls);
}

/**
 * The **pointer-ABI class holding a field of this GC class's type**, or `null`.
 *
 * The two ABIs cannot mix: a pointer-shaped class stores a field at a byte offset
 * with `store<T>` where `T`'s ref is an `i32`, while a GC struct's field of the
 * same class is a `(ref null $C)`. Emitting the pair aborts inside Binaryen
 * (`isBasic() && "Basic type expected"`, `wasm-type.h`), which is the worst kind of
 * failure: a crash with no diagnostic. This is the check that turns it into a
 * message naming both classes.
 *
 * The mixed case is reachable whenever *any* class in the program is ineligible for
 * GC — most commonly because one of its fields is a `String`, which this migration
 * has not reached yet.
 */
export function gcMixedAbiReferrer(cls: Class): Class | null {
  let elements = cls.program.elementsByDeclaration;
  for (let _values = Map_values(elements), i = 0, k = _values.length; i < k; ++i) {
    let element = unchecked(_values[i]);
    if (element.kind != ElementKind.ClassPrototype) continue;
    let other = (<ClassPrototype>element).getResolvedInstance("");
    if (other == null || other == cls) continue;
    if (isGcClass(other)) continue;             // both GC: fine
    let fields = gcFieldsOf(other);
    for (let j = 0, n = fields.length; j < n; ++j) {
      let fieldClass = unchecked(fields[j]).type.classReference;
      // **`fieldClass == cls`, not "holds some GC class".** The crossing this
      // refuses is a pointer-shaped class holding a reference to *this* struct
      // type; `other` holding a different GC class is a crossing of its own and is
      // refused when that class is typed. The looser test reported the wrong
      // referrer — measured: typing `Point` blamed `~lib/string/TemplateStringsArray`
      // for holding an `Array`, which has nothing to do with `Point`.
      if (fieldClass == cls) return other;
    }
  }
  return null;
}

/**
 * Whether every field of `cls` can be a wasm struct field.
 *
 * Recursive through class-typed fields, because a struct can only hold a `ref` to
 * another struct. `gcStructCheckPath` guards the cycle case (`A { b: B }`,
 * `B { a: A }`): a class already being checked answers "yes" optimistically, which
 * is correct — a cycle of otherwise-fine classes becomes one `rec` group, and a
 * cycle containing a bad field is caught when that field's own class is checked.
 */
function gcStructFieldsSupported(cls: Class, intrinsic: bool = false): bool {
  if (gcStructCheckPath.includes(cls)) return true;
  gcStructCheckPath.push(cls);
  let ok = true;
  let fields = gcFieldsOf(cls);
  for (let i = 0, k = fields.length; i < k; ++i) {
    let field = unchecked(fields[i]);
    if (!gcStructFieldSupported(field.type, intrinsic, field)) { ok = false; break; }
  }
  gcStructCheckPath.pop();
  return ok;
}

/**
 * **One oracle for one field, and why there had to be one.**
 *
 * `gcStructFieldSupported` (may this field be stored in a struct?) and
 * `gcFieldTypeRef` (emit that field's type) used to answer from **different
 * predicates**, so they contradicted each other and nothing checked:
 *
 * - eligibility switched on `fieldType.kind`, and a signature type's kind **is
 *   `usizeType.kind`** — `Type.fromSignature` builds it as `usizeType.kind` with
 *   `TypeFlags.Reference` and the `Value` bit cleared. So a function-typed field
 *   (`cb: (x: i32) => void`) matched the `Usize` arm and answered "storable".
 * - emission tested `isInternalReference` (via `tryEnsureBasicType`), which a
 *   signature *is*, so it was "non-basic", then `classReference` was null, then
 *   `assert(false)`.
 *
 * Measured: `class H { cb: (x: i32) => void }` was reported `1 of 1 managed class
 * on the GC ABI` and, as soon as an instance was constructed, killed the compiler
 * at `gcFieldTypeRef`. The report lied first, which is the worse half.
 *
 * The discriminator is **`isValue`**, not `kind`: a value is a number or a vector
 * and has a basic wasm type; everything else is a reference and must be one of the
 * reference shapes this slice can emit. That is the predicate both callers now use,
 * so they cannot disagree.
 */
export class GcFieldRefusal {
  constructor(
    /** `true` when no representation change could ever fix it. */
    public permanent: bool,
    /** A short reason for the coverage report (`holding a function value`). */
    public reason: string
  ) {}
}

/**
 * Whether a **class-typed field** is storable — the latch-applied answer, or the
 * latch-free one inside an intrinsic query.
 *
 * The two questions differ, and getting this wrong is how the *report* started
 * blaming `Array` and `TypedArray` for a program's non-uniformity: an eligibility
 * question asked "could this be a reference", so it must not consult a latch that is
 * false precisely because something else is ineligible. `isGcClass` answers "may we",
 * `isGcEligible` answers "could we".
 *
 * The cycle guard is the same one `gcStructFieldsSupported` uses: a class already on
 * the path answers "yes" optimistically, which is correct — a cycle of otherwise-fine
 * classes becomes one `rec` group, and one containing a bad field is caught when that
 * field's own class is checked.
 */
function gcClassFieldStorable(cls: Class): bool {
  if (gcIntrinsicDepth > 0) {
    if (gcStructCheckPath.includes(cls)) return true;
    return isGcEligible(cls);
  }
  return isGcClass(cls);
}

/**
 * Whether a **function-typed field** can be a reference to `Function<T>` here.
 *
 * Answered from the *prototype* plus the latch rather than by resolving the wrapper
 * class, deliberately: this is asked by the coverage report, and GC14's rule is that the
 * report resolves nothing compilation would not. `Function<T>` is a stdlib GC class
 * unconditionally (see {@link isStdlibGcClass}), so the question reduces to whether this
 * program may use the GC ABI at all.
 */
export function gcFunctionValueUsable(type: Type): bool {
  if (!gcClassesEnabled) return false;
  let signature = type.signatureReference;
  if (signature == null) return false;
  if (gcIntrinsicDepth > 0) return true;
  return gcUniform(signature.program);
}

/** Whether a field can be stored in a GC struct — `null` when it can. */
export function gcFieldRefusal(fieldType: Type, field: Property | null): GcFieldRefusal | null {
  // **A buffer view's `buffer` (or a buffer's `dataStart`) is an address**, and an
  // address is a value. Checked first because these fields' *declared* types are the
  // one place the declared type is deliberately not the stored one.
  if (field != null && isLinearBufferField(field)) return null;

  // **A function-typed field.** Its `classReference` is null — a signature type carries
  // only a `signatureReference` — so every branch below would fall through to the
  // "no GC representation yet" refusal. It has one now: `Function<T>` is a GC struct of
  // two scalars, and the field holds a reference to it.
  if (fieldType.signatureReference != null) {
    return gcFunctionValueUsable(fieldType)
      ? null
      : new GcFieldRefusal(false, "holding a function value");
  }

  let cls = fieldType.classReference;

  // **A value has no address, so it can never be a field of a reference type.**
  // This is the memory model's own rule, not a work item: `@inline [T * N]` and an
  // `@inline struct` are C-compatible values (the user's ruling: "C types [T*N] are
  // same as C structs … its for interops"), so a class holding one can never be a GC
  // struct. Permanent, and the report says so instead of listing it beside `Map`.
  if (fieldType.kind == TypeKind.FixedArray) {
    if (fieldType.fixedMemoryModel != MemoryModelCode.Unmanaged) {
      return new GcFieldRefusal(true, "holding a value array (" + fieldType.toString() + ")");
    }
    // An `@unmanaged [T * N]` is an **address** — storable in principle, not emitted
    // yet, so refused as fixable rather than permanent. Refusing it as permanent would
    // be a lie about a C ABI shape this compiler intends to support.
    return new GcFieldRefusal(false, "holding an array address (" + fieldType.toString() + ")");
  }
  if (cls != null && cls.hasDecorator(DecoratorFlags.InlineStruct)) {
    return new GcFieldRefusal(true, "holding an inline record (" + gcFieldLabel(fieldType) + ")");
  }

  // **A reference that is not storable yet.** All fixable: each is a standard-library
  // representation this migration intends to change.
  if (gcStringOf(fieldType)) return null;
  if (gcArrayElementOf(fieldType) != null) return null;
  if (gcDynamicArrayElementOf(fieldType) != null) return null;
  if (cls != null && cls.hasDecorator(DecoratorFlags.Unmanaged)) {
    // A plain record pointer: `@unmanaged` allocates nothing and is erased, so the
    // field is an `i32` address, exactly as under the pointer ABI.
    return null;
  }
  if (cls != null) {
    // **A plain field from a GC struct to a linear record is a crossing.** The record has
    // no reference for the field to hold, so this is not a missing emitter case — it is one
    // representation stored in the other, and it must be a named error.
    if (isGcExempt(cls) && !gcStructCheckPath.includes(cls)) {
      return new GcFieldRefusal(false,
        "holding the C-ABI record " + gcFieldLabel(fieldType));
    }
    // A class field is storable exactly when the class is a GC struct.
    return gcClassFieldStorable(cls) ? null : new GcFieldRefusal(false, "holding " + gcFieldLabel(fieldType));
  }
  if (fieldType.isValue) {
    switch (fieldType.kind) {
      case TypeKind.Bool:
      case TypeKind.I8: case TypeKind.I16: case TypeKind.I32: case TypeKind.I64:
      case TypeKind.Isize: case TypeKind.U8: case TypeKind.U16:
      case TypeKind.U32: case TypeKind.U64: case TypeKind.Usize:
      case TypeKind.F32: case TypeKind.F64:
      case TypeKind.V128: return null;
    }
    return new GcFieldRefusal(false, "holding a " + fieldType.toString());
  }
  // Every remaining reference: a function value, a closure, an `externref`/`anyref`,
  // a `[T * N]` view, a dynamic-array header. None has a GC representation yet.
  //
  // **A function value is refused rather than guessed at.** `ref func` would need the
  // field's signature to be a heap type and every closure to carry its own type; a
  // table index would make the field an `i32` and lose the closure environment. That
  // is a design decision, not this round's, so the field is refused by name and the
  // question is recorded in `docs/wasm-gc.md`.
  return new GcFieldRefusal(false, "holding " + gcFieldLabel(fieldType));
}

/**
 * Whether this field is a **linear-buffer view's `buffer`**: the address of the
 * payload, stored as an `i32` rather than as a traced reference.
 *
 * The one field in this migration whose declared type is deliberately *not* the type
 * it is stored as. `ArrayBuffer` is a linear-memory block — the user's "binary blob"
 * — so a view's hold on it is an address, and storing the address as an `i32` is
 * exactly what keeps `dataStart` an address every ABI site can use. No reference is
 * smuggled: `changetype<usize>(aGCReference)` is refused by name, and an `ArrayBuffer`
 * is not a GC reference to begin with.
 */
export function isLinearBufferField(field: Property): bool {
  if (field.name != "buffer") return false;
  // **Not when the buffer is itself a GC handle.** Then the field is an ordinary traced
  // reference to a struct, and `gcFieldTypeRef`'s class branch emits it. Kept as a
  // separate question from `isGcBufferViewClass` so the two answers cannot drift.
  // Bound to a local first: this compiler does not narrow a property read across
  // `a != null && f(a)`, and reports the second read as `Class | null` (TS2322).
  let bufferClass = field.type.classReference;
  if (bufferClass != null && isGcArrayBufferClass(bufferClass)) {
    return false;
  }
  // `parent` is an `Element`; a field's declaring class is what the shape test needs.
  let parent = field.parent;
  if (parent == null || parent.kind != ElementKind.Class) return false;
  return isGcBufferViewClass(<Class>parent);
}

/**
 * Whether one field's type can be a wasm struct field in this slice.
 *
 * `intrinsic` asks the question as if the program-wide latch were on, so the answer
 * is "could this field be a reference" rather than "is it one right now".
 */
function gcStructFieldSupported(
  fieldType: Type,
  intrinsic: bool = false,
  field: Property | null = null
): bool {
  if (intrinsic) {
    ++gcIntrinsicDepth;
    let ok = gcStructFieldSupportedImpl(fieldType, intrinsic, field);
    --gcIntrinsicDepth;
    return ok;
  }
  return gcStructFieldSupportedImpl(fieldType, intrinsic, field);
}

/** {@link gcStructFieldSupported}'s body. */
function gcStructFieldSupportedImpl(
  fieldType: Type,
  intrinsic: bool,
  field: Property | null
): bool {
  // **One oracle.** `gcFieldRefusal` is the same answer `gcFieldTypeRef` uses to emit
  // this field, so eligibility and emission cannot disagree — which they did, on a
  // function-typed field, and the report told the user the class was GC-ready before
  // the compiler died on it.
  return gcFieldRefusal(fieldType, field) == null;
}

/** Classes on the current {@link gcStructFieldsSupported} path, for cycles. */
let gcStructCheckPath: Class[] = [];

/**
 * Could this class be a GC struct, **ignoring the program-wide latch**?
 *
 * The latch's question is "is the whole program uniform"; this one is "is this
 * class itself the obstacle". The coverage report needs the second, because in a
 * non-uniform program the latch refuses everything and every reason would read
 * "the program is not uniform" — which names no cause.
 *
 * `Array` answers `true` here unconditionally, and that is the optimistic
 * assumption the fixed point is built on; see {@link gcUniform}.
 */
export function isGcEligible(cls: Class): bool {
  ++gcIntrinsicDepth;
  let ok = isGcEligibleImpl(cls);
  --gcIntrinsicDepth;
  return ok;
}

/** {@link isGcEligible}'s body, with the intrinsic depth raised by the caller. */
function isGcEligibleImpl(cls: Class): bool {
  // **An `@unmanaged` record is never a GC struct.** It declares its own linear layout, so
  // "one representation stored in the other" applies to it by definition. A trace-free one is
  // *exempt* — it does not count against uniformity at all — and one that holds a reference
  // is the crossing that has no representation, so it is ineligible.
  //
  // This arm was missing and it mattered: `isGcClass` already refused `@unmanaged`, so the
  // emission was right, but *eligibility* answered `true`, so `gcUniform` thought a record
  // holding a `string` was fine and the report counted it as migrated. Measured: a program
  // that failed with AS100 still read `2 of 2 managed classes on the GC ABI`.
  if (cls.hasDecorator(DecoratorFlags.Unmanaged)) return isGcExempt(cls);
  if (isStdlibClass(cls)) {
    // **The rule, and the reason the allow-list was the wrong shape.**
    //
    // A standard-library class needs the list only when its **declared fields are not its
    // stored fields** — `Array<T>` (`{ brand, data, length_ }`) and `ArrayBuffer`
    // (`{ brand, dataStart, byteLength }`), whose layouts the compiler synthesises. For
    // everything else the ordinary question applies: are the fields storable? `Function<T>`
    // and `Map`/`Set` were already being judged that way; `TaskState` and `TaskRecord` were
    // not, and were refused for being standard library before their fields were ever
    // examined — measured: a reconstruction of the same two classes reports 5 of 5.
    //
    // Two kinds of stdlib class are neither synthesised nor struct-shaped, and both must be
    // excluded explicitly, because their representation *is* special and a struct would be
    // wrong: `String` (an `(array (mut u16))`) and `StaticArray<T>` (a wasm array). Both are
    // answered by `toRef`/`ensureType` before any class arm, so this only keeps the
    // eligibility answer from claiming a struct exists for them.
    if (hasNonStructGcRepresentation(cls)) return false;
    if (hasInlineStructTypeArgument(cls)) return false;
    if (isStdlibGcClass(cls)) return true;
    // Otherwise: fall through to the ordinary base-chain and field test, exactly as a
    // user-declared class.
  }
  let base = cls.base;
  if (base != null && !cls.prototype.implicitlyExtendsObject) {
    if (!isGcEligibleImpl(base)) return false;
  }
  return gcStructFieldsSupported(cls, true);
}

/** One program's latch answer, with the class count it was computed at. */
class GcUniformAnswer {
  constructor(
    /** What the latch answered. */
    public result: bool,
    /** `program.nextClassId` when it was computed. */
    public classCount: i32,
    /** Whether the answer is final: it was computed before any type was emitted. */
    public frozen: bool = false
  ) {}
}

/** Per-program latch answers, invalidated when the program resolves a new class. */
let gcUniformByProgram: Map<Program, GcUniformAnswer> = new Map();

/** Programs whose latch is being computed right now (see {@link gcUniform}). */
let gcUniformComputing: Set<Program> = new Set();

/**
 * Whether **every** managed class in `program` could be a GC struct — the latch
 * that decides whether *anything* is, `Array` included.
 *
 * ## The fixed point, and why `Array` is the variable
 *
 * `Array<T>` is the only standard-library class whose GC-ness is a choice: a
 * dynamic array is a compiler-synthesised GC struct when the program is uniform
 * (GC9), and a linear-memory block otherwise. Write `A` for "`Array` is a GC
 * struct" and `U(A)` for "every managed class is eligible given `A`".
 *
 * - A class with an `Array<T>` field is a `(ref null $Array)` field when `A`, and
 *   an unstorable pointer-shaped class reference when `¬A`. So `U` is **monotone**:
 *   `U(A) ⟹ U(¬A)`.
 * - A monotone predicate on a two-point lattice has a greatest fixed point, and it
 *   is `U(A)`: if the program can be uniform at all, it can be uniform with `Array`
 *   migrated, and the choice that leaves more of the program on the GC ABI is the
 *   one to take.
 *
 * So the decision is: **`A` iff `U(A)`** — computed by asking the optimistic
 * question, which is what {@link isGcEligible} answers for `Array`. `Array`'s own
 * eligibility is not assumed, it is the assumption whose consequences are then
 * checked over every class in the program; and every other class's eligibility
 * *does* participate, through `gcStructFieldsSupported`'s recursion into its fields.
 *
 * ## What happens when the answer is `false`
 *
 * Nothing in the program is a GC struct — `isGcClass` consults this latch first —
 * and `Array` is a linear-memory block like everything else. That is the honest
 * state of the migration on a real program today: it compiles, and it does not
 * migrate. {@link gcCoverage} is what makes that visible instead of silent.
 *
 * ## The cache
 *
 * Keyed on `program.nextClassId`, which increments for every class instance the
 * program resolves, so a class discovered after the latch was first asked forces a
 * recomputation rather than leaving a stale `true` behind. A recomputation can only
 * ever flip `true → false` (a new class can only add an obstacle), and that flip
 * after a type has been emitted is exactly what `gcMixedAbiReferrer` refuses by
 * name — a diagnostic, never a mixed module.
 */
export function gcUniform(program: Program): bool {
  let known = gcUniformByProgram.get(program);
  if (known != null && (known.frozen || known.classCount == program.nextClassId)) {
    return known.result;
  }
  // Re-entry means a field's class is being asked about while this program's latch
  // is still open; answering "yes" is the optimistic side of the same fixed point,
  // and the enclosing computation is the one that reports.
  if (gcUniformComputing.has(program)) return true;
  gcUniformComputing.add(program);
  let result = true;
  // **A reference-keyed `Map`/`Set` makes the program non-uniform even when it declares no
  // classes.** Uniformity is a property of the program, not of its user classes: with no
  // classes at all this used to answer `true` trivially, so a program that only used
  // `Map<string,i32>` took the GC ABI and then aborted inside Binaryen, because
  // `MapEntry` stores `K` in a linear record. Measured: `isBasic() && "Basic type
  // expected"`, no location.
  let instances = program.instancesByName;
  for (let _v = Map_values(instances), i = 0, k = _v.length; i < k; ++i) {
    let element = unchecked(_v[i]);
    if (element.kind != ElementKind.Class) continue;
    let cls = <Class>element;
    let proto = cls.prototype;
    if (proto != program.mapPrototype && proto != program.setPrototype) continue;
    if (gcContainerHoldsReference(cls)) { result = false; break; }
  }
  // **A program that declares an `@inline struct` stays linear.** The value
  // type's storage machinery is the C layout: sret call-temps and inline fields
  // are linear addresses, and its containers (`Array<Res>`, `Task<Res>`) are
  // pointer-shaped even when the rest of the program could be GC structs.
  // `managedClassesOf` deliberately excludes `~lib/` classes and exempt records,
  // so neither the container's nor the value's own ineligibility would reach the
  // latch — and the mixed result is not a working module: measured, a linear
  // `Array<Res>` inside a GC program compiles the std constructor, whose
  // `changetype<usize>(buffer)` on a GC `ArrayBuffer` aborts inside Binaryen.
  // One representation for the whole program, and the value type names it.
  if (result) {
    let elements = program.elementsByDeclaration;
    for (let _v = Map_values(elements), i = 0, k = _v.length; i < k; ++i) {
      let element = unchecked(_v[i]);
      if (element.kind != ElementKind.ClassPrototype) continue;
      if (element.hasDecorator(DecoratorFlags.InlineStruct)) { result = false; break; }
    }
  }
  if (result) {
    for (let _v = Map_values(instances), i = 0, k = _v.length; i < k; ++i) {
      let element = unchecked(_v[i]);
      if (element.kind != ElementKind.Class) continue;
      if (hasInlineStructTypeArgument(<Class>element)) { result = false; break; }
    }
  }
  let classes = result ? managedClassesOf(program) : [];
  for (let i = 0, k = classes.length; i < k; ++i) {
    let cls = unchecked(classes[i]);
    // **An exempt class does not count.** It is trace-free, so it stays linear and the
    // collector never sees it; its own fields are not the latch's question. This is the
    // partition: `gcUniform` asks whether every class *that needs the GC ABI* can have it.
    if (isGcExempt(cls)) continue;
    if (wasGcRefused(cls) || !isGcEligible(cls)) { result = false; break; }
  }
  gcUniformComputing.delete(program);
  gcUniformByProgram.set(program, new GcUniformAnswer(result, program.nextClassId));
  return result;
}

/**
 * Computes the latch **once**, from the classes the program declared, and freezes
 * it.
 *
 * ## Why the freeze, and what it prevents
 *
 * `Array`'s representation is program-wide, so it cannot be re-decided after a type
 * has been emitted: a string literal registered as an `(array (mut u16))` global
 * cannot become a data-segment pointer when a class discovered later flips the
 * answer. Measured, before the freeze: `examples/2d/hello-sprites` registered its
 * literals with the latch optimistic-`true`, a class found later made the program
 * non-uniform, and `emitGcStringBuilds` aborted inside Binaryen with
 * `Assertion failed: isRef()` — a crash with no location.
 *
 * The compiler therefore resolves every **non-generic** class before emitting
 * anything (a generic class has no fields until it is instantiated, so it is judged
 * per instance), and this function turns that set into the final answer.
 *
 * A generic instance discovered afterwards can still turn out ineligible. That is
 * not a crash and not a mixed module: `isGcClass` checks per-class eligibility
 * *after* the latch, so such a class is simply pointer-shaped, and any GC class that
 * refers to it is refused by `gcMixedAbiReferrer` with both names. The latch says
 * "the program may use the GC ABI"; it has never been a claim that every class does.
 */
export function prepareGcLatch(program: Program): bool {
  let known = gcUniformByProgram.get(program);
  if (known != null && known.frozen) return known.result;
  gcUniformByProgram.delete(program);
  let result = gcUniform(program);
  gcUniformByProgram.set(program, new GcUniformAnswer(result, program.nextClassId, true));
  return result;
}

/**
 * Every **managed** class the program has resolved, standard library excluded.
 *
 * Both sources are needed and they overlap: `instancesByName` holds the concrete
 * classes the compile has resolved (including generic instantiations, whose
 * prototypes answer nothing on their own), while a flat class declared but not yet
 * instantiated is reachable only through its prototype. Duplicates are collapsed,
 * because a class reached both ways is one class and must be counted once.
 *
 * `~lib/`-mounted **dependencies** are included: they are managed classes of this
 * program, and a framework class holding an `Array` is precisely the crossing that
 * GC13 measured. See {@link isStdlibClass}.
 */
export function managedClassesOf(program: Program): Class[] {
  let out = new Array<Class>();
  let seen = new Set<Class>();
  let instances = program.instancesByName;
  for (let _values = Map_values(instances), i = 0, k = _values.length; i < k; ++i) {
    let element = unchecked(_values[i]);
    if (element.kind != ElementKind.Class) continue;
    let cls = <Class>element;
    if (isStdlibClass(cls) || seen.has(cls)) continue;
    seen.add(cls);
    out.push(cls);
  }
  let elements = program.elementsByDeclaration;
  for (let _values = Map_values(elements), i = 0, k = _values.length; i < k; ++i) {
    let element = unchecked(_values[i]);
    if (element.kind != ElementKind.ClassPrototype) continue;
    let cls = (<ClassPrototype>element).getResolvedInstance("");
    if (cls == null || isStdlibClass(cls) || seen.has(cls)) continue;
    seen.add(cls);
    out.push(cls);
  }
  return out;
}

/**
 * One program's GC-ABI coverage: what landed on it, what did not, and why.
 *
 * A **report**, not a gate. The flag claims to move classes to a different
 * representation; a flag that claims something must say what it did, and a
 * migration where that number silently stays at zero is indistinguishable from one
 * that works.
 */
export class GcCoverage {
  /** Managed classes emitted as GC structs. */
  onGc: i32 = 0;
  /** Managed classes the program resolved, standard library excluded. */
  total: i32 = 0;
  /** Whether the program-wide latch is on (i.e. anything at all could be GC). */
  uniform: bool = false;
  /**
   * Distinct **fixable** obstacles, most classes first — a representation change this
   * migration intends to make (`TypedArray`, `ArrayBuffer`, `Map`, a function value).
   */
  reasons: string[] = [];
  /** How many classes each fixable reason accounts for, parallel to {@link reasons}. */
  counts: i32[] = [];
  /**
   * Distinct **permanent** obstacles — {@link GcFieldRefusal.permanent}. A value has no
   * address, so a class holding an `@inline [T * N]` or an `@inline struct` can never
   * be a GC struct. Listed apart because putting one in the work list sends a reader
   * to "fix" the C ABI.
   */
  permanentReasons: string[] = [];
  /** How many classes each permanent reason accounts for. */
  permanentCounts: i32[] = [];
  /** Classes with no obstacle of their own, held back by the program-wide latch. */
  heldBack: i32 = 0;
  /** Classes whose obstacle is another managed class that is itself not GC. */
  blocked: i32 = 0;

  /** Records one refused class under `reason`, or as latch-held-back when empty. */
  refuse(reason: string, permanent: bool = false): void {
    if (reason.length == 0) {
      ++this.heldBack;
      return;
    }
    if (permanent) {
      let permAt = this.permanentReasons.indexOf(reason);
      if (permAt < 0) {
        this.permanentReasons.push(reason);
        this.permanentCounts.push(1);
      } else {
        this.permanentCounts[permAt] += 1;
      }
      return;
    }
    let at = this.reasons.indexOf(reason);
    if (at < 0) {
      this.reasons.push(reason);
      this.counts.push(1);
    } else {
      this.counts[at] += 1;
    }
    // Keep the list ordered by count, descending: the report shows three and the
    // zero-coverage warning shows the first, so both must lead with what blocks the
    // most classes. Insertion-sort-sized lists (a handful of reasons), so the
    // simplicity is free.
    for (let i = 1, k = this.reasons.length; i < k; ++i) {
      let j = i;
      while (j > 0 && unchecked(this.counts[j]) > unchecked(this.counts[j - 1])) {
        let reasonAt = unchecked(this.reasons[j]);
        this.reasons[j] = this.reasons[j - 1];
        this.reasons[j - 1] = reasonAt;
        let countAt = unchecked(this.counts[j]);
        this.counts[j] = this.counts[j - 1];
        this.counts[j - 1] = countAt;
        --j;
      }
    }
  }

  /** The obstacle covering the most classes, or the latch when there is none. */
  get dominantReason(): string {
    if (this.reasons.length) return unchecked(this.reasons[0]);
    if (this.permanentReasons.length) return unchecked(this.permanentReasons[0]);
    return "the program is not uniform";
  }

  /**
   * Classes that are **exempt**: trace-free C-ABI records, which stay linear by design.
   * Neither migrating nor refused — the third line of the report.
   */
  exempt: i32 = 0;
  /** How many exempt classes each record shape accounts for, for the reason text. */
  exemptReasons: string[] = [];
  exemptCounts: i32[] = [];

  /** How many classes are refused **permanently** — never a work item. */
  get permanentTotal(): i32 {
    let out = 0;
    for (let i = 0, k = this.permanentCounts.length; i < k; ++i) out += unchecked(this.permanentCounts[i]);
    return out;
  }

  /** The report line, without the `wasm-gc:` prefix. */
  toString(): string {
    let out = this.onGc.toString() + " of " + this.total.toString() +
      " managed class" + (this.total == 1 ? "" : "es") + " on the GC ABI";
    // **The third category, and it is not a blocker.** An exempt class is a trace-free
    // C-ABI record: it stays linear by design, so calling it "refused" would send a reader
    // looking for a fix that does not exist, and counting it as migrated would be a lie.
    let exemptClause = "";
    if (this.exempt > 0) {
      let exemptParts = new Array<string>();
      let exemptShown = this.exemptReasons.length < 3 ? this.exemptReasons.length : 3;
      for (let i = 0; i < exemptShown; ++i) {
        exemptParts.push(unchecked(this.exemptCounts[i]).toString() + " " +
          unchecked(this.exemptReasons[i]));
      }
      if (this.exemptReasons.length > exemptShown) {
        let more = this.exemptReasons.length - exemptShown;
        exemptParts.push(more.toString() + " more");
      }
      exemptClause = "; " + this.exempt.toString() + " exempt (C-ABI record" +
        (this.exempt == 1 ? "" : "s") + ", trace-free: " + exemptParts.join(", ") + ")";
    }
    let parts = new Array<string>();
    let shown = this.reasons.length < 3 ? this.reasons.length : 3;
    for (let i = 0; i < shown; ++i) {
      parts.push(unchecked(this.counts[i]).toString() + " " + unchecked(this.reasons[i]));
    }
    if (this.reasons.length > shown) {
      let more = this.reasons.length - shown;
      parts.push(more.toString() + (more == 1 ? " more reason" : " more reasons"));
    }
    let detail = parts.length ? ": " + parts.join(", ") : "";
    // **Permanent obstacles are named apart, and never called reasons.** A reader who
    // sees "1 holding a value array" in the work list will go looking for the
    // representation change that fixes it, and there is none: an `@inline [T * N]` is a
    // C-compatible value with no address. One line higher is the difference between a
    // work order and an invitation to break the C ABI.
    if (this.permanentReasons.length) {
      let permParts = new Array<string>();
      let permShown = this.permanentReasons.length < 3 ? this.permanentReasons.length : 3;
      for (let i = 0; i < permShown; ++i) {
        permParts.push(unchecked(this.permanentCounts[i]).toString() + " " +
          unchecked(this.permanentReasons[i]));
      }
      if (this.permanentReasons.length > permShown) {
        let more = this.permanentReasons.length - permShown;
        permParts.push(more.toString() + (more == 1 ? " more" : " more"));
      }
      detail += (detail.length ? "; " : ": ") +
        "permanent, not a work item: " + permParts.join(", ");
    }
    // The transitive and latch counts are **not** reasons. A class blocked because it
    // holds another class that is blocked names no cause a migration can act on, and
    // letting it into the reason list would let chains out-count the cause at their
    // root — which is what makes the list a work order instead of a symptom list.
    let tails = new Array<string>();
    if (this.blocked) {
      tails.push(this.blocked.toString() + " blocked by a class that is not GC");
    }
    if (this.heldBack) {
      tails.push(this.heldBack.toString() + " eligible, held back only by the latch");
    }
    // **A program that is uniform with exemptions is not "not uniform".** The phrase only
    // belongs on a line that has something to explain, and the whole point of the
    // partition is that a trace-free record is not a reason.
    if (!detail.length && !tails.length) return out + exemptClause;
    let line = out + " - the program is not uniform" + detail;
    if (tails.length) line += " (and " + tails.join(", ") + ")";
    return line + exemptClause;
  }
}

/**
 * Records why `cls` is not on the GC ABI.
 *
 * Three outcomes, and the difference is what makes the report actionable:
 *
 * - **A root obstacle** — an unmigrated standard-library type in a field
 *   (`holding a TypedArray`), or a base class that cannot be GC. This is a work
 *   item, and the count is how many classes it blocks.
 * - **Blocked transitively** — a field whose type is another managed class that is
 *   itself refused. Acting on it is impossible until that class migrates, and
 *   listing it as a reason would let chains out-count the cause at their root.
 * - **Held back by the latch** — no obstacle at all; the program-wide answer is no
 *   because of other classes.
 */
/**
 * Records one exempt class under its shape, for the report's third line.
 *
 * Grouped by shape rather than by name, because the point of the line is "six C records",
 * not "six names the reader has never heard of" — and a codegen'd name is not something a
 * reader can act on.
 */
function recordGcExemption(coverage: GcCoverage, cls: Class): void {
  let label = "<" + cls.name + ">";
  let at = coverage.exemptReasons.indexOf(label);
  if (at < 0) {
    coverage.exemptReasons.push(label);
    coverage.exemptCounts.push(1);
  } else {
    coverage.exemptCounts[at] += 1;
  }
}

function recordGcRefusal(coverage: GcCoverage, cls: Class): void {
  // A reference-keyed `Map`/`Set` is refused for its *entries*, which no field walk can
  // see, so it is named here rather than reported as "eligible, held back by the latch".
  if ((cls.prototype == cls.program.mapPrototype || cls.prototype == cls.program.setPrototype) &&
      gcContainerHoldsReference(cls)) {
    coverage.refuse("holding a " + (cls.prototype == cls.program.mapPrototype ? "Map" : "Set") +
      " with a reference key or value");
    return;
  }
  let base = cls.base;
  if (base != null && !cls.prototype.implicitlyExtendsObject && !isGcEligible(base)) {
    coverage.refuse("extending a class that is not GC (" + base.name + ")");
    return;
  }
  let fields = gcFieldsOf(cls);
  for (let i = 0, k = fields.length; i < k; ++i) {
    let field = unchecked(fields[i]);
    let refusal = gcFieldRefusal(field.type, field);
    if (refusal == null) continue;
    let fieldClass = field.type.classReference;
    // A field whose type is another managed class that is itself refused is *blocked*,
    // not a reason: acting on it is impossible until that class migrates, and letting
    // the chain into the reason list would let it out-count the cause at its root.
    if (!refusal.permanent && fieldClass != null && !isStdlibClass(fieldClass)) {
      ++coverage.blocked;
      return;
    }
    coverage.refuse(refusal.reason, refusal.permanent);
    return;
  }
  ++coverage.heldBack;
}

/**
 * Whether `cls` is one of the standard library's typed arrays.
 *
 * By **declaring file**, not by base class: in this standard library the nine
 * typed arrays are declared in `typedarray.ts` and extend `ArrayBufferView`
 * individually — there is no `TypedArray` class to walk up to (measured: the first
 * attempt walked bases for a class of that name and matched nothing).
 */
function isTypedArrayClass(cls: Class): bool {
  if (!isStdlibClass(cls)) return false;
  // A class's internal name is `~lib/<file stem>/<Class>`, so the declaring file is
  // the path segment before the class name. `source.internalPath` would be the
  // other way to say it, but it is not what the parser recorded (measured: the
  // comparison against `~lib/typedarray.ts` matched nothing).
  let name = cls.prototype.internalName;
  let prefix = "~lib/typedarray/";
  return name.startsWith(prefix);
}

/** `"an "` or `"a "`, so a reason reads as English (`an ArrayBuffer`). */
function gcArticle(preceding: string): string {
  if (!preceding.length) return "a ";
  switch (preceding.charCodeAt(0) | 32) {
    case CharCode.a:
    case CharCode.e:
    case CharCode.i:
    case CharCode.o:
    case CharCode.u: return "an ";
  }
  return "a ";
}

/** A short name for a field type in a refusal reason. */
function gcFieldLabel(fieldType: Type): string {
  // A signature type has no class; naming it by its printed signature ("a (i32) => void")
  // tells the reader what the field *is* but not that it is a function value, which is
  // the thing that has no GC representation.
  if (fieldType.signatureReference != null) return "a function value";
  if (fieldType.kind == TypeKind.FixedArray) {
    return "a value array (" + fieldType.toString() + ")";
  }
  let cls = fieldType.classReference;
  if (cls != null) {
    // The nine `TypedArray`s are one cause, not nine: a count split across
    // `Uint8Array`, `Float64Array` and the rest tells a reader nothing that
    // "TypedArray" does not, and the migration that fixes them is one item.
    if (isTypedArrayClass(cls)) return "a TypedArray";
    let name = cls.name;
    // The base name, not the instantiation: the reader needs to know it is a `Map`,
    // and the specific `Map<string,i32>` adds nothing to a reason count.
    let lt = name.indexOf("<");
    if (lt > 0) name = name.substring(0, lt);
    return gcArticle(name) + name;
  }
  return gcArticle(fieldType.toString()) + fieldType.toString();
}

/**
 * Measures {@link GcCoverage} for `program`.
 *
 * Counted over the same set {@link gcUniform} decides on, so the two can never
 * disagree about which classes exist — and a class that is eligible but not GC
 * because the latch is off is reported as refused with the latch's own reason, not
 * as absent.
 */
/**
 * Classes the compiler **refused before emission**, per program.
 *
 * A refusal raised this early is a fact about the program, and the coverage arithmetic has
 * to agree with it or the report contradicts the exit status — measured: the build failed
 * with AS100 while the line still read `2 of 2 managed classes on the GC ABI`.
 */
let gcRefusedClassesByProgram: Map<Program, Class[]> = new Map();

/** Records that `cls` was refused, so the report cannot count it as migrated. */
export function noteGcRefusedClass(cls: Class): void {
  let program = cls.program;
  let known = gcRefusedClassesByProgram.get(program);
  if (known == null) {
    gcRefusedClassesByProgram.set(program, [ cls ]);
  } else if (!known.includes(cls)) {
    known.push(cls);
  }
}

/** Whether `cls` was refused before emission. */
export function wasGcRefused(cls: Class): bool {
  let known = gcRefusedClassesByProgram.get(cls.program);
  return known != null && known.includes(cls);
}

export function gcCoverage(program: Program): GcCoverage {
  let coverage = new GcCoverage();
  coverage.uniform = gcUniform(program);
  // **A reference-keyed `Map`/`Set` holds the latch off, and it must be named.** It is a
  // property of the program rather than of any class's declared fields, so nothing in the
  // class walk would report it: measured, the line read "116 eligible, held back only by the
  // latch" — true of every class and silent about the one thing blocking all of them.
  let latchRefusal = "";
  let instances = program.instancesByName;
  for (let _v = Map_values(instances), i = 0, k = _v.length; i < k; ++i) {
    let element = unchecked(_v[i]);
    if (element.kind != ElementKind.Class) continue;
    let container = <Class>element;
    let proto = container.prototype;
    if (proto != program.mapPrototype && proto != program.setPrototype) continue;
    if (gcContainerHoldsReference(container)) {
      latchRefusal = "holding a " + (proto == program.mapPrototype ? "Map" : "Set") +
        " with a reference key or value";
      break;
    }
  }
  let classes = managedClassesOf(program);
  for (let i = 0, k = classes.length; i < k; ++i) {
    let cls = unchecked(classes[i]);
    coverage.total++;
    // **The third category.** An exempt class is not migrating and is not refused: it is a
    // trace-free C record that stays linear by design, and a reader must be able to tell
    // that from the report alone — "refused" would send them looking for a fix that does
    // not exist, and "on the GC ABI" would be a lie.
    if (isGcExempt(cls)) {
      coverage.exempt++;
      recordGcExemption(coverage, cls);
      continue;
    }
    // **A refused class is not a migrated class.** The exemption's own invariant was refused
    // (a C record holding a reference), so this class cannot be on the GC ABI whatever the
    // latch says — and a report that counts it would contradict the build's exit status.
    if (wasGcRefused(cls)) {
      coverage.refuse("refused before emission (see the error above)");
      continue;
    }
    if (coverage.uniform && isGcEligible(cls)) {
      coverage.onGc++;
    } else if (isGcEligible(cls)) {
      ++coverage.heldBack; // eligible; only the program-wide answer refuses it
    } else {
      ++gcIntrinsicDepth;
      recordGcRefusal(coverage, cls);
      --gcIntrinsicDepth;
    }
  }
  if (latchRefusal.length && coverage.onGc == 0) coverage.refuse(latchRefusal);
  return coverage;
}

/**
 * Whether `type` is `String` under `--wasmGc`, where a string **is** an
 * `(array (mut u16))`.
 *
 * `String` is a bare block — no declared fields, length implied by the allocation —
 * so it maps onto a wasm array exactly like `StaticArray<u16>` does, and reuses the
 * same array type. What differs is the *literal*: today a literal is a data segment
 * and a `String` points at it, and under GC each distinct literal is one object
 * built in `__start`.
 */
export function gcStringOf(type: Type | null): bool {
  if (type == null || !gcClassesEnabled) return false;
  let cls = type.classReference;
  if (cls == null) return false;
  let program = cls.program;
  let instance = program.stringInstance;
  if (instance == null || cls != instance) return false;
  // **Conditional on the program-wide latch, and this is the line that makes
  // `--wasmGc` inert rather than broken on a non-uniform program.** A `String` is a
  // wasm array *or* a linear-memory block, never both: a pointer-shaped class stores
  // its `String` field as an `i32` and cannot hold an array reference, so a program
  // where any class must stay pointer-shaped has to keep strings there too. With the
  // latch off every predicate here answers "pointer", every GC lowering stands down,
  // and the module is the flag-off module — which is what the coverage report then
  // says out loud. An intrinsic query (`gcIntrinsicDepth`) skips the latch: it is
  // asking what the type *would* be, not what it is.
  return gcIntrinsicDepth > 0 || gcUniform(program);
}

/** The leaf `String` operators that need a GC-specific body. */
export const enum GcStringOp {
  /** `__eq` */
  Eq,
  /** `__not` */
  Not,
  /** `__gt` */
  Gt,
  /** `__lt` */
  Lt,
  /** Not one of the leaves. A member rather than a `| null` return, because this
   *  compiler refuses a nullable `const enum` (`AS204`): the enum is an `i32`, so
   *  "no operator" needs a value in it. Last, so every other member keeps the
   *  value it had. */
  None
}

/**
 * Which GC operator body (if any) replaces a resolved function's stdlib body.
 *
 * Only the leaves: `__ne`, `__gte` and `__lte` are one-line wrappers around these,
 * so their own bodies compile unchanged and reach the replacement by call.
 */
export function gcStringOperator(internalName: string): GcStringOp {
  switch (internalName) {
    case "~lib/string/String.__eq": return GcStringOp.Eq;
    case "~lib/string/String.__not": return GcStringOp.Not;
    case "~lib/string/String.__gt": return GcStringOp.Gt;
    case "~lib/string/String.__lt": return GcStringOp.Lt;
    default: return GcStringOp.None;
  }
}

/**
 * The element type when `type` is a **dynamic** `Array<T>` emitted on the GC heap,
 * else `null`.
 *
 * `Array` grows, and the glue has no `array.grow`, so it cannot *be* a wasm array.
 * Its GC layout is a small struct the compiler synthesises — `{ <brand>, data:
 * (mut (ref null (array (mut T)))), length_ i32 }` — where `array.len data` is the
 * **capacity** and `length_` the used count. The declaration in
 * `std/assembly/array.ts` is not edited: the layout exists only in the compiler, so
 * flag-off code is untouched by construction.
 */
/**
 * Whether `type`, under `--wasmGc`, is represented as a **reference** rather than
 * an `i32` — a GC class, a `String`, or a GC array (`StaticArray<T>`, `Array<T>`).
 *
 * One predicate because the answer is needed in four places that must agree: the
 * `null` literal's value, `makeFieldZero`, a struct field's type ref, and the
 * truthiness of a reference in a condition. Four copies of the same four-way test
 * is how the string case was missed in three of them.
 *
 * **`isGcClass` is not enough**: it answers false for everything under `~lib/` by
 * design (the standard library kept the pointer ABI until GC11), so `String` and
 * the arrays need their own predicates — and a class type's `kind` is `Usize`, so
 * no `kind` test distinguishes them either.
 */
export function isGcReferenceType(type: Type | null): bool {
  if (type == null || !gcClassesEnabled) return false;
  let nonNullable = type.nonNullableType;
  let cls = nonNullable.classReference;
  if (cls == null) return false;
  return isGcClass(cls) ||
         gcStringOf(nonNullable) ||
         gcArrayElementOf(nonNullable) != null ||
         gcDynamicArrayElementOf(nonNullable) != null;
}

export function gcDynamicArrayElementOf(type: Type | null): Type | null {
  if (type == null || !gcClassesEnabled) return null;
  let cls = type.classReference;
  if (cls == null) return null;
  let program = cls.program;
  // Same latch as `gcStringOf`: on a non-uniform program a `Array` is the linear-memory
  // block it was before this migration, whole and consistent. See `gcUniform`.
  if (gcIntrinsicDepth == 0 && !gcUniform(program)) return null;
  if (cls.prototype != program.arrayPrototype) return null;
  let typeArguments = cls.getTypeArgumentsTo(program.arrayPrototype);
  if (typeArguments == null || !typeArguments.length) return null;
  let element = unchecked(typeArguments[0]);
  // **An `@inline struct` element keeps the array linear.** Its elements are
  // inline bytes on the C layout; a wasm array's element is a value ref, which
  // the value type does not have. This is also the answer at *emission* time,
  // so it does not depend on the program-wide latch having been computed after
  // `Array<Res>` was resolved (measured: it had not been, and
  // `array.new` was asked for a non-reference element).
  let elementClass = element.classReference;
  if (
    elementClass != null &&
    elementClass.hasDecorator(DecoratorFlags.InlineStruct)
  ) return null;
  return gcArrayElementSupported(element) ? element : null;
}

/**
 * The floor the stdlib's `Array` constructor puts on capacity (`MIN_SIZE` in
 * `std/assembly/array.ts`). Kept here so the synthesised layout and the emitted
 * constructor agree; a mismatch would be an extra growth on the first push, which
 * is invisible but wasteful.
 */
export const GC_ARRAY_MIN_SIZE: i32 = 8;

/** Struct field index of an `Array<T>`'s backing array in the GC layout. */
export const GC_ARRAY_DATA_INDEX: i32 = 1;
/** Struct field index of an `Array<T>`'s used count in the GC layout. */
export const GC_ARRAY_LENGTH_INDEX: i32 = 2;

/**
 * The element type when `type` is a `StaticArray<T>` emitted as a wasm GC array,
 * else `null`.
 *
 * **Prototype identity, not `extendsPrototype`.** `String extends
 * StaticArray<u16>` and so do the nine `TypedArray`s; an `extends` test mapped all
 * of them onto wasm arrays and then failed deep inside `String`. Only a
 * `StaticArray<T>` *instance* is mapped, and this is the one test that decides it.
 */
export function gcArrayElementOf(type: Type | null): Type | null {
  if (type == null || !gcClassesEnabled) return null;
  let cls = type.classReference;
  if (cls == null) return null;
  let program = cls.program;
  // Same latch as `gcStringOf`: on a non-uniform program a `StaticArray` is the linear-memory
  // block it was before this migration, whole and consistent. See `gcUniform`.
  if (gcIntrinsicDepth == 0 && !gcUniform(program)) return null;
  if (cls.prototype != program.staticArrayPrototype) return null;
  let typeArguments = cls.getTypeArgumentsTo(program.staticArrayPrototype);
  if (typeArguments == null || !typeArguments.length) return null;
  let element = unchecked(typeArguments[0]);
  return gcArrayElementSupported(element) ? element : null;
}

/**
 * Whether an element type can be a wasm array's element in this slice.
 *
 * Value types, and a class this slice emits as a struct. Anything else —
 * `String`, `Array`, a function reference, a nested `StaticArray` — leaves the
 * instantiation pointer-shaped so a program using it keeps compiling exactly as it
 * does today. Half-supporting an element kind would fail somewhere unrelated.
 */
export function gcArrayElementSupported(element: Type): bool {
  switch (element.kind) {
    case TypeKind.Bool:
    case TypeKind.I8:
    case TypeKind.I16:
    case TypeKind.I32:
    case TypeKind.I64:
    case TypeKind.Isize:
    case TypeKind.U8:
    case TypeKind.U16:
    case TypeKind.U32:
    case TypeKind.U64:
    case TypeKind.Usize:
    case TypeKind.F32:
    case TypeKind.F64: return true;
  }
  let elementClass = element.classReference;
  return elementClass != null && isGcClass(elementClass);
}

/**
 * The **brand id** of a wasm GC class: the value it stores in struct field 0.
 *
 * # Why a value and not a type
 *
 * wasm GC type identity is *structural*. `class SetX { id: i32; value: f32 }` and
 * `class SetY { id: i32; value: f32 }` are one wasm type, so `ref.test` answers
 * true for both and an `instanceof`-dispatched undo system silently applies the
 * wrong command (`tension-framework/assembly/editor/command.ts:220,259` are
 * exactly this shape). Adding a brand *field* does not help on its own either —
 * two structs `(i32, i32, f32)` with different brand *values* are still one type.
 * The brand has to be **compared by value at runtime**.
 *
 * # Derivation: FNV-1a over the qualified class name
 *
 * A pure function of `internalName` (the source path plus the declaration path),
 * so it is reproducible: the same source compiled twice gives the same id, and
 * nothing depends on resolution order, on which class was touched first, or on
 * the order classes appear in a file. A counter over "all classes" would depend
 * on all three, and there is no whole-program class list to iterate anyway.
 *
 * Masked to 31 bits and forced non-zero so the value is a plain positive `i32`
 * and 0 can never be a class's brand (0 is `ref.null`-adjacent in spirit — an
 * "unset" marker — and a brand of 0 would compare equal to a zeroed field).
 *
 * # Collisions
 *
 * 2^31 values against a handful of classes in one module. Checked rather than
 * assumed: `ensureClassType` records each (brand → class) in the module and
 * throws a diagnostic if two different classes land on one id, so a collision is
 * a compile error naming both, not a silent aliasing bug.
 */
export function gcBrandOf(cls: Class): i32 {
  return gcBrandOfName(cls.internalName);
}

/** {@link gcBrandOf} for a name, which is what a `ClassPrototype` has. */
export function gcBrandOfName(name: string): i32 {
  let hash: u32 = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0, k = name.length; i < k; ++i) {
    hash = (hash ^ <u32>name.charCodeAt(i)) * 0x01000193; // FNV prime
  }
  let brand = <i32>(hash & 0x7fffffff);
  return brand != 0 ? brand : 1;
}

/** The struct index of the brand field. Always 0 — first in every struct, and
 *  therefore inside the base prefix, so inheritance keeps it at a fixed offset. */
export const GC_BRAND_INDEX: i32 = 0;

/** The struct index of the first declared field (the brand occupies 0). */
export const GC_FIRST_FIELD_INDEX: i32 = 1;

/** The field name the brand is registered under, for readable `--textFile` output. */
export const GC_BRAND_NAME: string = "<brand>";

/** The GC class whose struct owns `property`, or `null` when it is not a GC field. */
export function gcOwnerOf(property: Property): Class | null {
  let parent = property.parent;
  if (parent == null || parent.kind != ElementKind.Class) return null;
  let classInstance = <Class>parent;
  return isGcClass(classInstance) ? classInstance : null;
}

/**
 * Every GC class in `cls`'s subtree — itself and all transitive descendants.
 *
 * This is what `instanceof C` means once identity is nominal: "the runtime
 * object's brand is C's, or one of a class derived from C". The set is built at
 * compile time, so the emitted test is a chain of `i32.eq` against a literal — as
 * many compares as the subtree has classes, which for a UI command hierarchy is
 * one or two.
 *
 * A `ref.test` cannot express this, and it is not merely slower: two siblings with
 * identical layouts share one wasm type, so `ref.test (ref $SetX)` is true for a
 * `SetY`. The brand chain is the correct primitive; a future slice could compress
 * it to a range check (contiguous ids per subtree) if a subtree ever grows large.
 */
export function gcSubtreeBrands(program: Program, cls: Class): i32[] {
  let root = cls.prototype;
  let out = new Array<i32>();
  // **Walk every declared class and keep the ones under `root`.** Upward, not
  // downward: `ClassPrototype.basePrototype` is set while the declaration is
  // parsed, whereas a downward `extenders` set is not maintained at all (measured:
  // it is empty for every class). And `elementsByDeclaration` is complete once the
  // program is initialized — before any code is generated — so the answer does not
  // depend on which class was resolved first, which a walk over resolved
  // `Class` instances would.
  let elements = program.elementsByDeclaration;
  for (let _values = Map_values(elements), i = 0, k = _values.length; i < k; ++i) {
    let element = unchecked(_values[i]);
    if (element.kind != ElementKind.ClassPrototype) continue;
    let prototype = <ClassPrototype>element;
    if (!isGcPrototype(prototype)) continue;
    let cursor: ClassPrototype | null = prototype;
    while (cursor != null) {
      if (cursor == root) {
        out.push(gcBrandOfName(prototype.internalName));
        break;
      }
      cursor = cursor.basePrototype;
    }
  }
  return out;
}

/**
 * {@link isGcClass} for a prototype: not the standard library, and no base that is.
 *
 * Needed because the subtree walk happens over prototypes, and the same "standard
 * library keeps the pointer ABI" rule has to apply there. The test is
 * {@link isStdlibClass}'s path shape, not the `~lib/` prefix: a framework class is
 * a managed class of this program even though it was parsed from a library root.
 */
export function isGcPrototype(prototype: ClassPrototype): bool {
  if (!gcClassesEnabled) return false;
  if (isStdlibPrototype(prototype)) {
    // **A standard-library class IS a prototype here**, so `isGcClass`'s answer has
    // to be reproduced without a `Class` in hand — and it must be reproduced, not
    // guessed: this is the walk that fills a brand subtree, so answering "no" for
    // `Uint8Array` made `ArrayBuffer.isView` an empty brand test and its
    // `assert(subtree.length > 0)` fired (measured). The three migrated shapes are
    // `Array`, a buffer view, and a buffer view's subclass; the resolved instance is
    // what tells them apart, and it exists for all of them (none is generic).
    let program = prototype.program;
    if (prototype == program.arrayPrototype) return true;
    // `ArrayBuffer` has no brand subtree of its own (`ArrayBuffer.isView` does not list
    // it), but its prototype reaches this walk whenever a brand test is built over a
    // supertype, so the answer has to be the same one `isGcClass` gives.
    if (prototype == program.arrayBufferInstance.prototype) return true;
    if (prototype == program.functionPrototype) return true;
    let cls = prototype.getResolvedInstance("");
    if (cls == null) return false;
    if (isGcBufferViewClass(cls)) return true;
    let base = cls.base;
    return base != null && isGcBufferViewClass(base);
  }
  let base = prototype.basePrototype;
  if (base != null) return isGcPrototype(base);
  return true;
}

/**
 * A class's **own** declared fields, in member order — no base chain.
 *
 * Split out of {@link gcFieldsOf} because one question needs the declared set
 * alone: {@link isGcBufferViewClass} identifies a linear-buffer view by the shape of
 * what it declares, and walking the base chain there would make every subclass of a
 * view look like a view by inheritance rather than by declaration.
 */
export function ownFieldsOf(cls: Class, out: Property[] = []): Property[] {
  let members = cls.members;
  if (members) {
    for (let _values = Map_values(members), i = 0, k = _values.length; i < k; ++i) {
      let member = unchecked(_values[i]);
      if (member.kind != ElementKind.PropertyPrototype) continue;
      let property = (<PropertyPrototype>member).instance;
      if (!property || !property.isField) continue;
      if (property.parent != cls) continue;
      out.push(property);
    }
  }
  return out;
}

/**
 * Whether `cls` is a **linear-buffer view**: a standard-library class whose whole
 * state is a raw address into linear memory plus a length.
 *
 * `ArrayBufferView` and `DataView` are the two that declare this shape, and it is
 * the shape — not a name — that makes them safe to emit as GC structs. The rule is
 * the user's: a byte buffer **holds no GC references**, so its storage needs no
 * tracing, so its storage may stay in linear memory and be addressable, while the
 * *view object* becomes a small GC struct of scalars. The GC object is the handle,
 * not the payload.
 *
 * That is what resolves the addressability problem rather than working around it:
 * `dataStart` survives as an `i32` field, so every ABI site keeps its raw address,
 * and `changetype<usize>(aGCReference)` — the only thing that could smuggle a
 * reference into a blob — is already refused by name (AS100).
 */
/**
 * Whether `cls` is the standard library's **`ArrayBuffer`**: a linear payload with a GC
 * handle.
 *
 * The test is identity, and it has to be: an `ArrayBuffer` declares **zero** instance
 * fields, so the shape test that finds a buffer view (three named fields) cannot tell it
 * apart from `Object`. Identity is free here — `program.arrayBufferInstance` is resolved
 * during `Program#initialize` (`assert(this.arrayBufferInstance.id == 1)`), so this asks
 * about a class the program already has.
 *
 * The layout it gets is synthesised by the compiler, `{ <brand>, dataStart, byteLength }`,
 * because the declared class has no fields to synthesise from: `byteLength` is an
 * accessor that reads `rtSize` out of the object header, and the object pointer *is* the
 * payload start. So the GC object can only be the handle.
 */
export function isGcArrayBufferClass(cls: Class): bool {
  if (!gcClassesEnabled) return false;
  let program = cls.program;
  let instance = program.arrayBufferInstance;
  return instance != null && cls == instance;
}

/** Struct field index of an `ArrayBuffer`'s payload address in the GC layout. */
export const GC_ARRAYBUFFER_DATA_INDEX: i32 = 1;
/** Struct field index of an `ArrayBuffer`'s length in the GC layout. */
export const GC_ARRAYBUFFER_LENGTH_INDEX: i32 = 2;

export function isGcBufferViewClass(cls: Class): bool {
  if (!gcClassesEnabled) return false;
  // Standard library only, and that is not a limitation: a class of this shape
  // declared by a user is a class with a `buffer` field, and there is no reason to
  // guess whether its author meant a linear view or an ordinary object.
  if (!isStdlibClass(cls)) return false;
  let own = ownFieldsOf(cls);
  if (own.length != 3) return false;
  let sawBuffer = false;
  let sawDataStart = false;
  let sawByteLength = false;
  for (let i = 0, k = own.length; i < k; ++i) {
    let property = unchecked(own[i]);
    let type = property.type;
    switch (property.name) {
      case "buffer": {
        // An `ArrayBuffer`, either way. **"Pointer-shaped" was once the test**, because a
        // buffer was a linear block; now it is a GC handle, so the field holds a
        // reference and the engine traces it — which is better, because a view then
        // keeps its own buffer alive instead of relying on the arena. Both spellings are
        // accepted so the view stays a view whichever way the latch went.
        let bufferClass = type.classReference;
        if (bufferClass == null) return false;
        if (bufferClass.prototype != bufferClass.program.arrayBufferInstance.prototype &&
            isGcClass(bufferClass)) {
          return false; // some other GC class called `buffer`: not this shape
        }
        sawBuffer = true;
        break;
      }
      case "dataStart": {
        if (type.kind != TypeKind.Usize) return false;
        sawDataStart = true;
        break;
      }
      case "byteLength": {
        if (type.kind != TypeKind.I32) return false;
        sawByteLength = true;
        break;
      }
      default: return false;
    }
  }
  return sawBuffer && sawDataStart && sawByteLength;
}

/**
 * A managed class that is **trace-free at every depth**, and so is *exempt* from the GC
 * ABI rather than refused by it.
 *
 * ## Why this is a property of the fields and not a list or an annotation
 *
 * The user's ruling is that graphics units own their objects and the client's
 * representation is naturally a non-GC handle; a record the C side reads through a pointer
 * must have the layout the C declaration describes. **A GC reference has no place in one** —
 * so a record built only from scalars needs no tracing, and the collector has no business
 * with it. That is a fact about the fields, and it is why this is derived rather than
 * declared: the C boundary decides, and a generated record cannot be relied on to carry an
 * annotation (the six in `ogre.generated.ts` are emitted by a codegen tool).
 *
 * Counted on the framework's own generated records: 108 fields, 0 references — 43 `f32`,
 * 41 `u32`, 10 `Vec3fValue`, 6 `u64`, 5 `QuatfValue`, 3 `i32`.
 *
 * ## The rule
 *
 * A class is exempt when **it is declared as a C record** (`@unmanaged`, which
 * `export struct` implies in this dialect) **and every field is trace-free** — including
 * the base chain's, which `gcFieldsOf` walks.
 *
 * ## Why the `@unmanaged` half is load-bearing, measured
 *
 * "Trace-free" alone is far too wide, and the guest proves it: 85 of its 141 classes are
 * trace-free, and **8 of them are held by classes that also hold references** —
 * `World.solver` (`Solver`), `AppShell.canvas` (`Canvas`), `Painter.theme` (`Theme`),
 * `Layer.frame` (`Frame`), `WidgetTree.defaultPage` (`FontPage`). Making every trace-free
 * class exempt turns those eight into crossings and the framework stops compiling, for
 * classes that never needed a C layout at all — `Solver` is an ordinary object that merely
 * happens to hold no references.
 *
 * So the exemption is for records whose **layout is a contract**: a `struct` the C side
 * reads. An ordinary trace-free class stays a GC struct — it is a heap object with no
 * references, which is exactly what the engine is good at. That is what keeps the island
 * closed, and it is the user's own phrasing: a record the C side reads through a pointer.
 *
 * Note the recursion: an exempt class's field of another exempt class is a **linear
 * pointer**, so a chain or even a cycle of trace-free classes is exempt as a whole and
 * stays entirely in linear memory. That is why the cycle guard answers `true`: a cycle of
 * scalars is still a cycle of scalars, and refusing it would split an island that is
 * internally consistent.
 */
export function isGcExempt(cls: Class): bool {
  if (!gcClassesEnabled) return false;
  if (gcExemptPath.includes(cls)) return true; // a cycle of trace-free classes
  gcExemptPath.push(cls);
  let exempt = isGcExemptImpl(cls);
  gcExemptPath.pop();
  return exempt;
}

/** Classes currently being tested for exemption, so a cycle answers instead of overflowing. */
let gcExemptPath: Class[] = [];

function isGcExemptImpl(cls: Class): bool {
  // A record the program declares as `@unmanaged` is already linear by declaration, and it
  // has its own invariant (no references) enforced separately.
  // **A C record by declaration, or nothing.** `@unmanaged` is what says "the layout is
  // the C declaration's"; without it a trace-free class is an ordinary heap object that
  // the engine can collect and that nothing needs to be linear.
  if (!cls.hasDecorator(DecoratorFlags.Unmanaged)) return false;
  // A synthesised layout is not a C record: `Array<T>`/`ArrayBuffer` are handles whose
  // fields the compiler invents, so "trace-free fields" is not the question to ask.
  if (isStdlibClass(cls)) return false;
  // `Object` is the root of the pointer-shaped world and declares nothing; it is not a
  // C record, and exempting it would take the whole tree with it.
  if (cls.prototype == cls.program.objectPrototype) return false;
  // An `@inline struct` is a *value*: it has no identity and cannot be allocated on its
  // own. Exempting it is harmless and correct — it is stored inline wherever it appears.
  let fields = gcFieldsOf(cls);
  for (let i = 0, k = fields.length; i < k; ++i) {
    if (!gcTraceFreeType(unchecked(fields[i]).type)) return false;
  }
  return true;
}

/** Whether a field type can live in a linear record: a scalar, or a trace-free record. */
export function gcTraceFreeType(type: Type): bool {
  let nonNullable = type.nonNullableType;
  if (nonNullable.isValue) return true;
  let cls = nonNullable.classReference;
  if (cls == null) return false;
  // An inline record is stored by value, so it is trace-free exactly when its fields are.
  if (cls.hasDecorator(DecoratorFlags.InlineStruct)) return isGcExempt(cls);
  // A pointer to another exempt class is a linear pointer: not traced.
  return isGcExempt(cls);
}

/**
 * Whether a `Map`/`Set` instantiation stores a **GC reference** as its key or value.
 *
 * `MapEntry<K,V>` is `@unmanaged` — a linear record — so a reference in `K` or `V` has no
 * representation there. Answered from the type arguments rather than from the fields,
 * because the declared fields (`buckets`/`entries`: `ArrayBuffer`) are all fine and the
 * blocker is one indirection away.
 */
function gcContainerHoldsReference(cls: Class): bool {
  let arguments_ = cls.typeArguments;
  if (arguments_ == null) return false;
  for (let i = 0, k = arguments_.length; i < k; ++i) {
    if (gcReferenceShaped(unchecked(arguments_[i]))) return true;
  }
  return false;
}

/**
 * Whether a type **would be** a GC reference if the program were uniform — answered
 * without consulting the latch.
 *
 * The latch-free half matters in both directions and for the same reason: `gcStringOf`
 * answers "is this a wasm array *right now*", and when the program is non-uniform nothing
 * is. So a check that decides *whether the program can be uniform* cannot use it: measured
 * twice, once as a `Map<string,i32>` program taking the GC ABI trivially, and once as a
 * report that said "116 eligible, held back only by the latch" while the one thing holding
 * the latch off was the `Map` it could not see.
 */
export function gcReferenceShaped(type: Type): bool {
  if (!gcClassesEnabled) return false;
  let nonNullable = type.nonNullableType;
  let cls = nonNullable.classReference;
  if (cls == null) return false;
  let program = cls.program;
  // A `String` is `(array (mut u16))`; an `Array<T>` is a synthesised struct; a
  // `StaticArray<T>` is a wasm array. All three are references under the flag.
  if (cls.prototype == program.stringInstance.prototype) return true;
  if (cls.prototype == program.arrayPrototype) return true;
  if (cls.prototype == program.objectPrototype) return false;
  if (isStdlibClass(cls)) return isStdlibGcClass(cls);
  // A user class: a reference exactly when it is a GC struct rather than an exempt record.
  if (cls.hasDecorator(DecoratorFlags.Unmanaged)) return false;
  return !isGcExempt(cls);
}

/**
 * Whether `cls` is represented as something **other than a struct** under the flag.
 *
 * `String` and `StaticArray<T>` are wasm GC *arrays*; `ensureType` answers them before any
 * class arm, so `isGcClass` must not also claim a struct for them. This is a property of
 * the type rather than a list of names: both are recognised by the predicates the rest of
 * the compiler already uses.
 */
export function hasNonStructGcRepresentation(cls: Class): bool {
  let type = cls.type;
  // **`Object` is the root of the pointer-shaped world, and it stays there.** It declares no
  // fields, so the ordinary rule would make it a GC struct — and then *every* class becomes
  // its subtype, because the resolver gives every class `Object` as its base. Measured: the
  // emitted types turned into `(type $~lib/object/Object (sub (struct …)))` and every class
  // in the tree re-based onto it, which changes the prefix contract and the structural
  // identity of the whole program for one empty struct.
  //
  // It is also the class `implicitlyExtendsObject` exists to special-case: a flat class's
  // only ancestor is implicit, and that is what makes a flat class flat.
  if (cls.prototype == cls.program.objectPrototype) return true;
  // **An `@unmanaged` class is a linear record by declaration** and can never be a GC
  // struct. It declares the layout it wants, so `@unmanaged` and "struct the engine
  // traces" are contradictory. Measured: without this, `itcms`'s own private
  // `@unmanaged class Object extends BLOCK` became a struct — it has no base worth
  // walking and all-scalar fields — and every `changetype<usize>` in the collector turned
  // into a refused reference conversion.
  if (cls.hasDecorator(DecoratorFlags.Unmanaged)) return true;
  return gcStringOf(type) || gcArrayElementOf(type) != null;
}

/**
 * Whether `cls` is a **standard-library class this slice emits as a GC struct**.
 *
 * One function because three places must agree — `isGcClass` (the latch-applied
 * answer), `isGcEligible` (the latch-free question the report asks), and the field
 * support test — and three copies is how the `String` case went missing in three
 * places in GC11.
 */
function isStdlibGcClass(cls: Class): bool {
  let program = cls.program;
  // `Array<T>`: a synthesised layout, `{ brand, data, length_ }`.
  if (cls.prototype == program.arrayPrototype) return true;
  // `ArrayBuffer`: a synthesised layout, `{ brand, dataStart, byteLength }` — the handle,
  // with the payload left in the never-free arena.
  if (isGcArrayBufferClass(cls)) return true;
  // A buffer view: a synthesised layout, `{ brand, buffer, dataStart, byteLength }`
  // where `buffer` is the linear address of the payload rather than a reference.
  if (isGcBufferViewClass(cls)) return true;
  // **`Function<T>`, whose two fields are both scalars.** `_index` is a table index and
  // `_env` an address into the never-free arena, so the struct `{ <brand>, _index, _env }`
  // is **untraced** — correctly: `_env` points at linear memory nothing traces, and a
  // reference here would be a lie the collector would act on.
  //
  // No synthesised layout is needed, unlike `Array`/`ArrayBuffer`: the declared fields are
  // already the right shape and `call_indirect` keeps using `_index`. What changes is only
  // that the *object* is a struct rather than a linear block, so `_index`/`_env` are
  // reached by `struct.get`/`struct.set` instead of `load`/`store` at an offset — and the
  // contract `assertFunctionLayout` enforces (`_index` at 0, `_env` at pointer width) is
  // replaced by the field *indices*, which the type builder fixes.
  if (cls.prototype == program.functionPrototype) {
    return gcStructFieldsSupported(cls, true);
  }
  // **`Map` and `Set`, whose only managed field is an `ArrayBuffer`.** Identity, not
  // shape: their layouts are `{ buckets: ArrayBuffer, bucketsMask, entries: ArrayBuffer,
  // entriesCapacity, entriesOffset, entriesCount }` and the same with `value` only, and a
  // shape test for those names would be a name list with extra steps. The guard is real
  // rather than decorative — if a future field stops being storable the class quietly
  // stops being a GC struct instead of emitting a bad type.
  //
  // **Their `MapEntry<K,V>` storage is a separate question**, and deliberately not
  // answered here: entries are `@unmanaged` and hold `K`/`V` in linear memory, which no
  // analysis of a class's *declared* fields can see. See the note in `docs/wasm-gc.md`.
  if (cls.prototype == program.mapPrototype || cls.prototype == program.setPrototype) {
    // **A container whose stored type is a reference is refused**, and the reason is its
    // *entries*, not its declared fields: `MapEntry<K,V>` is `@unmanaged` and `entry.key =
    // key` writes `K` into a linear record, which under the GC ABI means writing a
    // reference to an address. Measured: `Map<string, i32>` aborts inside Binaryen with
    // `isBasic() && "Basic type expected"` — a crash with no location, which is exactly
    // what a named refusal is for.
    //
    // So a reference-keyed `Map`/`Set` stays pointer-shaped, the program stays non-uniform,
    // and the report says why. `Map<i32,i32>` and `Set<i32>` are unaffected: scalars in a
    // linear record are the representation that already worked.
    if (gcContainerHoldsReference(cls)) return false;
    return gcStructFieldsSupported(cls, true);
  }
  // **A subclass of a buffer view** — the eleven typed arrays. It declares nothing
  // of its own (`Uint8Array` is an empty body over the base), so its struct is the
  // base's prefix exactly, and it is one exactly when the base is.
  let base = cls.base;
  if (base != null && !cls.prototype.implicitlyExtendsObject && isGcBufferViewClass(base)) {
    return gcStructFieldsSupported(cls, true);
  }
  return false;
}


/**
 * A class's fields in **struct order**: the base chain first, then its own.
 *
 * That order is a wasm requirement rather than a convention — a subtype's struct
 * must begin with an exact prefix of its supertype's fields, in order, or
 * `ref.test` cannot see the relationship and the type builder rejects the
 * declaration. It is also the order field *indices* come from, so this is the one
 * place a `struct.get`/`struct.set` index may be computed (`gcFieldIndex`).
 *
 * Filtered by `property.parent == classInstance` rather than trusting that
 * `members` holds only own fields: whether it does is a resolver detail, and a
 * duplicate would silently shift every index after it.
 */
export function gcFieldsOf(classInstance: Class, out: Property[] = []): Property[] {
  let base = classInstance.base;
  if (base != null && isGcClass(base)) gcFieldsOf(base, out);
  return ownFieldsOf(classInstance, out);
}

/** Represents a resolved type. */
export class Type {
  /** Type kind. */
  kind: TypeKind;
  /** Type flags. */
  flags: TypeFlags;
  /** Size in bits. */
  size: i32;
  /** Underlying class reference, if a class type. */
  classReference: Class | null = null;
  /** Underlying signature reference, if a function type. */
  signatureReference: Signature | null = null;
  /** Element type of a {@link TypeKind.FixedArray}, else `null`. */
  fixedElementType: Type | null = null;
  /** Element count of a {@link TypeKind.FixedArray}, else `0`. */
  fixedLength: i32 = 0;
  /**
   * Who owns a {@link TypeKind.FixedArray}'s storage — the second axis of the
   * kind, alongside the element and the length.
   *
   * The memory model was already on the AST (`TypeNode.memoryModel`) and was
   * simply dropped before Landing 5a.5: `Type.fixedArray` interned one object
   * per `(element, length)`, so `[u32 * 4]`, `@unmanaged [u32 * 4]`,
   * `@managed [u32 * 4]` and `@inline [u32 * 4]` were **the same Type**, and
   * the prefix was decorative — measured, all four emitted identical code.
   *
   * The two forms are not the same thing. `[u32 * 4]` is 16 bytes of inline
   * elements with no address of its own; `@unmanaged [u32 * 4]` is a pointer to
   * four elements, i.e. 4 bytes. Part of {@link equals} for the same reason
   * {@link dynamicMemoryModel} is: interning them together would make the two
   * spellings the same object, and no downstream test could tell them apart.
   */
  fixedMemoryModel: MemoryModelCode = MemoryModelCode.None;
  /**
   * Element type of a {@link TypeKind.UnmanagedArray}, else `null`.
   *
   * Kept apart from {@link fixedElementType} rather than shared. The two kinds
   * say different things -- an extent versus an address -- and a shared field
   * would force every `kind == FixedArray` test in the compiler to become a
   * three-way test, with the risk that one of them silently starts treating an
   * address as an extent. `size` differs for the same reason: this kind's size is
   * the pointer's, not the element's replicated.
   */
  unmanagedElementType: Type | null = null;
  /** Element type of a {@link TypeKind.DynamicArray}, else `null`. */
  dynamicArrayElementType: Type | null = null;
  /**
   * Who owns a {@link TypeKind.DynamicArray}'s buffer.
   *
   * {@link MemoryModelCode.Unmanaged} for a C-compatible header-prefixed buffer;
   * {@link MemoryModelCode.Managed} is Landing 4d. Part of {@link equals}, so the
   * two cannot be confused for one another even though they share a kind and a
   * layout.
   */
  dynamicMemoryModel: MemoryModelCode = MemoryModelCode.None;
  /**
   * Alignment (log2) of a {@link TypeKind.FixedArray}.
   *
   * For the **value** form this is the element's. `alignLog2` cannot derive
   * that from `byteSize` -- a 24-byte `f32[6]` would report 16-byte alignment
   * (`31 - clz(24)` = 4), and a 96-byte `f32[24]` would report 64. An array is
   * aligned as its element is, no matter how long it is, so the value is carried
   * rather than computed.
   *
   * For the **view** form it is the *pointer's*, because that is what the value
   * is: the extent says nothing about how the address is aligned.
   */
  private fixedAlignLog2: i32 = 0;
  /** Respective non-nullable type, if nullable. */
  private _nonNullableType: Type | null = null;
  /** Respective nullable type, if non-nullable. */
  private _nullableType: Type | null = null;
  /** Cached Binaryen type reference. */
  ref: TypeRef = 0;

  /** Constructs a new resolved type. */
  constructor(kind: TypeKind, flags: TypeFlags, size: u32) {
    this.kind = kind;
    this.flags = flags;
    this.size = size;
    if (!(flags & TypeFlags.Nullable)) {
      this._nonNullableType = this;
    } else {
      this._nullableType = this;
    }
  }

  /** Returns the closest int type representing this type. */
  get intType(): Type {
    if (this == Type.auto) return this; // keep auto as a hint
    switch (this.kind) {
      case TypeKind.Bool:
      case TypeKind.I32:
      case TypeKind.F32:   return Type.i32;
      case TypeKind.I8:    return Type.i8;
      case TypeKind.I16:   return Type.i16;
      case TypeKind.F64:
      case TypeKind.I64:   return Type.i64;
      case TypeKind.Isize: return this.size == 64 ? Type.isize64 : Type.isize32;
      case TypeKind.U8:    return Type.u8;
      case TypeKind.U16:   return Type.u16;
      case TypeKind.U32:   return Type.u32;
      case TypeKind.U64:   return Type.u64;
      case TypeKind.Usize: return this.size == 64 ? Type.usize64 : Type.usize32;
      default: return Type.i32;
    }
  }

  /** Substitutes this type with the auto type if this type is void. */
  get exceptVoid(): Type {
    return this.kind == TypeKind.Void ? Type.auto : this;
  }

  /** Size in bytes. */
  get byteSize(): i32 {
    // ceiled div by 8
    return this.size + 7 >>> 3;
  }

  /**
   * Gets this type's logarithmic alignment in memory.
   *
   * An `UnmanagedArray` deliberately does **not** take the {@link fixedAlignLog2}
   * branch. It is one pointer, so its alignment is the pointer's -- which is what
   * the `byteSize` fallback already yields, since this kind's `size` is the
   * pointer's and not the element's replicated. There is no element alignment to
   * borrow here; the element is not stored in this type.
   */
  get alignLog2(): i32 {
    if (this.kind == TypeKind.FixedArray) return this.fixedAlignLog2;
    return 31 - clz<i32>(this.byteSize);
  }

  /** Tests if this type represents a basic value. */
  get isValue(): bool {
    return this.is(TypeFlags.Value);
  }

  /** Tests if this type represents an integer value. */
  get isIntegerValue(): bool {
    return this.is(TypeFlags.Integer | TypeFlags.Value);
  }

  /** Tests if this type represents a small (< 32 bits) integer value. */
  get isShortIntegerValue(): bool {
    return this.is(TypeFlags.Short | TypeFlags.Integer | TypeFlags.Value);
  }

  /** Tests if this type represents a long (> 32 bits) integer value. */
  get isLongIntegerValue(): bool {
    return this.is(TypeFlags.Long | TypeFlags.Integer | TypeFlags.Value);
  }

  /** Tests if this type represents a signed integer value. */
  get isSignedIntegerValue(): bool {
    return this.is(TypeFlags.Signed | TypeFlags.Integer | TypeFlags.Value);
  }

  /** Tests if this type represents an unsigned integer value. */
  get isUnsignedIntegerValue(): bool {
    return this.is(TypeFlags.Unsigned | TypeFlags.Integer | TypeFlags.Value);
  }

  /** Tests if this type represents a varying (in size) integer value. */
  get isVaryingIntegerValue(): bool {
    return this.is(TypeFlags.Varying | TypeFlags.Integer | TypeFlags.Value);
  }

  /** Tests if this type represents an integer, including references.  */
  get isIntegerInclReference(): bool {
    return this.is(TypeFlags.Integer);
  }

  /** Tests if this type represents a floating point value. */
  get isFloatValue(): bool {
    return this.is(TypeFlags.Float | TypeFlags.Value);
  }

  /** Tests if this type represents a numeric (integer or floating point) value. */
  get isNumericValue(): bool {
    return this.isIntegerValue || this.isFloatValue;
  }

  /** Tests if this type represents a boolean value. */
  get isBooleanValue(): bool {
    return this == Type.bool;
  }

  /** Tests if this type represents a vector value. */
  get isVectorValue(): bool {
    return this.is(TypeFlags.Vector | TypeFlags.Value);
  }

  /** Tests if this type represents an internal or external reference. */
  get isReference(): bool {
    return this.is(TypeFlags.Reference);
  }

  /** Tests if this type represents a nullable internal or external reference. */
  get isNullableReference(): bool {
    return this.is(TypeFlags.Nullable | TypeFlags.Reference);
  }

  /** Tests if this type represents an internal object. */
  get isInternalReference(): bool {
    return this.is(TypeFlags.Integer | TypeFlags.Reference);
  }

  /** Tests if this type represents an external object. */
  get isExternalReference(): bool {
    return this.is(TypeFlags.External | TypeFlags.Reference);
  }

  /** Tests if this type represents a nullable external object. */
  get isNullableExternalReference(): bool {
    return this.is(TypeFlags.Nullable | TypeFlags.External | TypeFlags.Reference);
  }

  /** Gets the underlying class of this type, if any. */
  getClass(): Class | null {
    return this.isInternalReference
      ? this.classReference
      : null;
  }

  /** Tests if this type represents a class. */
  get isClass(): bool {
    return this.getClass() != null;
  }

  /** Gets the underlying class or wrapper class of this type, if any. */
  getClassOrWrapper(program: Program): Class | null {
    let classReference = this.getClass();
    if (classReference) {
      // typical class
      return classReference;
    } else {
      let signatureReference = this.getSignature();
      if (signatureReference) {
        // function wrapper
        let type = signatureReference.type;
        let wrapper = assert(program.resolver.resolveClass(program.functionPrototype, [ type ]));
        wrapper.wrappedType = type;
        return wrapper;
      } else {
        let wrapperClasses = program.wrapperClasses;
        if (wrapperClasses.has(this)) {
          // value wrapper
          return assert(wrapperClasses.get(this));
        }
      }
    }
    return null;
  }

  lookupOverload(kind: OperatorKind, program: Program): Function | null {
    let classReference = this.getClassOrWrapper(program);
    if (classReference) {
      return classReference.lookupOverload(kind);
    }
    return null;
  }

  /** Gets the underlying function signature of this type, if any. */
  getSignature(): Signature | null {
    return this.isInternalReference
      ? this.signatureReference
      : null;
  }

  /** Tests if this type represents a function. */
  get isFunction(): bool {
    return this.getSignature() != null;
  }

  /** Tests if this is a managed type that needs GC hooks. */
  get isManaged(): bool {
    if (this.isInternalReference) {
      let classReference = this.classReference;
      if (classReference) return !classReference.hasDecorator(DecoratorFlags.Unmanaged);
      return this.signatureReference != null; // function references are managed
    }
    return false;
  }

  /** Tests if this is a class type explicitly annotated as unmanaged. */
  get isUnmanaged(): bool {
    let classReference = this.classReference;
    return classReference != null && classReference.hasDecorator(DecoratorFlags.Unmanaged);
  }

  /**
   * This type's extent in bytes when it is stored **inline**, rather than by
   * reference.
   *
   * For a scalar the two are the same number, and for an ordinary class neither
   * is what an inline array wants -- a class element is stored as its 4-byte
   * reference, so `byteSize` is right there. The one case where `byteSize` is
   * **wrong** is a C-layout record (`@unmanaged` / `@managed struct`, and
   * `@inline struct`, which the parser also flags `@unmanaged`): there
   * `byteSize` is the reference width (4) while the bytes an inline element
   * actually occupies are the record's layout size, `Class#nextMemoryOffset`.
   *
   * That is the same pair `builtin_sizeof` distinguishes
   * (`builtins.ts`, the `Unmanaged | ManagedStruct` branch), and it is why
   * `sizeof<Props>()` answered 16 while `sizeof<[Props * 4]>()` answered 16
   * instead of 64: the array's size was built from the reference width.
   */
  get inlineExtentBytes(): i32 {
    let classReference = this.classReference;
    if (
      classReference != null &&
      (classReference.hasDecorator(DecoratorFlags.Unmanaged) ||
       classReference.hasDecorator(DecoratorFlags.ManagedStruct))
    ) {
      return <i32>classReference.nextMemoryOffset;
    }
    return this.byteSize;
  }

  /**
   * This type's alignment as a log2 when it is stored inline.
   *
   * A record's alignment is the strongest of its fields', accumulated while the
   * resolver lays it out (`Class#alignLog2`), and **not** `Type#alignLog2` —
   * which reads the class's 4-byte reference size and would report 2 for every
   * record, including one aligned to 8. The same distinction `builtin_alignof`
   * makes, for the same reason.
   */
  get inlineAlignLog2(): i32 {
    let classReference = this.classReference;
    if (
      classReference != null &&
      (classReference.hasDecorator(DecoratorFlags.Unmanaged) ||
       classReference.hasDecorator(DecoratorFlags.ManagedStruct))
    ) {
      return classReference.alignLog2;
    }
    // Includes a nested `FixedArray`, whose own `alignLog2` carries its element's
    // alignment rather than deriving one from a non-power-of-two extent.
    return this.alignLog2;
  }

  get isMemory(): bool {
    switch (this.kind) {
      case TypeKind.Bool:
      case TypeKind.I8:
      case TypeKind.I16:
      case TypeKind.I32:
      case TypeKind.I64:
      case TypeKind.Isize:
      case TypeKind.U8:
      case TypeKind.U16:
      case TypeKind.U32:
      case TypeKind.U64:
      case TypeKind.Usize:
      case TypeKind.F32:
      case TypeKind.F64:
      case TypeKind.V128: return true;
      // A fixed array is a memory type: it has bytes and an alignment, and its
      // own `alignLog2` already carries its element's (see the comment above it).
      // Without this, a fixed array cannot be an element of another one --
      // `[[i32 * 4] * 2]` was refused as "a fixed-size array of '[i32 * 4]'"
      // even though the inner array is exactly 16 inline bytes.
      case TypeKind.FixedArray: return true;
    }
    return false;
  }

  /** Gets the corresponding non-nullable type. */
  get nonNullableType(): Type {
    // Every type has a corresponding non-nullable type
    return assert(this._nonNullableType);
  }

  /** Gets the corresponding nullable type, if applicable. */
  get nullableType(): Type | null {
    return this.isReference
      ? this.asNullable() // Every reference type has a corresponding nullable type
      : null;             // Other types do not have a nullable type
  }

  /** Computes the sign-extending shift in the target type. */
  computeSmallIntegerShift(targetType: Type): i32 {
    return targetType.size - this.size;
  }

  /** Computes the truncating mask in the target type. */
  computeSmallIntegerMask(targetType: Type): i32 {
    let size = this.size;
    if (!this.is(TypeFlags.Unsigned)) size -= 1;
    return ~0 >>> (targetType.size - size);
  }

  /** Tests if this type has (all of) the specified flags. */
  is(flags: TypeFlags): bool { return (this.flags & flags) == flags; }
  /** Tests if this type has any of the specified flags. */
  isAny(flags: TypeFlags): bool { return (this.flags & flags) != 0; }

  /** Composes the respective nullable type of this type. */
  asNullable(): Type {
    assert(this.isReference);
    let nullableType = this._nullableType;
    if (!nullableType) {
      assert(!this.isNullableReference);
      this._nullableType = nullableType = new Type(this.kind, this.flags | TypeFlags.Nullable, this.size);
      nullableType.classReference = this.classReference;
      nullableType.signatureReference = this.signatureReference;
      nullableType._nonNullableType = this;
    }
    return nullableType;
  }

  /** Use unsigned type for according size if possible. */
  toUnsigned(): Type {
    switch (this.kind) {
      case TypeKind.I8:    return Type.u8;
      case TypeKind.I16:   return Type.u16;
      case TypeKind.I32:   return Type.u32;
      case TypeKind.I64:   return Type.u64;
      case TypeKind.Isize: return this.size == 64 ? Type.usize64 : Type.usize32;
    }
    return this;
  }

  /** Tests if this type equals the specified. */
  equals(other: Type): bool {
    if (this.kind != other.kind) {
      return false;
    }
    if (this.kind == TypeKind.FixedArray) {
      // Element, length **and model**: `[u32 * 4]` is 16 bytes of inline
      // elements and `@unmanaged [u32 * 4]` is a 4-byte pointer to them. Same
      // element, same count, different storage — so different types, exactly
      // as the `DynamicArray` arm below compares its model.
      let elementType = this.fixedElementType;
      let otherElementType = other.fixedElementType;
      return (
        elementType != null && otherElementType != null
        && this.fixedLength == other.fixedLength
        && this.fixedMemoryModel == other.fixedMemoryModel
        && elementType.equals(otherElementType)
      );
    }
    if (this.kind == TypeKind.DynamicArray) {
      // Element **and** model: `@unmanaged @dynamic [u32 * n]` and
      // `@managed @dynamic [u32 * n]` are the same element in buffers with
      // different owners, so they are different types.
      let elementType = this.dynamicArrayElementType;
      let otherElementType = other.dynamicArrayElementType;
      return (
        elementType != null && otherElementType != null
        && this.dynamicMemoryModel == other.dynamicMemoryModel
        && elementType.equals(otherElementType)
      );
    }
    if (this.kind == TypeKind.UnmanagedArray) {
      // The element decides, and there is no length to compare: `[u32 *]` is the
      // same type however many elements the caller says are there.
      let elementType = this.unmanagedElementType;
      let otherElementType = other.unmanagedElementType;
      return (
        elementType != null && otherElementType != null
        && elementType.equals(otherElementType)
      );
    }
    if (this.isReference) {
      let selfSignatureReference = this.signatureReference;
      let otherSignatureReference = other.signatureReference;

      return (
        this.classReference == other.classReference
        && selfSignatureReference == otherSignatureReference
        && this.isNullableReference == other.isNullableReference
      );
    }
    return true;
  }

  /** Tests if a value of this type is assignable to the target type incl. implicit conversion. */
  isAssignableTo(target: Type, signednessIsRelevant: bool = false): bool {
    let currentClass: Class | null;
    let targetClass: Class | null;
    let currentFunction: Signature | null;
    let targetFunction: Signature | null;
    if (this.isReference) {
      if (target.isReference) {
        if (!this.isNullableReference || target.isNullableReference) {
          if (currentClass = this.getClass()) {
            if (targetClass = target.getClass()) {
              return currentClass.isAssignableTo(targetClass);
            }
          } else if (currentFunction = this.getSignature()) {
            if (targetFunction = target.getSignature()) {
              return currentFunction.isAssignableTo(targetFunction);
            }
          } else if (this.isExternalReference) {
            if (
              this.kind == target.kind ||
              (target.kind == TypeKind.Any && this.kind != TypeKind.Extern)
            ) {
              return true;
            }
          }
        }
      }
    } else if (!target.isReference) {
      if (this.isIntegerValue) {
        if (target.isIntegerValue) {
          if (
            !signednessIsRelevant ||
            this.isBooleanValue || // a bool (0 or 1) can be safely assigned to all sorts of integers
            this.isSignedIntegerValue == target.isSignedIntegerValue
          ) {
            return this.size <= target.size;
          }
        } else if (target.kind == TypeKind.F32) {
          return this.size <= 23; // mantissa bits
        } else if (target.kind == TypeKind.F64) {
          return this.size <= 52; // ^
        }
      } else if (this.isFloatValue) {
        if (target.isFloatValue) {
          return this.size <= target.size;
        }
      } else if (this.isVectorValue) {
        if (target.isVectorValue) {
          return this.size == target.size;
        }
      }
    }
    // `TypeKind.UnmanagedArray` and `TypeKind.FixedArray` are deliberately absent
    // above. Their assignability is decided by
    // {@link isStrictlyAssignableTo}'s `this.kind == target.kind`, which is what
    // every other non-scalar, non-reference type already relies on. Adding an
    // arm here would make the two predicates disagree -- this one element-aware,
    // that one element-blind -- and the permissive one wins wherever a strict
    // check runs first.
    //
    // Measured, not assumed: with such an arm present, `const q: [f64 *] = p`
    // over a `[u32 *]` p still compiled, because the assignment path asks the
    // strict predicate. So the arm was dead for same-type assignment and
    // unenforceable for cross-type. Element-blind assignment is therefore a real
    // (small) gap, shared with `T[N]`; closing it means changing both predicates
    // together, which is not this landing.
    return false;
  }

  /** Tests if a value of this type is assignable to the target type excl. implicit conversion. */
  isStrictlyAssignableTo(target: Type, signednessIsRelevant: bool = false): bool {
    if (this.isReference) return this.isAssignableTo(target);
    else if (target.isReference) return false;
    // not dealing with references from here on
    if (this.isIntegerValue) {
      return target.isIntegerValue && target.size == this.size && (
        !signednessIsRelevant ||
        this.isSignedIntegerValue == target.isSignedIntegerValue
      );
    }
    // The array kinds compare their **element**, not just the kind. Without this
    // arm `[u32 *]` was strictly assignable to `[f64 *]`, and `u32[4]` to
    // `f64[4]`: for an array, kind equality is all that survived once the
    // element was factored out, so every array of one kind was interchangeable
    // with every other of the same kind.
    //
    // That was benign while no element access existed, and stops being benign
    // the moment one does: `y[i]` types the element from the pointer, so a callee
    // handed a `[u32 *]` as a `[f64 *]` reads f64s out of u32 bytes with no cast
    // to mark the reinterpretation. Same-element assignment is unaffected, so
    // nothing that was correct changes.
    //
    // The escape hatch is deliberately **not** here: `changetype` asks
    // `isChangeableTo`, which still compares kinds only. Explicit
    // reinterpretation stays possible, and stays visible at the call site.
    if (
      this.kind == TypeKind.FixedArray ||
      this.kind == TypeKind.UnmanagedArray
    ) {
      return this.equals(target);
    }
    return this.kind == target.kind;
  }

  /** Tests if this type has a subtype assignable to the target type. */
  hasSubtypeAssignableTo(target: Type): bool {
    let thisClass = this.getClass();
    let targetClass = target.getClass();
    if (!thisClass || !targetClass) return false; // TODO: what about basic types?
    return thisClass.hasSubclassAssignableTo(targetClass);
  }

  /** Tests if a value of this type can be changed to the target type using `changetype`. */
  isChangeableTo(target: Type): bool {
    // A `[T *]` is an address, so the ways in are an address -- `usize`, `isize`,
    // any integer -- or another `[T *]`. This is the cell
    // `changetype<[T *]>(ptr)` needs. It is not the *only* way in (a parameter
    // is the other), but without it the form could not be produced from an
    // address the caller already holds, which is the shape every caller of the
    // engine's collision solver has.
    //
    // Measured before this arm: `changetype<[u32 *]>(p)` over a `usize` p was
    // `AS202: Type 'usize' cannot be changed to type '[u32 *]'` -- the general
    // `this.kind == target.kind` below answers false across kinds, so the
    // scoping's prediction that no change was needed here was wrong.
    //
    // Element types need **not** match. That is the whole difference between
    // this predicate and `isStrictlyAssignableTo`, which now compares elements
    // (the arm above): assignment promises the bytes mean the same thing, while
    // `changetype` promises only that the caller said so out loud. So
    // `changetype<[f64 *]>(u32Ptr)` stays legal -- it is the explicit
    // reinterpretation, the same cell `changetype<f64>(usizeValue)` occupies.
    if (target.kind == TypeKind.UnmanagedArray) {
      return this.is(TypeFlags.Integer) || this.kind == TypeKind.UnmanagedArray;
    }
    // Same cell for `@unmanaged @dynamic [T * n]`: it is also one address, and
    // `changetype` is how a caller who already holds a header pointer names it.
    // The length is *not* part of this test — it lives in the buffer, and the
    // builtin validates it on the way in (`builtins.ts`, `builtin_changetype`).
    if (target.kind == TypeKind.DynamicArray) {
      return this.is(TypeFlags.Integer) || this.kind == TypeKind.DynamicArray;
    }
    // `[T * N]` is the same address `[T *]` is, with an extent the caller
    // asserts: an integer names one, and so does another fixed array. This is
    // the cell `changetype<[T * N]>(ptr)` occupies, and without it the form
    // answered `AS202: Type 'usize' cannot be changed to type 'u32[4]'` -- the
    // same pre-measurement miss the `UnmanagedArray` arm above records.
    //
    // The extent is deliberately not checked here, because an address carries
    // no count: `changetype<[u32 * 4]>(p)` is the caller saying "four elements
    // follow p", exactly as `changetype<[u32 *]>(p)` says "some follow p".
    //
    // Since Landing 5a.5 this is the **view** form's cell only. A value-form
    // target (`[T * N]`, `@inline [T * N]`) has no address to hold: an integer
    // names one, but the value it would be stored in is inline bytes, so there
    // is no slot to put the address in until Landing 5b. Refused here so the
    // general answer is "no", and refused again with a targeted diagnostic at
    // the builtin, where the operand and its type are both in hand.
    if (target.kind == TypeKind.FixedArray) {
      if (target.fixedMemoryModel == MemoryModelCode.None ||
          target.fixedMemoryModel == MemoryModelCode.Inline) return false;
      return this.is(TypeFlags.Integer) || this.kind == TypeKind.FixedArray;
    }
    // special in that it allows integer references as well
    if (this.is(TypeFlags.Integer) && target.is(TypeFlags.Integer)) {
      let size = this.size;
      return size == target.size && (
        size >= 32 ||
        this.is(TypeFlags.Signed) == target.is(TypeFlags.Signed)
      );
    }
    return this.kind == target.kind;
  }

  /** Tests if this type can extend or implement the given type. */
  canExtendOrImplement(base: Type): bool {
    // Both must be class types
    let thisClass = this.getClass();
    let baseClass = base.getClass();
    if (!thisClass || !baseClass) return false;
    // Both types must be either managed or unmanaged
    if (this.isManaged != base.isManaged) return false;
    // Both types must be either internal or external references
    if (this.isInternalReference) {
      if (!base.isInternalReference) return false;
    } else if (this.isExternalReference) {
      if (!base.isExternalReference) return false;
    } else {
      return false;
    }
    return true;
  }

  /** Computes the common type of a binary-like expression, if any. */
  static commonType(
    /** LHS type. */
    left: Type,
    /** RHS type. */
    right: Type,
    /** Contextual type, if any. */
    contextualType: Type = Type.auto,
    /** Whether signedness is relevant. */
    signednessIsRelevant: bool = false
  ): Type | null {
    // Compute LUB of internal reference types (classes)
    if (left.isInternalReference) {
      if (!right.isInternalReference) return null;
      // Prefer contextual type if meaningful
      if (contextualType != Type.void && left.isAssignableTo(contextualType) && right.isAssignableTo(contextualType)) {
        return contextualType;
      }
      let leftClass = left.getClass();
      let rightClass = right.getClass();
      if (leftClass && rightClass) {
        let lubClass = Class.leastUpperBound(leftClass, rightClass);
        if (lubClass) {
          let ret = left.is(TypeFlags.Nullable) || right.is(TypeFlags.Nullable) ? lubClass.type.asNullable() : lubClass.type;
          return ret;
        }
      }
    } else if (right.isInternalReference) {
      return null;
    }
    // TODO: External reference types (needs nullability)
    // Otherwise do a trivial check
    if (right.isAssignableTo(left, signednessIsRelevant)) return left;
    else if (left.isAssignableTo(right, signednessIsRelevant)) return right;
    return null;
  }

  /** Converts this type's kind to a string. */
  kindToString(): string {
    switch (this.kind) {
      case TypeKind.Bool: return CommonNames.bool;
      case TypeKind.I8: return CommonNames.i8;
      case TypeKind.I16: return CommonNames.i16;
      case TypeKind.I32: return CommonNames.i32;
      case TypeKind.I64: return CommonNames.i64;
      case TypeKind.Isize: return CommonNames.isize;
      case TypeKind.U8: return CommonNames.u8;
      case TypeKind.U16: return CommonNames.u16;
      case TypeKind.U32: return CommonNames.u32;
      case TypeKind.U64: return CommonNames.u64;
      case TypeKind.Usize: return CommonNames.usize;
      case TypeKind.F32: return CommonNames.f32;
      case TypeKind.F64: return CommonNames.f64;
      case TypeKind.V128: return CommonNames.v128;
      case TypeKind.Func: return CommonNames.ref_func;
      case TypeKind.Extern: return CommonNames.ref_extern;
      case TypeKind.Any: return CommonNames.ref_any;
      case TypeKind.Eq: return CommonNames.ref_eq;
      case TypeKind.Struct: return CommonNames.ref_struct;
      case TypeKind.Array: return CommonNames.ref_array;
      case TypeKind.I31: return CommonNames.ref_i31;
      case TypeKind.String: return CommonNames.ref_string;
      case TypeKind.StringviewWTF8: return CommonNames.ref_stringview_wtf8;
      case TypeKind.StringviewWTF16: return CommonNames.ref_stringview_wtf16;
      case TypeKind.StringviewIter: return CommonNames.ref_stringview_iter;
      case TypeKind.FixedArray: {
        // Spelled the way the source spells it, so a diagnostic that quotes the
        // type is readable back in — and, since Landing 5a.5, so that the two
        // storage forms cannot be confused in one: `[u32 * 4]` is inline
        // elements, `@unmanaged [u32 * 4]` is a pointer to them. Before the
        // split both printed `u32[4]`, which is how the prefix went unnoticed.
        let elementType = this.fixedElementType;
        let inner = "[" + (elementType ? elementType.toString() : "?")
          + " * " + this.fixedLength.toString() + "]";
        switch (this.fixedMemoryModel) {
          case MemoryModelCode.Unmanaged: return "@unmanaged " + inner;
          case MemoryModelCode.Managed: return "@managed " + inner;
          case MemoryModelCode.Inline: return "@inline " + inner;
          default: return inner;
        }
      }
      case TypeKind.UnmanagedArray: {
        // Spelled the way the source spells it, so a diagnostic that quotes the
        // type is readable back in: `[u32 *]`, not `u32*` or `UnmanagedArray`.
        let elementType = this.unmanagedElementType;
        return "[" + (elementType ? elementType.toString() : "?") + " *]";
      }
      case TypeKind.DynamicArray: {
        let elementType = this.dynamicArrayElementType;
        let model = this.dynamicMemoryModel == MemoryModelCode.Managed
          ? "@managed @dynamic "
          : "@unmanaged @dynamic ";
        return model + "[" + (elementType ? elementType.toString() : "?") + " * n]";
      }
      default: assert(false);
      case TypeKind.Void: return CommonNames.void_;
    }
  }

  /** Converts this type to a string. */
  toString(validWat: bool = false): string {
    const nullablePostfix = validWat ? "|null" : " | null";
    if (this.isReference) {
      let classReference = this.getClass();
      if (classReference) {
        return this.isNullableReference
          ? classReference.internalName + nullablePostfix
          : classReference.internalName;
      } else {
        let signatureReference = this.getSignature();
        if (signatureReference) {
          return this.isNullableReference
            ? `(${signatureReference.toString(validWat)})${nullablePostfix}`
            : signatureReference.toString(validWat);
        } else {
          return this.isNullableReference
            ? `${this.kindToString()}${nullablePostfix}`
            : this.kindToString();
        }
      }
    }
    if (this == Type.auto) {
      return "auto";
    }
    return this.kindToString();
  }

  // Binaryen specific

  /** Converts this type to its respective type reference. */
  toRef(): TypeRef {
    // **A wasm GC class is a reference type, not a pointer.** Under `--wasm-gc`,
    // a user-declared class that the slice covers is a `(ref null $C)` — a
    // Binaryen GC struct type from the type builder — instead of the `i32`
    // pointer every class is today. The check sits before the switch because a
    // class's `kind` is `Usize` ("also the base of class types"), so the Usize
    // arm would otherwise answer `I32` first.
    //
    // Scoped deliberately: `isGcClass` excludes `~lib/` (the standard library
    // keeps the pointer ABI until the migration reaches it) and excludes
    // anything with a real base class (flat classes only in this slice).
    // **`StaticArray<T>` is a wasm GC array.** Before the class arm because it is
    // a class reference, and per instantiation: `StaticArray<i32>` is an array
    // while `StaticArray<String>` keeps the pointer ABI. The build is delegated to
    // `ensureType` — the array type needs the module that owns the builder cache,
    // and `module.ts` imports this file.
    // **`String` is an `(array (mut u16))`** — the same type `StaticArray<u16>`
    // gets, because a `String` is a bare block with no fields of its own.
    if (gcStringOf(this)) return ensureType(this);

    if (gcArrayElementOf(this) != null) return ensureType(this);

    // **A function value is a reference to its `Function<T>` struct.** A signature type's
    // `kind` is `usizeType.kind`, so without this arm `toRef()` answers `I32` for it and
    // every site that moves a function value — a field's setter signature, a
    // `struct.new` operand, a local — disagrees with the field it is stored in.
    if (this.signatureReference != null && gcFunctionValueUsable(this)) return ensureType(this);

    if (gcClassesEnabled && this.isInternalReference) {
      let cls = this.classReference;
      if (cls != null && isGcClass(cls)) {
        // **One struct type per class, whatever `Type` object asks.** The type
        // builder's cache lives on the *canonical* class type (`cls.type`), and
        // `this` may be any of its variants — nullable, a fresh `asNullable()`,
        // a copy made by `getNullableType`. Asking with a variant would build a
        // second struct type with the same *name*, which prints identically and
        // fails validation as a parameter/local mismatch. So: always build from
        // the canonical type, then apply this variant's nullability.
        // **Always nullable**, whatever variant asked. A constructor's `this` is
        // null until it allocates and the constructor signature is built from
        // the class's own (non-nullable) type — so a non-null `(ref $C)` there
        // would make the very first `ref.is_null` a formality and the call site's
        // `ref.null` a type error. Non-nullability is a refinement a later slice
        // can add where it can be proven; inferring it here has to be right at
        // every site at once, and is not worth the risk for a slice.
        let built = ensureType(cls.type);
        return binaryen._BinaryenTypeFromHeapType(
          binaryen._BinaryenTypeGetHeapType(built),
          true
        );
      }
    }
    switch (this.kind) {
      case TypeKind.Bool:
      case TypeKind.I8:
      case TypeKind.I16:
      case TypeKind.I32:
      case TypeKind.U8:
      case TypeKind.U16:
      case TypeKind.U32: return TypeRef.I32;
      case TypeKind.Isize:
      case TypeKind.Usize:
      // A `[T *]` is an address, so it crosses the value stack at the pointer
      // width: `i32` on wasm32, `i64` on memory64. This is the case that retires
      // `TypeKind.FixedArray`'s `assert(false)` below for the new kind -- a
      // `[T *]` parameter, local, global and return each bind as one slot.
      case TypeKind.UnmanagedArray:
      // A dynamic array is also one address at the ABI: the pointer to the
      // header. The length travels in the buffer, not on the value stack.
      case TypeKind.DynamicArray: if (this.size != 64) return TypeRef.I32;
      case TypeKind.I64:
      case TypeKind.U64:  return TypeRef.I64;
      case TypeKind.F32:  return TypeRef.F32;
      case TypeKind.F64:  return TypeRef.F64;
      case TypeKind.V128: return TypeRef.V128;
      case TypeKind.Func: {
        return binaryen._BinaryenTypeFromHeapType(HeapTypeRef.Func, this.is(TypeFlags.Nullable));
      }
      case TypeKind.Extern: {
        return binaryen._BinaryenTypeFromHeapType(HeapTypeRef.Extern, this.is(TypeFlags.Nullable));
      }
      case TypeKind.Any: {
        return binaryen._BinaryenTypeFromHeapType(HeapTypeRef.Any, this.is(TypeFlags.Nullable));
      }
      case TypeKind.Eq: {
        return binaryen._BinaryenTypeFromHeapType(HeapTypeRef.Eq, this.is(TypeFlags.Nullable));
      }
      case TypeKind.Struct: {
        return binaryen._BinaryenTypeFromHeapType(HeapTypeRef.Struct, this.is(TypeFlags.Nullable));
      }
      case TypeKind.Array: {
        return binaryen._BinaryenTypeFromHeapType(HeapTypeRef.Array, this.is(TypeFlags.Nullable));
      }
      case TypeKind.I31: {
        return binaryen._BinaryenTypeFromHeapType(HeapTypeRef.I31, this.is(TypeFlags.Nullable));
      }
      case TypeKind.String: {
        return binaryen._BinaryenTypeFromHeapType(HeapTypeRef.String, this.is(TypeFlags.Nullable));
      }
      case TypeKind.Void: return TypeRef.None;
      case TypeKind.FixedArray: {
        // Only the **view** and **heap** forms have a slot representation: both
        // are an address, so both cross the value stack as one `i32`.
        //
        // The **value** form deliberately asserts. It is inline bytes with no
        // address, and there is no slot that can carry N x sizeof(T) bytes
        // until Landing 5b gives it inline storage (a stack slot, copy at the
        // ABI, sret for a return). The assert is defensive rather than a
        // placeholder: it means a path that reaches here with a value form is a
        // bug, not an unimplemented feature — Landing 5a had this
        // arm answering `I32` for every form, which is how
        // `changetype<[T * N]>(p)` came to compile and make a value-typed thing
        // carry an address.
        //
        // **No accepted position reaches it.** Every storage position that would
        // need a slot is refused before this call (`Compiler#checkFixedArrayStorage
        // Position`: a global, a parameter, a return, a local, a nested element
        // of one); a *field* or an *element* compiles to its address instead
        // (`Compiler#compilePropertyAccess`, `#compileFixedArrayElementAccess`),
        // and a value-form local is SROA'd into one WASM local per leaf. What is
        // left is the invariant: the compiler must not *accept* a type that has
        // nowhere to live.
        //
        // A fixed array's `size` cannot answer the pointer width here the way
        // `UnmanagedArray`'s does: for the value form `size` is the extent,
        // because that is what `sizeof` asks it for. So the view slot is `i32`
        // unconditionally, and a memory64 build would have to consult the
        // configured pointer width as the `UnmanagedArray` arm does. Deferred
        // with the rest of wasm64.
        if (this.fixedMemoryModel == MemoryModelCode.Unmanaged ||
            this.fixedMemoryModel == MemoryModelCode.Managed) {
          return TypeRef.I32;
        }
        assert(false);
        return TypeRef.I32;
      }
    }
    // TODO: not used yet
    assert(false);
    return ensureType(this);
  }

  // Types

  /** An 8-bit signed integer. */
  static readonly i8: Type  = new Type(TypeKind.I8,
    TypeFlags.Signed   |
    TypeFlags.Short    |
    TypeFlags.Integer  |
    TypeFlags.Value,   8
  );

  /** A 16-bit signed integer. */
  static readonly i16: Type = new Type(TypeKind.I16,
    TypeFlags.Signed   |
    TypeFlags.Short    |
    TypeFlags.Integer  |
    TypeFlags.Value,  16
  );

  /** A 32-bit signed integer. */
  static readonly i32: Type = new Type(TypeKind.I32,
    TypeFlags.Signed   |
    TypeFlags.Integer  |
    TypeFlags.Value,  32
  );

  /** A 64-bit signed integer. */
  static readonly i64: Type = new Type(TypeKind.I64,
    TypeFlags.Signed   |
    TypeFlags.Long     |
    TypeFlags.Integer  |
    TypeFlags.Value,  64
  );

  /** A 32-bit signed size. WASM32 only. */
  static readonly isize32: Type = new Type(TypeKind.Isize,
    TypeFlags.Signed   |
    TypeFlags.Integer  |
    TypeFlags.Varying  |
    TypeFlags.Value,  32
  );

  /** A 64-bit signed size. WASM64 only. */
  static readonly isize64: Type = new Type(TypeKind.Isize,
    TypeFlags.Signed   |
    TypeFlags.Long     |
    TypeFlags.Integer  |
    TypeFlags.Varying  |
    TypeFlags.Value,  64
  );

  /** An 8-bit unsigned integer. */
  static readonly u8: Type = new Type(TypeKind.U8,
    TypeFlags.Unsigned |
    TypeFlags.Short    |
    TypeFlags.Integer  |
    TypeFlags.Value,   8
  );

  /** A 16-bit unsigned integer. */
  static readonly u16: Type = new Type(TypeKind.U16,
    TypeFlags.Unsigned |
    TypeFlags.Short    |
    TypeFlags.Integer  |
    TypeFlags.Value,  16
  );

  /** A 32-bit unsigned integer. */
  static readonly u32: Type = new Type(TypeKind.U32,
    TypeFlags.Unsigned |
    TypeFlags.Integer  |
    TypeFlags.Value,  32
  );

  /** A 64-bit unsigned integer. */
  static readonly u64: Type = new Type(TypeKind.U64,
    TypeFlags.Unsigned |
    TypeFlags.Long     |
    TypeFlags.Integer  |
    TypeFlags.Value,  64
  );

  /** A 32-bit unsigned size. WASM32 only. */
  static readonly usize32: Type = new Type(TypeKind.Usize,
    TypeFlags.Unsigned |
    TypeFlags.Integer  |
    TypeFlags.Varying  |
    TypeFlags.Value,  32
  );

  /** A 64-bit unsigned size. WASM64 only. */
  static readonly usize64: Type = new Type(TypeKind.Usize,
    TypeFlags.Unsigned |
    TypeFlags.Long     |
    TypeFlags.Integer  |
    TypeFlags.Varying  |
    TypeFlags.Value,  64
  );

  /** A 1-bit unsigned integer. */
  static readonly bool: Type = new Type(TypeKind.Bool,
    TypeFlags.Unsigned |
    TypeFlags.Short    |
    TypeFlags.Integer  |
    TypeFlags.Value,   1
  );

  /** A 32-bit float. */
  static readonly f32: Type = new Type(TypeKind.F32,
    TypeFlags.Signed   |
    TypeFlags.Float    |
    TypeFlags.Value,  32
  );

  /** A 64-bit float. */
  /** Interned fixed-array types, keyed by model, element type and length. */
  private static _fixedArrays: Map<string, Type> | null = null;

  /**
   * Gets the {@link TypeKind.FixedArray} of `elementType` repeated `length`
   * times, in the storage named by `memoryModel`.
   *
   * Interned: the same `(model, element, length)` always yields the same `Type`,
   * so `offsetof`, `alignof`, `sizeof` and field lookup can compare by identity
   * the way they do for every other type.
   *
   * **The model is part of the identity**, and that is the point of Landing
   * 5a.5. Before it, this function had one axis (element, length) and the memory
   * model was dropped, so `[u32 * 4]` and `@unmanaged [u32 * 4]` were the same
   * Type object — measured: both compiled, both `sizeof` 16, and all four
   * spellings (`[T * N]`, `@unmanaged [T * N]`, `@managed [T * N]`,
   * `@inline [T * N]`) emitted byte-identical code. A prefix that changes
   * nothing is worse than one that is refused, because it reads as if it means
   * something.
   *
   * The two honourable forms differ in both size and alignment:
   *
   *   value  (`Any` / `Inline`) — inline elements: `elementSize * length` bytes,
   *                               aligned as the element is
   *   view   (`Unmanaged`)      — one address: `pointerSize` bits, aligned as a
   *                               pointer is
   *   heap   (`Managed`)        — one GC reference, same shape as the view; the
   *                               form itself is refused until Landing 5c, but
   *                               the Type can be built so that `sizeof` answers
   *                               the truth before the refusal fires
   *
   * `pointerSize` is in **bits**, matching `Type.size`.
   */
  static fixedArray(
    elementType: Type,
    length: i32,
    memoryModel: MemoryModelCode,
    pointerSize: i32
  ): Type {
    let isValueForm = memoryModel == MemoryModelCode.None ||
      memoryModel == MemoryModelCode.Inline;
    let key = (isValueForm ? "-" : memoryModel == MemoryModelCode.Managed ? "m" : "u")
      + elementType.toString() + "[" + length.toString() + "]";
    let cache = Type._fixedArrays;
    if (!cache) {
      let fresh = new Map<string, Type>();
      Type._fixedArrays = fresh;
      cache = fresh;
    }
    let cached = getMapEntry(cache, key);
    // Validated by element identity as well: the map outlives a `Program`, so a
    // second compile in one process must not be handed the first one's element
    // `Class`.
    if (cached && cached.fixedElementType == elementType) return cached;
    let arrayType = new Type(
      TypeKind.FixedArray,
      TypeFlags.None,
      isValueForm
        // The element's **extent**, not `byteSize`: those differ for a record,
        // where `byteSize` is the 4-byte reference. Landing 1 wrote `byteSize`
        // here, which was unobservable while record elements were refused
        // outright and wrong the moment they became reachable.
        ? elementType.inlineExtentBytes * length << 3 // bytes -> bits
        : pointerSize
    );
    arrayType.fixedElementType = elementType;
    arrayType.fixedLength = length;
    arrayType.fixedMemoryModel = memoryModel;
    arrayType.fixedAlignLog2 = isValueForm
      // Aligned as its element is — for a record, the strongest of its fields'.
      ? elementType.inlineAlignLog2
      : 31 - clz<i32>(pointerSize >>> 3);
    cache.set(key, arrayType);
    return arrayType;
  }

  /** Gets the element type of a {@link TypeKind.FixedArray}. */
  get fixedArrayElementType(): Type {
    return assert(this.fixedElementType);
  }

  /** Interned unmanaged-array types, keyed by element type and pointer width. */
  private static _unmanagedArrays: Map<string, Type> | null = null;

  /**
   * Gets the {@link TypeKind.UnmanagedArray} of `elementType`: a pointer to a run
   * of `elementType`, with no length.
   *
   * `pointerSize` is `options.usizeType.size` -- 32 or 64 bits. It is a
   * parameter rather than a constant because a `Type` carries its own size, and
   * `size` here must be the **pointer's**, not the element's: there is no extent
   * to measure. It is part of the cache key for the same reason -- `equals`
   * compares element types only, so two types differing solely in pointer width
   * must not be the same object.
   *
   * Unlike {@link Type.fixedArray} this consults nothing about the element but
   * its identity: the count is unknown, which is the entire point of the kind.
   *
   * The cache is validated by **identity** of the element, not just by the key.
   * This is what keeps interning a per-program property rather than a
   * per-process one: the map is a static that outlives a `Program`, so a second
   * `asc.main` in the same process (which is exactly what the compiler test
   * harness does -- debug then release) would otherwise be handed the first
   * program's `Type`, whose `unmanagedElementType` carries the first program's
   * `Class`. A property read through that class then emitted a call to a getter
   * the new module never compiled, and the module failed to validate:
   * `wasm-validator error ... call target must exist`.
   *
   * So a cached entry is returned only when its element is the *same object* the
   * current program just resolved. Within one program that is always true --
   * `resolveType` interns a record's `Type` -- so interning still holds there.
   */
  static unmanagedArray(elementType: Type, pointerSize: i32): Type {
    let key = elementType.toString() + "*" + pointerSize.toString();
    let cache = Type._unmanagedArrays;
    if (!cache) {
      let fresh = new Map<string, Type>();
      Type._unmanagedArrays = fresh;
      cache = fresh;
    }
    let cached = getMapEntry(cache, key);
    if (cached && cached.unmanagedElementType == elementType) return cached;
    let arrayType = new Type(
      TypeKind.UnmanagedArray,
      TypeFlags.None,
      pointerSize
    );
    arrayType.unmanagedElementType = elementType;
    cache.set(key, arrayType);
    return arrayType;
  }

  /** Gets the element type of a {@link TypeKind.UnmanagedArray}. */
  get unmanagedArrayElementType(): Type {
    return assert(this.unmanagedElementType);
  }

  /** Interned dynamic-array types, keyed by model, element and pointer width. */
  private static _dynamicArrays: Map<string, Type> | null = null;

  /**
   * Gets the {@link TypeKind.DynamicArray} of `elementType`.
   *
   * The key carries the **model** as well as the element, because `equals`
   * compares both: two models over one element are different types, and
   * interning them together would make them the same object.
   *
   * Like {@link Type.unmanagedArray} the entry is validated by element identity
   * on the way out — the map outlives a `Program`, so a second compile in one
   * process must not be handed the first one's element `Class`.
   */
  static dynamicArray(
    elementType: Type,
    memoryModel: MemoryModelCode,
    pointerSize: i32
  ): Type {
    let key = (memoryModel == MemoryModelCode.Managed ? "m" : "u")
      + elementType.toString() + "*d" + pointerSize.toString();
    let cache = Type._dynamicArrays;
    if (!cache) {
      let fresh = new Map<string, Type>();
      Type._dynamicArrays = fresh;
      cache = fresh;
    }
    let cached = getMapEntry(cache, key);
    if (cached && cached.dynamicArrayElementType == elementType) return cached;
    let arrayType = new Type(
      TypeKind.DynamicArray,
      TypeFlags.None,
      pointerSize
    );
    arrayType.dynamicArrayElementType = elementType;
    arrayType.dynamicMemoryModel = memoryModel;
    cache.set(key, arrayType);
    return arrayType;
  }

  /** Gets the element type of a {@link TypeKind.DynamicArray}. */
  get dynamicElementType(): Type {
    return assert(this.dynamicArrayElementType);
  }

  static readonly f64: Type = new Type(TypeKind.F64,
    TypeFlags.Signed   |
    TypeFlags.Long     |
    TypeFlags.Float    |
    TypeFlags.Value,  64
  );

  /** A 128-bit vector. */
  static readonly v128: Type = new Type(TypeKind.V128,
    TypeFlags.Vector   |
    TypeFlags.Value, 128
  );

  /** Non-nullable function reference (`ref func`). */
  static readonly func: Type = new Type(TypeKind.Func,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** Non-nullable external reference (`ref extern`). */
  static readonly extern: Type = new Type(TypeKind.Extern,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** Non-nullable any reference (`ref any`). */
  static readonly any: Type = new Type(TypeKind.Any,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** Non-nullable equatable reference (`ref eq`). */
  static readonly eq: Type = new Type(TypeKind.Eq,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** Non-nullable struct reference (`ref struct`). */
  static readonly struct: Type = new Type(TypeKind.Struct,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** Non-nullable array reference (`ref array`). */
  static readonly array: Type = new Type(TypeKind.Array,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** Non-nullable 31-bit integer reference (`ref i31`). */
  static readonly i31: Type = new Type(TypeKind.I31,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** Non-nullable string reference (`ref string`). */
  static readonly string: Type = new Type(TypeKind.String,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** Non-nullable WTF8 string view reference (`ref stringview_wtf8`). */
  static readonly stringview_wtf8: Type = new Type(TypeKind.StringviewWTF8,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** Non-nullable WTF16 string view reference (`ref stringview_wtf16`). */
  static readonly stringview_wtf16: Type = new Type(TypeKind.StringviewWTF16,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** Non-nullable string iterator reference (`ref stringview_iter`). */
  static readonly stringview_iter: Type = new Type(TypeKind.StringviewIter,
    TypeFlags.External   |
    TypeFlags.Reference, 0
  );

  /** No return type. */
  static readonly void: Type = new Type(TypeKind.Void, TypeFlags.None, 0);

  /** Alias of i32 indicating type inference of locals and globals with just an initializer. */
  static readonly auto: Type = new Type(Type.i32.kind, Type.i32.flags, Type.i32.size);
}

/** Converts an array of types to an array of type references. */
export function typesToRefs(types: Type[]): TypeRef[] {
  let numTypes = types.length;
  let ret = new Array<TypeRef>(numTypes);
  for (let i = 0; i < numTypes; ++i) {
    unchecked(ret[i] = types[i].toRef());
  }
  return ret;
}

/** Converts an array of types to its combined string representation. */
export function typesToString(types: Type[]): string {
  let numTypes = types.length;
  if (!numTypes) return "";
  let sb = new Array<string>(numTypes);
  for (let i = 0; i < numTypes; ++i) {
    unchecked(sb[i] = types[i].toString(true));
  }
  return sb.join(",");
}

/**
 * The numeric codes carried by {@link Signature.memoryModels}, one per source
 * parameter.
 *
 * Mirrored from `MemoryModel` (`ast.ts`) because `types.ts` is imported by
 * `ast.ts` and therefore cannot import it back. The values must stay in step; a
 * mismatch is caught by `Signature.create`'s key-vs-`equals` assertion the first
 * time two signatures with different models are built.
 */
export const enum MemoryModelCode {
  /** No model named at the use: the declaration's own applies. */
  None = 0,
  /** `@inline`: a value, copied in and out. */
  Inline = 1,
  /** `@managed`: a GC-owned record reference. */
  Managed = 2,
  /** `@unmanaged`: a plain record pointer. */
  Unmanaged = 3
}

/** One character per entry, for the memoization key: `-`, `i`, `m`, `u`.
 *  Returns the empty string when no parameter named a model, so a program that
 *  uses no overrides produces exactly the key it produced before this existed. */
function memoryModelsToKeySegment(memoryModels: i32[] | null): string {
  if (memoryModels == null) return "";
  let length = memoryModels.length;
  if (!length) return "";
  let chars = new Array<string>(length);
  for (let i = 0; i < length; ++i) {
    let code = unchecked(memoryModels[i]);
    unchecked(chars[i] =
      code == MemoryModelCode.Inline ? "i" :
      code == MemoryModelCode.Managed ? "m" :
      code == MemoryModelCode.Unmanaged ? "u" : "-"
    );
  }
  return "!mm:" + chars.join("") + ":";
}

/** Represents a fully resolved function signature. */
export class Signature {
  /** Construct a new signature. */
  public static create(
    /** The program that created this signature. */
    program: Program,
    /** Parameter types, if any, excluding `this`. */
    parameterTypes: Type[] = [],
    /** Return type. */
    returnType: Type = Type.void,
    /** This type, if an instance signature. */
    thisType: Type | null = null,
    /** Number of required parameters excluding `this`. Other parameters are considered optional. */
    requiredParameters: i32 = parameterTypes ? parameterTypes.length : 0,
    /** Whether the last parameter is a rest parameter. */
    hasRest: bool = false,
    /** Whether this signature must never use a hidden sret destination
     *  parameter even if its return type is an `@inline struct`. Constructors
     *  are the only such signature: they return the allocated `this` pointer,
     *  not a value. Part of the memoization key, because a method with the same
     *  parameter and return types must still get the hidden parameter. */
    sretDisabled: bool = false,
    /** Whether an `@inline struct` parameter crosses a host boundary and must
     *  be passed as the **address** of a caller-materialised temp rather than
     *  as one WASM operand per field. Set for an `@external` declaration with
     *  such a parameter. Part of the memoization key, because the same source
     *  signature also exists as an ordinary guest function, whose parameters
     *  really are per-field. */
    externalBoundary: bool = false,
    /** Whether an `@inline struct` parameter of an **export** crosses as a
     *  byval pointer the *host* provides: one `i32`, with the callee's prologue
     *  copying its fields into the SROA locals. The mirror of
     *  `externalBoundary`, which is the same shape with the guest on the other
     *  side of the call. Part of the memoization key for the same reason. */
    exportByValParams: bool = false,
    /** The memory model each **use** of a parameter named, one entry per source
     *  parameter, or `null` when no parameter named one.
     *
     *  Part of the memoization key, because two declarations with the same
     *  parameter types can cross a boundary differently: `f(v: @inline U)` is a
     *  byval copy and `g(v: @unmanaged U)` is a borrowed pointer, and both have
     *  parameter type `U`. A signature-level boolean cannot separate them
     *  (`f(a: @inline U, b: @unmanaged U)` and its mirror agree on "some
     *  parameter is inline"), so the key carries the per-parameter answer.
     *
     *  `null` — not an all-zero array — for the ordinary case, so a program that
     *  names no model allocates nothing and every key is byte-identical to the
     *  one it had before this field existed. Values are the numeric codes of
     *  `MemoryModel` (`ast.ts`), mirrored in the `MEMORY_MODEL_*` constants
     *  below because `types.ts` is imported by `ast.ts` and cannot import it
     *  back. */
    memoryModels: i32[] | null = null
  ): Signature {
    // get the usize type, and the type of the signature
    let usizeType = program.options.usizeType;
    let type = new Type(
      usizeType.kind,
      usizeType.flags & ~TypeFlags.Value | TypeFlags.Reference,
      usizeType.size
    );

    // calculate the properties
    let signatureTypes = program.uniqueSignatures;
    let nextId = program.nextSignatureId;
    
    // construct the signature and calculate it's unique key
    let signature = new Signature(program, parameterTypes, returnType, thisType, requiredParameters, hasRest, sretDisabled, externalBoundary, exportByValParams, memoryModels, nextId, type);
    // Constructors and ordinary functions can share parameter and return types
    // but not the hidden destination parameter, and an `@external` declaration
    // can share them with a guest function but not the pointer shape, so both
    // flags are part of the key.
    let uniqueKey = (sretDisabled ? "!sret-disabled:" : "")
      + (externalBoundary ? "!external-boundary:" : "")
      + (exportByValParams ? "!export-byval:" : "")
      + memoryModelsToKeySegment(memoryModels)
      + signature.toString();

    // check if it exists, and return it
    if (signatureTypes.has(uniqueKey)) {
      let existing = assert(signatureTypes.get(uniqueKey));
      assert(signature.equals(existing));
      return existing;
    }

    // otherwise increment the program's signature id, set the signature reference of the type, and memoize the signature
    program.nextSignatureId = nextId + 1;
    type.signatureReference = signature;
    signatureTypes.set(uniqueKey, signature);
    return signature;
  }

  /** Constructs a new signature. */
  private constructor(
    /** The program that created this signature. */
    public readonly program: Program,
    /** Parameter types, if any, excluding `this`. */
    public readonly parameterTypes: Type[],
    /** Return type. */
    public readonly returnType: Type,
    /** This type, if an instance signature. */
    public readonly thisType: Type | null,
    /** Number of required parameters excluding `this`. Other parameters are considered optional. */
    public readonly requiredParameters: i32,
    /** Whether the last parameter is a rest parameter. */
    public readonly hasRest: bool,
    /** Whether a hidden sret destination parameter is forbidden (constructors). */
    public readonly sretDisabled: bool,
    /** Whether an `@inline struct` parameter crosses a host boundary as a
     *  pointer to a caller-materialised temp. */
    public readonly externalBoundary: bool,
    /** Whether an `@inline struct` parameter of an export crosses as a byval
     *  pointer the host provides. */
    public readonly exportByValParams: bool,
    /** The memory model each use of a parameter named, one entry per source
     *  parameter, or `null` when no parameter named one. See
     *  {@link MemoryModelCode}. */
    public readonly memoryModels: i32[] | null,
    /** Unique id representing this signature. */
    public readonly id: u32,
    /** Respective function type. */
    public readonly type: Type,
  ) {}

  /**
   * The model source parameter `sourceIndex` named at its use, or
   * {@link MemoryModelCode.None} when it named none (or when nothing named one
   * anywhere and the array is `null`).
   *
   * This is what the **use** asked for, not what the value is: the declaration's
   * own model is still on the `Type`
   * (`type.classReference.hasDecorator(...)`). The boundary emitters want both —
   * the override decides *how the parameter crosses*, the type decides what may
   * be done with it. Rooting deliberately reads only the second: the override
   * says how the parameter crosses, while the type says what may be done with
   * it.
   */
  memoryModelOf(sourceIndex: i32): i32 {
    let memoryModels = this.memoryModels;
    if (memoryModels == null) return MemoryModelCode.None;
    return unchecked(memoryModels[sourceIndex]);
  }

  /**
   * How many WASM parameters one source parameter occupies.
   *
   * One for every type except an `@inline struct`, which occupies **one per
   * field**: a value has no representation the WASM value stack can carry, so it
   * crosses a call as its fields.
   *
   * This and its siblings below are the **only** place a source parameter index
   * is translated into WASM parameter indices. A site that computes the range
   * itself is a bug waiting for the next contributor, who will not know the
   * identity broke — so every emitter calls these, and `grep wasmParam` finds
   * all of them.
   */
  static wasmParamCountOf(type: Type): i32 {
    // The value form spends one slot per element leaf. Checked before the
    // class-reference test below, which answers 1 for anything that is not an
    // `@inline struct` — including the view form, where 1 is the right answer.
    if (type.kind == TypeKind.FixedArray &&
        (type.fixedMemoryModel == MemoryModelCode.None ||
         type.fixedMemoryModel == MemoryModelCode.Inline)) {
      let count = Signature.leafCountOf(type);
      return count > 0 ? count : 1;
    }
    let classReference = type.classReference;
    if (
      classReference == null ||
      !classReference.hasDecorator(DecoratorFlags.InlineStruct)
    ) return 1;
    let count = Signature.leafCountOf(type);
    return count > 0 ? count : 1;
  }

  /**
   * Appends the **leaf** types of an `@inline struct`, in declaration order,
   * depth first.
   *
   * A leaf is a field that occupies one WASM local: a scalar or a reference. A
   * field whose type is itself an `@inline struct` is not a leaf — it is several
   * locals behind a map — so the walk recurses into it. This is the type-level
   * twin of the `fieldLocals` tree the compiler builds
   * (`Compiler#fillSroaFieldLocals`), and the two must agree in **order** as
   * well as count: the callee binds WASM parameter *k* to the *k*th leaf, and
   * the caller pushes operands in the same walk.
   */
  static leafTypesOf(type: Type, out: Type[]): void {
    // A value-form `[T * N]` is a value too — N elements, each contributing its
    // own leaves. Element-major, because that is the order the SROA locals are
    // created in (`fillSroaArrayLocals` keys them `"0"`, `"1"`, ...) and the
    // order a reader expects `arr[0].x` to sit at.
    //
    // The view form is deliberately **not** here: `@unmanaged [T * N]` is one
    // `i32` address, and `wasmParamCountOf` already answers 1 for it by falling
    // through the class-reference test.
    if (type.kind == TypeKind.FixedArray &&
        (type.fixedMemoryModel == MemoryModelCode.None ||
         type.fixedMemoryModel == MemoryModelCode.Inline)) {
      let elementType = assert(type.fixedElementType);
      // A **scalar** element is its own leaf. `leafTypesOf` pushes nothing for
      // a non-record — that is why `paramRefs` handles a scalar parameter with
      // `toRef()` rather than through this walk — so the recursion has to place
      // it, or an array of scalars would contribute zero leaves.
      let elementClass = elementType.classReference;
      let isRecordElement = elementClass != null &&
        (elementClass.hasDecorator(DecoratorFlags.Unmanaged) ||
         elementClass.hasDecorator(DecoratorFlags.ManagedStruct));
      for (let i = 0, n = type.fixedLength; i < n; ++i) {
        if (isRecordElement) Signature.leafTypesOf(elementType, out);
        else out.push(elementType);
      }
      return;
    }
    let classReference = type.classReference;
    if (classReference == null) return;
    let members = classReference.members;
    if (!members) return;
    for (let _values = Map_values(members), i = 0, k = _values.length; i < k; ++i) {
      let member = unchecked(_values[i]);
      // A resolved `Class`'s members are prototypes; the bound `Property` that
      // carries `isField` hangs off `prototype.instance`.
      if (member.kind != ElementKind.PropertyPrototype) continue;
      let property = (<PropertyPrototype>member).instance;
      if (property == null || !property.isField) continue;
      let fieldType = property.type;
      if (Signature.isInlineStructRef(fieldType)) {
        Signature.leafTypesOf(fieldType, out);
      } else if (
        fieldType.kind == TypeKind.FixedArray &&
        (fieldType.fixedMemoryModel == MemoryModelCode.None ||
         fieldType.fixedMemoryModel == MemoryModelCode.Inline)
      ) {
        // A value-form `[T * N]` field is N element leaves, the same order
        // `fillSroaFieldLocals` creates them in. Without this arm the field
        // would contribute one "leaf" of array type — a type with no WASM
        // representation — and the call's arity would disagree with its body.
        let elementType = assert(fieldType.fixedElementType);
        let elementClass = elementType.classReference;
        let isRecordElement = elementClass != null &&
          (elementClass.hasDecorator(DecoratorFlags.Unmanaged) ||
           elementClass.hasDecorator(DecoratorFlags.ManagedStruct));
        for (let j = 0, n = fieldType.fixedLength; j < n; ++j) {
          if (isRecordElement) Signature.leafTypesOf(elementType, out);
          else out.push(elementType);
        }
      } else {
        out.push(fieldType);
      }
    }
  }

  /** The number of leaf locals an `@inline struct` occupies. */
  static leafCountOf(type: Type): i32 {
    let out = new Array<Type>();
    Signature.leafTypesOf(type, out);
    return out.length;
  }

  /**
   * How many WASM operands **this signature** spends on source parameter
   * `sourceIndex`.
   *
   * Usually the static `wasmParamCountOf` answer. The exception is a
   * host-boundary signature (`externalBoundary`, an `@external` declaration):
   * there an `@inline struct` crosses as the address of a caller-materialised
   * temp, so it spends **one** `i32` operand instead of one per field.
   *
   * This is the only place that difference exists. Every emitter that walks a
   * parameter list — `paramRefs`, `wasmParamCount`, `wasmParamStartOf`,
   * `sourceIndexOf`, and the call site's operand count — asks this method, so a
   * boundary signature and a guest signature cannot disagree about the arity of
   * the same source parameter.
   */
  wasmParamSlotCountOf(sourceIndex: i32): i32 {
    if (this.isViewParam(sourceIndex)) return 1;
    if (this.isByValPointerParam(sourceIndex)) return 1;
    return Signature.wasmParamCountOf(unchecked(this.parameterTypes[sourceIndex]));
  }

  /**
   * Whether source parameter `sourceIndex` is a **view**: `@unmanaged` at the
   * declaration over a type that is an `@inline struct`.
   *
   * The type still says *value* — every use of `MyStruct` shares one `Type`, and
   * that is what makes a member lookup work on the parameter — while the model
   * says this use is an address. One `i32` slot, no field locals, a load at the
   * field's offset: the same crossing an `@unmanaged struct` parameter already
   * takes, with the model recorded at the declaration instead of on a pointer
   * type.
   */
  isViewParam(sourceIndex: i32): bool {
    return this.memoryModelOf(sourceIndex) == MemoryModelCode.Unmanaged &&
      Signature.isInlineStructRef(unchecked(this.parameterTypes[sourceIndex]));
  }

  /**
   * Whether source parameter `sourceIndex` **crosses by value** — one `i32`
   * address instead of one WASM operand per field.
   *
   * Two ways to earn it, and they are deliberately one predicate so no emitter
   * can honour one and miss the other:
   *
   * - **The declaration is an `@inline struct`.** The value has no pointer
   *   representation of its own, so a boundary must send an address.
   * - **The use names `@inline` over a pointer declaration.** The record has an
   *   address, and the override asks for a copy of what is there — the same
   *   copy, read from memory instead of from SROA locals.
   *
   * The reverse is partly a thing now. `@unmanaged` over an `@inline`
   * declaration is legal where the use supplies an address — a parameter (a
   * view parameter, `isViewParam`) or `changetype`'s type argument — and a view
   * parameter crosses as a pointer, so it is asked before this predicate. Every
   * other cell still refuses (`TS6395`), and `@managed` over `@inline` refuses
   * at every position: a value has no GC header and no address to lend.
   */
  crossesByValueParam(sourceIndex: i32): bool {
    // A view crosses as a pointer, so there is no value to copy in and no temp
    // to materialise. Asked before the type, which still says `@inline struct`.
    if (this.isViewParam(sourceIndex)) return false;
    if (Signature.isInlineStructRef(unchecked(this.parameterTypes[sourceIndex]))) return true;
    return this.memoryModelOf(sourceIndex) == MemoryModelCode.Inline;
  }

  /**
   * Whether source parameter `sourceIndex` crosses a **host boundary** as a
   * single `i32` address instead of one WASM operand per field.
   *
   * Both halves matter: the signature must be a host-boundary signature, and the
   * parameter must cross by value (every other type already spends one operand).
   */
  isExternalPointerParam(sourceIndex: i32): bool {
    if (!this.externalBoundary) return false;
    return this.crossesByValueParam(sourceIndex);
  }

  /** Whether source parameter `sourceIndex` of an **export** crosses as a byval
   *  pointer: the host materialises the value and passes its address, and the
   *  callee copies the fields in at entry. */
  isExportByValParam(sourceIndex: i32): bool {
    if (!this.exportByValParams) return false;
    return this.crossesByValueParam(sourceIndex);
  }

  /** Whether this signature spends **one `i32` address** on a value-type
   *  parameter rather than one operand per field — true for either boundary. */
  isByValPointerParam(sourceIndex: i32): bool {
    return this.isExternalPointerParam(sourceIndex) || this.isExportByValParam(sourceIndex);
  }

  /** Whether *any* parameter of this signature is a byval pointer, i.e. whether
   *  a call to it has to materialise argument temps. */
  get byValPointerParams(): bool {
    return this.externalBoundary || this.exportByValParams;
  }

  /** Whether `type` is an `@inline struct`. */
  static isInlineStructRef(type: Type): bool {
    let classReference = type.classReference;
    return classReference != null &&
      classReference.hasDecorator(DecoratorFlags.InlineStruct);
  }

  /**
   * How many **WASM slots** an `@inline struct` spends — its leaf count.
   *
   * Leaf count, not direct-field count: a nested inline field is several locals,
   * so `Outer1 { a: u32; inner: Inner{x,y} }` is 3, not 2. A record with no
   * members is 0.
   *
   * Callers that made sense of "direct fields" are listed in the Phase C audit
   * (`docs`); the one place that genuinely needs the direct count is layout, and
   * layout reads `members` itself rather than asking this.
   */
  static fieldCountOf(type: Type): i32 {
    if (type.classReference == null) return 0;
    return Signature.leafCountOf(type);
  }

  /**
   * Whether a call to this signature passes a hidden destination pointer.
   *
   * An `@inline struct` return is **memory-only**: the value has no WASM
   * representation, so the call has no result. The caller allocates a slot and
   * passes its address as the first WASM parameter (after `this`, if any); the
   * callee writes the value's fields there and returns nothing. Sret.
   *
   * Every emitter asks this method rather than inspecting `returnType` itself,
   * so "is there a hidden slot" and "how many WASM parameters are there" can
   * never disagree — the failure mode of that disagreement is a call whose
   * operands are shifted by one, which typechecks as an ordinary arity error
   * only when the shifted types happen to differ.
   */
  get hasHiddenDestParam(): bool {
    if (this.sretDisabled) return false;
    let classReference = this.returnType.classReference;
    return classReference != null && classReference.hasDecorator(DecoratorFlags.InlineStruct);
  }

  /** The WASM parameter index where source parameter `sourceIndex` starts,
   *  counting from 0 and **excluding** `this`. The hidden destination pointer,
   *  if any, occupies slot 0, so a source parameter's slot is its field sum
   *  plus one. */
  wasmParamStartOf(sourceIndex: i32): i32 {
    let parameterTypes = this.parameterTypes;
    let start = this.hasHiddenDestParam ? 1 : 0;
    for (let i = 0; i < sourceIndex && i < parameterTypes.length; ++i) {
      start += this.wasmParamSlotCountOf(i);
    }
    return start;
  }

  /** The total number of WASM parameters, **excluding** `this`, and
   *  **including** the hidden destination pointer if there is one. */
  wasmParamCount(): i32 {
    let parameterTypes = this.parameterTypes;
    let count = this.hasHiddenDestParam ? 1 : 0;
    for (let i = 0, k = parameterTypes.length; i < k; ++i) {
      count += this.wasmParamSlotCountOf(i);
    }
    return count;
  }

  /**
   * The inverse: which source parameter owns WASM parameter `wasmIndex`
   * (excluding `this`).
   *
   * **`-1` has two meanings**, and both are in use:
   *
   * - **The hidden destination slot.** Position 0 when `hasHiddenDestParam`:
   *   there is no source parameter behind it, so there is no name to report.
   * - **Past the end.** `wasmIndex >= wasmParamCount()`. A consumer that walks
   *   a source parameter list should check `wasmParamCount()` *before* calling
   *   this, which makes a `-1` unambiguous: only the hidden slot can produce
   *   it. A consumer that does not check cannot tell the two apart, and the
   *   difference matters — the hidden slot has an operand,
   *   `operands[operandIndex]`, while a past-the-end index has none.
   */
  sourceIndexOf(wasmIndex: i32): i32 {
    let parameterTypes = this.parameterTypes;
    let start = this.hasHiddenDestParam ? 1 : 0;
    if (wasmIndex < start) return -1;
    for (let i = 0, k = parameterTypes.length; i < k; ++i) {
      let count = this.wasmParamSlotCountOf(i);
      if (wasmIndex < start + count) return i;
      start += count;
    }
    return -1;
  }

  get paramRefs(): TypeRef {
    let thisType = this.thisType;
    let parameterTypes = this.parameterTypes;
    let numParameterTypes = parameterTypes.length;
    let hasHiddenDest = this.hasHiddenDestParam;
    if (!numParameterTypes && !hasHiddenDest) {
      return thisType ? thisType.toRef() : TypeRef.None;
    }
    // The flattened WASM arity: `this` (if any), the hidden destination
    // pointer (if any), then every parameter's fields.
    let wasmCount = this.wasmParamCount();
    let typeRefs = new Array<TypeRef>(thisType ? 1 + wasmCount : wasmCount);
    let at = 0;
    if (thisType) unchecked(typeRefs[at++] = thisType.toRef());
    if (hasHiddenDest) unchecked(typeRefs[at++] = TypeRef.I32);
    for (let i = 0; i < numParameterTypes; ++i) {
      let parameterType = unchecked(parameterTypes[i]);
      if (this.isViewParam(i)) {
        // One plain pointer, the same slot an `@unmanaged` parameter crosses in.
        unchecked(typeRefs[at++] = TypeRef.I32);
      } else if (this.isByValPointerParam(i)) {
        // A host boundary: the caller materialises the value and passes its
        // address. Not `toRef()` — an `@inline struct`'s ref is a GC heap type
        // (`ensureType`), a different ABI that would need the GC feature. The
        // slot here is a plain pointer, exactly as `@unmanaged` and `@managed`
        // cross.
        unchecked(typeRefs[at++] = TypeRef.I32);
      } else if (Signature.isInlineStructRef(parameterType)) {
        // An unpacked value: one ref per field, in declaration order — the
        // order `compileSroaLocal` lays the locals out in, so the callee's
        // local index i+k matches the caller's argument i+k.
        //
        // **Keyed on the type, not on the count.** A one-field record spends
        // exactly one WASM slot, so a `count == 1` test was true for it too;
        // taking that branch gave the parameter `toRef()` (a GC heap type) and
        // the callee a plain local instead of an SROA field, which made every
        // one-field value-type parameter unusable.
        // One ref per **leaf**, in declaration order depth first — the same walk
        // `leafTypesOf` does and the binder indexes into. A nested inline field
        // contributes its leaves' refs, not one ref for itself: it has no value
        // representation the WASM stack could carry.
        let leafTypes = new Array<Type>();
        Signature.leafTypesOf(parameterType, leafTypes);
        for (let j = 0, n = leafTypes.length; j < n; ++j) {
          unchecked(typeRefs[at++] = unchecked(leafTypes[j]).toRef());
        }
      } else if (parameterType.kind == TypeKind.FixedArray &&
                 (parameterType.fixedMemoryModel == MemoryModelCode.None ||
                  parameterType.fixedMemoryModel == MemoryModelCode.Inline)) {
        // A value-form `[T * N]`: one ref per element leaf, element-major. The
        // array has no address to pass, so the leaves *are* the argument —
        // which is also what makes the call copy rather than alias.
        let leafTypes = new Array<Type>();
        Signature.leafTypesOf(parameterType, leafTypes);
        for (let j = 0, n = leafTypes.length; j < n; ++j) {
          unchecked(typeRefs[at++] = unchecked(leafTypes[j]).toRef());
        }
      } else {
        // Scalar or reference: one ref, exactly as before.
        unchecked(typeRefs[at++] = parameterType.toRef());
      }
    }
    return createType(typeRefs);
  }

  /** The WASM result type. `None` for an `@inline struct` return: the value is
   *  written to the caller's slot, so nothing flows back through the value
   *  stack. */
  get resultRefs(): TypeRef {
    if (this.hasHiddenDestParam) return TypeRef.None;
    let returnType = this.returnType;
    // A value-form `[T * N]` return crosses as **multivalue**: one result per
    // element leaf, element-major. A value has no address, so there is no
    // destination sret could write to — and a tuple is not a `Type`, which is
    // why the caller needs `Local#typeRefOverride` to hold one.
    //
    // The implementation is `createType`, which builds a tuple for more than one
    // ref (`module.ts`). `Signature#paramRefs` already relies on that path for
    // multi-value *parameters*; this is the result side of the same machinery.
    if (returnType.kind == TypeKind.FixedArray &&
        (returnType.fixedMemoryModel == MemoryModelCode.None ||
         returnType.fixedMemoryModel == MemoryModelCode.Inline)) {
      let leafTypes = new Array<Type>();
      Signature.leafTypesOf(returnType, leafTypes);
      let refs = new Array<TypeRef>(leafTypes.length);
      for (let i = 0, n = leafTypes.length; i < n; ++i) {
        unchecked(refs[i] = unchecked(leafTypes[i]).toRef());
      }
      return createType(refs);
    }
    return returnType.toRef();
  }

  /** Tests if this signature equals the specified. */
  equals(other: Signature): bool {

    // check `this` type
    let thisThisType = this.thisType;
    let otherThisType = other.thisType;
    if (thisThisType) {
      if (!otherThisType || !thisThisType.equals(otherThisType)) return false;
    } else if (otherThisType) {
      return false;
    }

    // check rest parameter
    if (this.hasRest != other.hasRest) return false;

    // constructors and ordinary functions never share a hidden dest slot
    if (this.sretDisabled != other.sretDisabled) return false;

    // a host-boundary signature never shares slots with a guest one, and the
    // export byval shape is a third arity for the same source parameters
    if (this.externalBoundary != other.externalBoundary) return false;
    if (this.exportByValParams != other.exportByValParams) return false;

    // The per-parameter models decide how each parameter crosses, so two
    // signatures with the same types can still differ here (`f(v: @inline U)`
    // copies, `g(v: @unmanaged U)` borrows). The key already separates them;
    // this is what `create`'s `assert(signature.equals(existing))` checks.
    let selfMemoryModels = this.memoryModels;
    let otherMemoryModels = other.memoryModels;
    if ((selfMemoryModels == null) != (otherMemoryModels == null)) return false;
    if (selfMemoryModels != null) {
      let otherModels = assert(otherMemoryModels);
      let numModels = selfMemoryModels.length;
      if (numModels != otherModels.length) return false;
      for (let i = 0; i < numModels; ++i) {
        if (unchecked(selfMemoryModels[i]) != unchecked(otherModels[i])) return false;
      }
    }

    // check return type
    if (!this.returnType.equals(other.returnType)) return false;

    // check parameter types
    let selfParameterTypes = this.parameterTypes;
    let otherParameterTypes = other.parameterTypes;
    let numParameters = selfParameterTypes.length;
    if (numParameters != otherParameterTypes.length)  return false;

    for (let i = 0; i < numParameters; ++i) {
      let selfParameterType = unchecked(selfParameterTypes[i]);
      let otherParameterType = unchecked(otherParameterTypes[i]);
      if (!selfParameterType.equals(otherParameterType)) return false;
    }
    return true;
  }

  /** Tests if a value of this function type is assignable to a target of the specified function type. */
  isAssignableTo(target: Signature, checkCompatibleOverride: bool = false): bool {
    let thisThisType = this.thisType;
    let targetThisType = target.thisType;

    if (thisThisType && targetThisType) {
      const compatibleThisType = checkCompatibleOverride 
        ? thisThisType.canExtendOrImplement(targetThisType)
        : targetThisType.isAssignableTo(thisThisType);
      if (!compatibleThisType) return false; 
    } else if (thisThisType || targetThisType) {
      return false;
    }

    // check rest parameter
    if (this.hasRest != target.hasRest) return false; // TODO

    // check return type (covariant)
    let thisReturnType = this.returnType;
    let targetReturnType = target.returnType;
    if (!(thisReturnType == targetReturnType || thisReturnType.isAssignableTo(targetReturnType))) {
      return false;
    }
    // check parameter types (invariant)
    let thisParameterTypes = this.parameterTypes;
    let targetParameterTypes = target.parameterTypes;
    let numParameters = thisParameterTypes.length;
    if (numParameters != targetParameterTypes.length) return false; // TODO

    for (let i = 0; i < numParameters; ++i) {
      let thisParameterType = unchecked(thisParameterTypes[i]);
      let targetParameterType = unchecked(targetParameterTypes[i]);
      if (thisParameterType != targetParameterType) return false;
    }
    return true;
  }

  /** Tests if this signature has at least one managed operand. */
  get hasManagedOperands(): bool {
    let thisType = this.thisType;
    if (thisType && thisType.isManaged) {
      return true;
    }
    let parameterTypes = this.parameterTypes;
    for (let i = 0, k = parameterTypes.length; i < k; ++i) {
      if (unchecked(parameterTypes[i]).isManaged) return true;
    }
    return false;
  }

  /** Gets the indices of all managed operands. */
  getManagedOperandIndices(): i32[] {
    let indices = new Array<i32>();
    let index = 0;
    let thisType = this.thisType;
    if (thisType) {
      if (thisType.isManaged) indices.push(index);
      ++index;
    }
    let parameterTypes = this.parameterTypes;
    for (let i = 0, k = parameterTypes.length; i < k; ++i) {
      if (unchecked(parameterTypes[i]).isManaged) {
        indices.push(index);
      }
      ++index;
    }
    return indices;
  }

  /** Tests if this signature has at least one v128 operand. */
  get hasVectorValueOperands(): bool {
    let thisType = this.thisType;
    if (thisType && thisType.isVectorValue) {
      return true;
    }
    let parameterTypes = this.parameterTypes;
    for (let i = 0, k = parameterTypes.length; i < k; ++i) {
      if (unchecked(parameterTypes[i]).isVectorValue) return true;
    }
    return false;
  }

  /** Gets the indices of all v128 operands. */
  getVectorValueOperandIndices(): i32[] {
    let indices = new Array<i32>();
    let index = 0;
    let thisType = this.thisType;
    if (thisType) {
      if (thisType.isVectorValue) indices.push(index);
      ++index;
    }
    let parameterTypes = this.parameterTypes;
    for (let i = 0, k = parameterTypes.length; i < k; ++i) {
      if (unchecked(parameterTypes[i]).isVectorValue) {
        indices.push(index);
      }
      ++index;
    }
    return indices;
  }

  /** Converts this signature to a string. */
  toString(validWat: bool = false): string {
    let sb = new Array<string>();
    sb.push(validWat ? "%28" : "(");
    let index = 0;
    let thisType = this.thisType;
    if (thisType) {
      sb.push(validWat ? "this:" : "this: ");
      sb.push(thisType.toString(validWat));
      index = 1;
    }
    let parameters = this.parameterTypes;
    let numParameters = parameters.length;
    if (numParameters) {
      let optionalStart = this.requiredParameters;
      let restIndex = this.hasRest ? numParameters - 1 : -1;
      for (let i = 0; i < numParameters; ++i, ++index) {
        if (index) sb.push(validWat ? "%2C" : ", ");
        if (i == restIndex) sb.push("...");
        sb.push(parameters[i].toString(validWat));
        if (i >= optionalStart && i != restIndex) sb.push("?");
      }
    }
    sb.push(validWat ? "%29=>" : ") => ");
    sb.push(this.returnType.toString(validWat));
    return sb.join("");
  }

  /** Creates a clone of this signature that is safe to modify. */
  clone(requiredParameters: i32 = this.requiredParameters, hasRest: bool = this.hasRest): Signature {
    let parameterTypes = this.parameterTypes;
    let numParameterTypes = parameterTypes.length;
    let cloneParameterTypes = new Array<Type>(numParameterTypes);
    for (let i = 0; i < numParameterTypes; ++i) {
      unchecked(cloneParameterTypes[i] = parameterTypes[i]);
    }
    return Signature.create(
      this.program,
      cloneParameterTypes,
      this.returnType,
      this.thisType,
      requiredParameters,
      hasRest,
      this.sretDisabled,
      this.externalBoundary,
      this.exportByValParams,
      this.memoryModels
    );
  }
}
