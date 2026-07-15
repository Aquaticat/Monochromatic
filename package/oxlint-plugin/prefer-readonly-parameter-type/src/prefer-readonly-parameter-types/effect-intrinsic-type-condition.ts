/**
 * Semantic type-condition checks for overload-sensitive intrinsic effects.
 *
 * @module
 */

import type {
  CallExpression,
  Expression,
} from 'typescript/unstable/ast';
import {
  type Checker,
  SignatureKind,
  type Type,
  TypeFlags,
} from 'typescript/unstable/sync';

import type {
  IntrinsicArgumentTypeCondition,
  IntrinsicTypeCondition,
} from './intrinsic-effect-catalog.ts';
import { readonlyOwnerName, } from './readonly-owner.ts';

/**
 * Tests whether type is unresolved enough to require fail-closed matching.
 *
 * @param type - Semantic type candidate.
 *
 * @returns whether type is any or unknown.
 *
 * @example
 * ```ts
 * typeIsUnresolved(type);
 * ```
 */
function typeIsUnresolved(type: Type,): boolean {
  return (type.flags & TypeFlags.AnyOrUnknown) !== 0;
}

/**
 * Tests whether every runtime constituent has expected owner symbol.
 *
 * @param checker - TypeScript checker resolving type-parameter constraints.
 *
 * @param type - Semantic type candidate.
 *
 * @param ownerName - Required owner symbol name.
 *
 * @returns whether owner identity is definite.
 *
 * @example
 * ```ts
 * typeDefinitelyOwnedBy({ checker, type, ownerName: 'Uint8Array' });
 * ```
 */
function typeDefinitelyOwnedBy({
  checker,
  type,
  ownerName,
}: {
  readonly checker: Checker;
  readonly type: Type;
  readonly ownerName: string;
}): boolean {
  if (typeIsUnresolved(type,))
    return false;
  if (type.isUnionType()) {
    return type.getTypes()
      .every(function unionOwner(constituent,): boolean {
        return typeDefinitelyOwnedBy({
          checker,
          type: constituent,
          ownerName,
        },);
      },);
  }
  if (type.isTypeParameter()) {
    /**
     * Base constraint proving owner identity when present.
     */
    const constraint = checker.getBaseConstraintOfType(type,);
    return (constraint !== undefined)
      && typeDefinitelyOwnedBy({
        checker,
        type: constraint,
        ownerName,
      },);
  }
  return readonlyOwnerName(type,) === ownerName;
}

/**
 * Tests whether semantic type could expose callable runtime value.
 *
 * @param checker - TypeScript checker resolving signatures and constraints.
 *
 * @param type - Semantic type candidate.
 *
 * @returns whether at least one runtime constituent can be callable.
 *
 * @example
 * ```ts
 * typeMayBeCallable({ checker, type });
 * ```
 */
function typeMayBeCallable({
  checker,
  type,
}: {
  readonly checker: Checker;
  readonly type: Type;
}): boolean {
  if (typeIsUnresolved(type,))
    return true;
  if (type.isUnionType()) {
    return type.getTypes()
      .some(function callableUnionConstituent(constituent,): boolean {
        return typeMayBeCallable({
          checker,
          type: constituent,
        },);
      },);
  }
  if (type.isTypeParameter()) {
    /**
     * Base constraint limiting callable possibility when present.
     */
    const constraint = checker.getBaseConstraintOfType(type,);
    return (constraint === undefined)
      || typeMayBeCallable({
        checker,
        type: constraint,
      },);
  }
  /**
   * Call signatures directly exposed by candidate type.
   */
  const signatures = checker.getSignaturesOfType(
    type,
    SignatureKind.Call,
  );
  return signatures.length > 0;
}

/**
 * Tests whether every runtime constituent is string-valued.
 *
 * @param checker - TypeScript checker resolving type-parameter constraints.
 *
 * @param type - Semantic type candidate.
 *
 * @returns whether string identity is definite.
 *
 * @example
 * ```ts
 * typeDefinitelyString({ checker, type });
 * ```
 */
function typeDefinitelyString({
  checker,
  type,
}: {
  readonly checker: Checker;
  readonly type: Type;
}): boolean {
  if (typeIsUnresolved(type,))
    return false;
  if (type.isUnionType()) {
    return type.getTypes()
      .every(function stringUnionConstituent(constituent,): boolean {
        return typeDefinitelyString({
          checker,
          type: constituent,
        },);
      },);
  }
  if (type.isTypeParameter()) {
    /**
     * Base constraint proving string identity when present.
     */
    const constraint = checker.getBaseConstraintOfType(type,);
    return (constraint !== undefined)
      && typeDefinitelyString({
        checker,
        type: constraint,
      },);
  }
  return (type.flags & TypeFlags.StringLike) !== 0;
}

/**
 * Tests one semantic type against catalog condition.
 *
 * @param checker - TypeScript checker resolving type structure.
 *
 * @param type - Semantic type candidate.
 *
 * @param condition - Catalog condition to evaluate.
 *
 * @returns whether condition applies.
 *
 * @example
 * ```ts
 * intrinsicTypeConditionMatches({
 *   checker,
 *   type,
 *   condition: { kind: 'not-definitely-string' },
 * });
 * ```
 */
function intrinsicTypeConditionMatches({
  checker,
  type,
  condition,
}: {
  readonly checker: Checker;
  readonly type: Type;
  readonly condition: IntrinsicTypeCondition;
}): boolean {
  if (condition.kind === 'may-be-callable') {
    return typeMayBeCallable({
      checker,
      type,
    },);
  }
  if (condition.kind === 'not-definitely-string') {
    return !typeDefinitelyString({
      checker,
      type,
    },);
  }
  return typeDefinitelyOwnedBy({
    checker,
    type,
    ownerName: condition.ownerName,
  },);
}

/**
 * Tests call against every required argument type condition.
 *
 * @param checker - TypeScript checker resolving argument types.
 *
 * @param call - Exact overloaded call.
 *
 * @param conditions - Required argument conditions.
 *
 * @returns whether every required condition holds.
 *
 * @example
 * ```ts
 * intrinsicCallMatchesTypeConditions({ checker, call, conditions: [] });
 * ```
 */
export function intrinsicCallMatchesTypeConditions({
  checker,
  call,
  conditions,
}: {
  readonly checker: Checker;
  readonly call: CallExpression;
  readonly conditions: readonly IntrinsicArgumentTypeCondition[];
}): boolean {
  return conditions.every(function argumentConditionMatches(argumentCondition,): boolean {
    /**
     * Argument position and semantic condition selected by catalog entry.
     */
    const {
      argumentIndex,
      condition,
    } = argumentCondition;
    /**
     * Call argument selected by condition.
     */
    const argument = call.arguments[argumentIndex];
    if (argument === undefined)
      return false;
    /**
     * Semantic argument type when TypeScript resolved it.
     */
    const argumentType = checker.getTypeAtLocation(argument,);
    if (argumentType === undefined)
      return condition.kind !== 'definitely-owner';
    return intrinsicTypeConditionMatches({
      checker,
      type: argumentType,
      condition,
    },);
  },);
}

/**
 * Tests expression or selected property types against catalog condition.
 *
 * @param checker - TypeScript checker resolving expression and property types.
 *
 * @param expression - Root call argument expression.
 *
 * @param propertyNames - Optional selected first-level properties.
 *
 * @param condition - Catalog type condition.
 *
 * @returns whether selected value can exhibit conditioned behavior.
 *
 * @example
 * ```ts
 * intrinsicExpressionMatchesTypeCondition({
 *   checker,
 *   expression,
 *   propertyNames: ['files'],
 *   condition: { kind: 'may-be-callable' },
 * });
 * ```
 */
export function intrinsicExpressionMatchesTypeCondition({
  checker,
  expression,
  propertyNames,
  condition,
}: {
  readonly checker: Checker;
  readonly expression: Expression;
  readonly propertyNames?: readonly string[];
  readonly condition: IntrinsicTypeCondition;
}): boolean {
  /**
   * Semantic root argument type.
   */
  const expressionType = checker.getTypeAtLocation(expression,);
  if (expressionType === undefined)
    return condition.kind !== 'definitely-owner';
  if (propertyNames === undefined) {
    return intrinsicTypeConditionMatches({
      checker,
      type: expressionType,
      condition,
    },);
  }
  if (typeIsUnresolved(expressionType,))
    return condition.kind !== 'definitely-owner';
  /**
   * Selected property names for constant-time membership checks.
   */
  const selectedPropertyNames = new Set(propertyNames,);
  return checker.getPropertiesOfType(expressionType,)
    .filter(function selectedProperty(property,): boolean {
      return selectedPropertyNames.has(property.name,);
    },)
    .some(function propertyMatches(property,): boolean {
      /**
       * Semantic selected-property type when TypeScript resolved it.
       */
      const propertyType = checker.getTypeOfSymbolAtLocation(
        property,
        expression,
      );
      if (propertyType === undefined)
        return condition.kind !== 'definitely-owner';
      return intrinsicTypeConditionMatches({
        checker,
        type: propertyType,
        condition,
      },);
    },);
}
