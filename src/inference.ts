/**
 * Type inference for bindings a transform must *name*.
 *
 * Both AST transforms run at `afterParse`, before resolution, so neither can ask
 * the resolver what a local's type is. When one of them has to emit a field type
 * for a binding the user left unannotated — the closure transform's environment
 * class, the async transform's state struct — it needs a type *expression*, and
 * the only source available that early is the initializer's own syntax.
 *
 * This is `docs/closures-plan.md` §4.6's syntax arm (C6a). It is deliberately
 * narrow: everything it cannot name from syntax alone returns `null`, and the
 * caller keeps its existing refusal. It is not a resolver, and it does not
 * pretend to be one — the resolver arm is C6c.
 *
 * Inference is on demand. A program with nothing to lower never calls this, so
 * no AST is touched and byte identity is preserved by construction.
 */

import { Node } from "./ast";
import {
  AssertionExpression,
  AssertionKind,
  BinaryExpression,
  CallExpression,
  Expression,
  IdentifierExpression,
  LiteralExpression,
  LiteralKind,
  NamedTypeNode,
  NewExpression,
  NodeKind,
  ParenthesizedExpression,
  TypeNode,
  UnaryPostfixExpression,
  UnaryPrefixExpression
} from "./ast";
import { Token } from "./tokenizer";

/**
 * Infers a type expression from an initializer's syntax.
 *
 * `known` maps a local name to the type it is already known by (a declared
 * annotation, or one an earlier inference wrote). Only same-named primitives and
 * `f64` promotion are combined; a mixed arithmetic expression this table cannot
 * name returns `null` rather than guessing, because a wrong annotation would be
 * worse than the refusal it replaced.
 */
export function inferTypeFromInitializer(
  initializer: Expression | null,
  known: Map<string, TypeNode> | null,
  depth: i32 = 0
): TypeNode | null {
  if (initializer == null) return null;
  switch (initializer.kind) {
    case NodeKind.Literal: {
      switch ((<LiteralExpression>initializer).literalKind) {
        case LiteralKind.Integer: return primitive("i32", initializer);
        case LiteralKind.Float: return primitive("f64", initializer);
        case LiteralKind.String:
        case LiteralKind.Template: return primitive("string", initializer);
      }
      // `[]` and `{}` need element-wise work; not this table's.
      return null;
    }
    case NodeKind.True:
    case NodeKind.False:
      return primitive("bool", initializer);
    case NodeKind.Parenthesized: {
      return inferTypeFromInitializer(
        (<ParenthesizedExpression>initializer).expression, known, depth
      );
    }
    case NodeKind.New: {
      // `new X<A,B>(...)` names its own type: the expression carries the type
      // name and the type arguments the user wrote. A bare `new X()` is safe to
      // spell the same way — AS requires type arguments for a generic class, so
      // a missing list means the class is not generic.
      let expr = <NewExpression>initializer;
      return Node.createNamedType(expr.typeName, expr.typeArguments, false, expr.range);
    }
    case NodeKind.Assertion: {
      let expr = <AssertionExpression>initializer;
      if (expr.assertionKind != AssertionKind.NonNull && expr.toType != null) {
        // `<T>expr` and `expr as T` name the type outright.
        return expr.toType;
      }
      return inferTypeFromInitializer(expr.expression, known, depth);
    }
    case NodeKind.Call: {
      // `changetype<T>(...)` names its target type as an argument. Nothing else
      // in call position is inferable before resolution (C6c's job).
      let expr = <CallExpression>initializer;
      let callee = expr.expression;
      if (
        callee.kind == NodeKind.Identifier &&
        (<IdentifierExpression>callee).text == "changetype"
      ) {
        let typeArguments = expr.typeArguments;
        if (typeArguments != null && typeArguments.length == 1) return typeArguments[0];
      }
      return null;
    }
    case NodeKind.Identifier: {
      // An alias of a local whose type is already known. `depth` stops a chain
      // from chasing itself; declaration order already prevents most cycles.
      if (known == null || depth > 8) return null;
      let name = (<IdentifierExpression>initializer).text;
      let type = known.get(name);
      return type != null ? type : null;
    }
    case NodeKind.UnaryPrefix: {
      let expr = <UnaryPrefixExpression>initializer;
      switch (expr.operator) {
        case Token.Exclamation:
          return primitive("bool", initializer);
        case Token.Minus:
        case Token.Plus:
        case Token.Tilde: {
          let operand = inferTypeFromInitializer(expr.operand, known, depth + 1);
          return isNumeric(operand) ? operand : null;
        }
      }
      return null;
    }
    case NodeKind.UnaryPostfix: {
      // `x++`/`x--` have the operand's type.
      let operand = inferTypeFromInitializer(
        (<UnaryPostfixExpression>initializer).operand, known, depth + 1
      );
      return isNumeric(operand) ? operand : null;
    }
    case NodeKind.Binary: {
      let expr = <BinaryExpression>initializer;
      switch (expr.operator) {
        case Token.LessThan:
        case Token.GreaterThan:
        case Token.LessThan_Equals:
        case Token.GreaterThan_Equals:
        case Token.Equals_Equals:
        case Token.Exclamation_Equals:
        case Token.Equals_Equals_Equals:
        case Token.Exclamation_Equals_Equals:
          return primitive("bool", initializer);
        case Token.LessThan_LessThan:
        case Token.GreaterThan_GreaterThan:
        case Token.GreaterThan_GreaterThan_GreaterThan: {
          // A shift keeps the left operand's type.
          let left = inferTypeFromInitializer(expr.left, known, depth + 1);
          return isNumeric(left) ? left : null;
        }
        case Token.Ampersand_Ampersand:
        case Token.Bar_Bar: {
          // `a && b` is `bool` only when both sides are; otherwise the operand
          // type is the result and this table cannot name it safely.
          let left = inferTypeFromInitializer(expr.left, known, depth + 1);
          let right = inferTypeFromInitializer(expr.right, known, depth + 1);
          return isNamed(left, "bool") && isNamed(right, "bool")
            ? primitive("bool", initializer)
            : null;
        }
        case Token.Plus:
        case Token.Minus:
        case Token.Asterisk:
        case Token.Slash:
        case Token.Percent:
        case Token.Ampersand:
        case Token.Bar:
        case Token.Caret:
        case Token.Asterisk_Asterisk: {
          let left = inferTypeFromInitializer(expr.left, known, depth + 1);
          let right = inferTypeFromInitializer(expr.right, known, depth + 1);
          if (!isNumeric(left) || !isNumeric(right)) return null;
          if (isNamed(left, "f64") || isNamed(right, "f64")) {
            if (!isNamed(left, "f32") && !isNamed(right, "f32")) {
              return primitive("f64", initializer);
            }
            return null;
          }
          // Same type on both sides is the common case and the only one this
          // table may claim: promotion rules differ per operator.
          return sameNamed(left, right) ? left : null;
        }
      }
      return null;
    }
  }
  return null;
}

/** Builds a primitive type node naming `name`, ranged at the expression. */
function primitive(name: string, at: Expression): TypeNode {
  let typeName = Node.createSimpleTypeName(name, at.range);
  return Node.createNamedType(typeName, null, false, at.range);
}

/** Whether `type` names one of the numeric primitives. */
function isNumeric(type: TypeNode | null): bool {
  if (type == null || type.kind != NodeKind.NamedType) return false;
  let named = <NamedTypeNode>type;
  let text = named.name.identifier.text;
  return text == "i8" || text == "i16" || text == "i32" || text == "i64"
      || text == "u8" || text == "u16" || text == "u32" || text == "u64"
      || text == "isize" || text == "usize"
      || text == "f32" || text == "f64";
}

/** Whether a type node carries type arguments. The parser represents "none" as
 * an empty array, not as `null`, so both must be treated as absent. */
function hasTypeArguments(type: NamedTypeNode): bool {
  let typeArguments = type.typeArguments;
  return typeArguments != null && typeArguments.length > 0;
}

/** Whether `type` is a bare (non-generic) name equal to `name`. */
function isNamed(type: TypeNode | null, name: string): bool {
  if (type == null || type.kind != NodeKind.NamedType) return false;
  let named = <NamedTypeNode>type;
  return named.name.identifier.text == name && !hasTypeArguments(named);
}

/** Whether two bare named types are the same name. */
function sameNamed(left: TypeNode | null, right: TypeNode | null): bool {
  if (left == null || right == null) return false;
  if (left.kind != NodeKind.NamedType || right.kind != NodeKind.NamedType) return false;
  let a = <NamedTypeNode>left;
  let b = <NamedTypeNode>right;
  if (hasTypeArguments(a) || hasTypeArguments(b)) return false;
  return a.name.identifier.text == b.name.identifier.text;
}
