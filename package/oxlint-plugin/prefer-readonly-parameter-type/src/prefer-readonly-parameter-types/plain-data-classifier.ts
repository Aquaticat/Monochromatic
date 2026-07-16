/**
 * Strict structural plain-data classification narrowing traversal-hook effects.
 *
 * Traversal of statically plain data cannot invoke statically declared
 * accessors, methods, or coercion hooks, so hook-class effects
 * (catalog opaque targets and global String object coercion) skip
 * plain-data-typed inputs.
 * A Proxy or getter-backed object satisfying a plain object type at runtime
 * is out of model by design;
 * static analysis cannot observe it.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import {
  type Checker,
  type Project,
  SymbolFlags,
  TypeFlags,
  type Type,
} from 'typescript/unstable/sync';

import { isForeignBorrowedType, } from './foreign-borrowed-identity.ts';
import { typeHasCallableCapability, } from './readonly-callable-capability.ts';

/**
 * Sentinel while recursive type is being classified;
 * cycle back-edges add no hook capability.
 */
const PLAIN_DATA_ACTIVE: unique symbol = Symbol('plain-data traversal active for type',);

/**
 * Symbol flags disqualifying a property from plain data:
 * methods are behavior and declared accessors are statically visible hooks.
 */
const UNPLAIN_PROPERTY_FLAGS = SymbolFlags.Method
  | SymbolFlags.GetAccessor
  | SymbolFlags.SetAccessor;

/**
 * Tests whether semantic type is strict structural plain data.
 *
 * Plain data admits primitives including branded primitive intersections,
 * literal types,
 * and arrays,
 * tuples,
 * index-signature records,
 * and object types composed only of plain data.
 * Call or construct signatures,
 * methods,
 * declared accessors,
 * class-instance provenance,
 * `ForeignBorrowed` marks,
 * `unknown`,
 * `any`,
 * `object`,
 * and type parameters fail closed as hook-capable.
 *
 * @param checker - TypeScript checker resolving properties and signatures.
 *
 * @param project - TypeScript project resolving property declarations.
 *
 * @param type - Semantic type crossing a hook-class effect boundary.
 *
 * @returns whether traversal of values of this type is statically hook-free.
 *
 * @example
 * ```ts
 * typeIsPlainData({ checker, project, type });
 * ```
 */
export function typeIsPlainData({
  checker,
  project,
  type,
}: {
  readonly checker: Checker;
  readonly project: Project;
  readonly type: Type;
},): boolean {
  /**
   * Memoized result or active traversal marker by semantic type ID.
   */
  const memo = new Map<number, boolean | typeof PLAIN_DATA_ACTIVE>();

  /**
   * Recursively classifies one type with cycle-aware memoization.
   *
   * @param current - Current semantic type node.
   *
   * @returns whether current graph root is plain data.
   */
  function classify(current: Type,): boolean {
    /**
     * Prior result or active cycle marker for current type ID.
     */
    const cached = memo.get(current.id,);
    if (cached === PLAIN_DATA_ACTIVE)
      return true;
    if (cached !== undefined)
      return cached;
    memo.set(
      current.id,
      PLAIN_DATA_ACTIVE,
    );
    /**
     * Completed classification for current type.
     */
    const result = classifyStructure(current,);
    memo.set(
      current.id,
      result,
    );
    return result;
  }

  /**
   * Classifies one type without memoization concerns.
   *
   * @param current - Current semantic type node.
   *
   * @returns whether current type structure is plain data.
   */
  function classifyStructure(current: Type,): boolean {
    if (isForeignBorrowedType({
      project,
      type: current,
    },))
      return false;
    if ((current.flags & TypeFlags.AnyOrUnknown) !== 0)
      return false;
    if ((current.flags & TypeFlags.NonPrimitive) !== 0)
      return false;
    if ((current.flags & TypeFlags.Primitive) !== 0)
      return true;
    if (current.isUnionType()) {
      return current.getTypes()
        .every(classify,);
    }
    if (current.isIntersectionType()) {
      /**
       * Intersection constituents deciding runtime primitiveness.
       */
      const constituents = current.getTypes();
      /* Branded primitives intersect a primitive base with an object brand;
       * the runtime value stays primitive. */
      if (constituents
        .some(function constituentIsPrimitive(constituent,): boolean {
          return (constituent.flags & TypeFlags.Primitive) !== 0;
        },))
        return true;
      return constituents.every(classify,);
    }
    if (current.isTypeParameter())
      return false;
    if (typeHasCallableCapability({
      checker,
      type: current,
    },))
      return false;
    if (!current.isObjectType())
      return false;
    /**
     * Direct symbol distinguishing class-instance provenance.
     */
    const ownerSymbol = current.getSymbol();
    if ((ownerSymbol !== undefined)
      && ((ownerSymbol.flags & SymbolFlags.Class) !== 0))
      return false;
    /* The target's local objectFlags check detects tuple references
     * without the checker.isTupleType native request, whose tuple cast
     * panics on exotic references during whole-repository lint. */
    if (current.isTypeReference()
      && (current
        .getTarget()
        .isTupleType()
        || checker.isArrayType(current,))) {
      return checker.getTypeArguments(current,)
        .every(classify,);
    }
    /**
     * Whether every named property is a plain data slot.
     */
    const propertiesPlain = checker.getPropertiesOfType(current,)
      .every(function propertyIsPlainData(property,): boolean {
        if ((property.flags & UNPLAIN_PROPERTY_FLAGS) !== 0)
          return false;
        /**
         * Value declaration candidate before type-only fallback.
         */
        const declarationHandleResult = { value: property.valueDeclaration, };
        declarationHandleResult.value ??= property
          .declarations
          .at(0,);
        /**
         * Value declaration or first type-only declaration fallback.
         */
        const { value: declarationHandle, } = declarationHandleResult;
        if (declarationHandle === undefined)
          return false;
        /**
         * Declaration node resolved in owning project.
         */
        const declaration = declarationHandle.resolve(project,);
        if (declaration === undefined)
          return false;
        return classify(checker.getTypeOfSymbolAtLocation(
          property,
          declaration,
        ),);
      },);
    if (!propertiesPlain)
      return false;
    return checker.getIndexInfosOfType(current,)
      .every(function indexValueIsPlainData(index,): boolean {
        return classify(index.valueType,);
      },);
  }

  return classify(type,);
}

/**
 * Tests whether every indexed value reachable from receiver is plain data.
 *
 * @param checker - TypeScript checker resolving index value types.
 *
 * @param project - TypeScript project resolving property declarations.
 *
 * @param type - Semantic receiver type.
 *
 * @returns whether receiver exposes at least one index and every value is plain data.
 *
 * @example
 * ```ts
 * receiverElementsArePlainData({ checker, project, type });
 * ```
 */
export function receiverElementsArePlainData({
  checker,
  project,
  type,
}: {
  readonly checker: Checker;
  readonly project: Project;
  readonly type: Type;
},): boolean {
  /**
   * Indexed value types exposed by receiver.
   */
  const indexes = checker.getIndexInfosOfType(type,);
  return (indexes.length > 0)
    && indexes.every(function indexValueIsPlain(index,): boolean {
      return typeIsPlainData({
        checker,
        project,
        type: index.valueType,
      },);
    },);
}

/**
 * Tests whether expression's semantic type is strict structural plain data.
 *
 * Unclassifiable syntax fails closed as hook-capable.
 *
 * @param checker - TypeScript checker resolving expression type.
 *
 * @param project - TypeScript project resolving property declarations.
 *
 * @param node - Receiver or argument expression crossing a hook-class boundary.
 *
 * @returns whether traversal of expression value is statically hook-free.
 *
 * @example
 * ```ts
 * expressionIsPlainData({ checker, project, node });
 * ```
 */
export function expressionIsPlainData({
  checker,
  project,
  node,
}: {
  readonly checker: Checker;
  readonly project: Project;
  readonly node: Node;
},): boolean {
  /**
   * Semantic expression type, absent when bridge cannot classify syntax.
   */
  const type = checker.getTypeAtLocation(node,);
  return (type !== undefined)
    && typeIsPlainData({
      checker,
      project,
      type,
    },);
}
