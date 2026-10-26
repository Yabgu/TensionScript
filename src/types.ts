/**
 * @fileoverview Mappings from AssemblyScript types to WebAssembly types.
 * @license Apache-2.0
 */

import {
  CommonNames
} from "./common";

import {
  Class,
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
  Void
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
   * Alignment (log2) of a {@link TypeKind.FixedArray}: its element's.
   *
   * `alignLog2` cannot derive this from `byteSize` -- a 24-byte `f32[6]` would
   * report 16-byte alignment (`31 - clz(24)` = 4), and a 96-byte `f32[24]` would
   * report 64. An array is aligned as its element is, no matter how long it is,
   * so the value is carried rather than computed.
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

  /** Gets this type's logarithmic alignment in memory. */
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
      let elementType = this.fixedElementType;
      let otherElementType = other.fixedElementType;
      return (
        elementType != null && otherElementType != null
        && this.fixedLength == other.fixedLength
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
        let elementType = this.fixedElementType;
        return (elementType ? elementType.toString() : "?")
          + "[" + this.fixedLength.toString() + "]";
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
    switch (this.kind) {
      case TypeKind.Bool:
      case TypeKind.I8:
      case TypeKind.I16:
      case TypeKind.I32:
      case TypeKind.U8:
      case TypeKind.U16:
      case TypeKind.U32: return TypeRef.I32;
      case TypeKind.Isize:
      case TypeKind.Usize: if (this.size != 64) return TypeRef.I32;
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
  /** Interned fixed-array types, keyed by element type and length. */
  private static _fixedArrays: Map<string, Type> | null = null;

  /**
   * Gets the {@link TypeKind.FixedArray} of `elementType` repeated `length` times.
   *
   * Interned: the same element and length always yield the same `Type`, so
   * `offsetof`, `alignof`, `sizeof` and field lookup can compare by identity the
   * way they do for every other type. Size is the element's byte size times the
   * length, and the alignment is the element's -- carried in
   * {@link fixedAlignLog2} rather than derived from the total, because a total
   * is not a power of two for the lengths records actually have (`f32[6]`).
   */
  static fixedArray(elementType: Type, length: i32): Type {
    let key = elementType.toString() + "[" + length.toString() + "]";
    let cache = Type._fixedArrays;
    if (!cache) {
      let fresh = new Map<string, Type>();
      Type._fixedArrays = fresh;
      cache = fresh;
    }
    let cached = getMapEntry(cache, key);
    if (cached) return cached;
    let arrayType = new Type(
      TypeKind.FixedArray,
      TypeFlags.None,
      elementType.byteSize * length << 3 // bytes -> bits
    );
    arrayType.fixedElementType = elementType;
    arrayType.fixedLength = length;
    arrayType.fixedAlignLog2 = elementType.alignLog2;
    cache.set(key, arrayType);
    return arrayType;
  }

  /** Gets the element type of a {@link TypeKind.FixedArray}. */
  get fixedArrayElementType(): Type {
    return assert(this.fixedElementType);
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
function memoryModelsToKeySegment(memoryModels: u8[] | null): string {
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
    memoryModels: u8[] | null = null
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
    public readonly memoryModels: u8[] | null,
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
   * be done with it. See `docs/memconv-signature-scope.md` §5.2 for why rooting
   * deliberately reads only the second.
   */
  memoryModelOf(sourceIndex: i32): u8 {
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
    let classReference = type.classReference;
    if (
      classReference == null ||
      !classReference.hasDecorator(DecoratorFlags.InlineStruct)
    ) return 1;
    let members = classReference.members;
    if (!members) return 1;
    let count = 0;
    for (let _values = Map_values(members), i = 0, k = _values.length; i < k; ++i) {
      let member = unchecked(_values[i]);
      // A resolved `Class`'s members are prototypes; the bound `Property` that
      // carries `isField` hangs off `prototype.instance`.
      if (member.kind != ElementKind.PropertyPrototype) continue;
      let property = (<PropertyPrototype>member).instance;
      if (property != null && property.isField) ++count;
    }
    return count > 0 ? count : 1;
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
    if (this.isByValPointerParam(sourceIndex)) return 1;
    return Signature.wasmParamCountOf(unchecked(this.parameterTypes[sourceIndex]));
  }

  /**
   * Whether source parameter `sourceIndex` crosses a host boundary as a single
   * `i32` address instead of one WASM operand per field.
   *
   * Both halves matter: the signature must be a host-boundary signature, and
   * the parameter must actually be an `@inline struct` (every other type already
   * spends one operand).
   */
  isExternalPointerParam(sourceIndex: i32): bool {
    if (!this.externalBoundary) return false;
    return Signature.isInlineStructRef(unchecked(this.parameterTypes[sourceIndex]));
  }

  /** Whether source parameter `sourceIndex` of an **export** crosses as a byval
   *  pointer: the host materialises the value and passes its address, and the
   *  callee copies the fields in at entry. */
  isExportByValParam(sourceIndex: i32): bool {
    if (!this.exportByValParams) return false;
    return Signature.isInlineStructRef(unchecked(this.parameterTypes[sourceIndex]));
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

  /** The number of fields an `@inline struct` has (0 for a record with none).
   *  Distinct from `wasmParamCountOf`, which cannot express "one field" and
   *  "one operand" differently. */
  static fieldCountOf(type: Type): i32 {
    let classReference = type.classReference;
    if (classReference == null) return 0;
    let members = classReference.members;
    if (!members) return 0;
    let count = 0;
    for (let _values = Map_values(members), i = 0, k = _values.length; i < k; ++i) {
      let member = unchecked(_values[i]);
      if (member.kind != ElementKind.PropertyPrototype) continue;
      let property = (<PropertyPrototype>member).instance;
      if (property != null && property.isField) ++count;
    }
    return count;
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
      if (this.isByValPointerParam(i)) {
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
        let classReference = assert(parameterType.classReference);
        let members = assert(classReference.members);
        for (let _values = Map_values(members), j = 0, n = _values.length; j < n; ++j) {
          let member = unchecked(_values[j]);
          if (member.kind != ElementKind.PropertyPrototype) continue;
          let property = (<PropertyPrototype>member).instance;
          if (property == null || !property.isField) continue;
          unchecked(typeRefs[at++] = property.type.toRef());
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
    return this.hasHiddenDestParam ? TypeRef.None : this.returnType.toRef();
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
