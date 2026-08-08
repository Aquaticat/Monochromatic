/**
 * Deep readonly and capability classification over TypeScript 7 semantic types.
 *
 * @module
 */

import {
  SignatureKind,
  SymbolFlags,
  TypeFlags,
  type Checker,
  type Project,
  type Symbol as TypeScriptSymbol,
  type Type,
} from 'typescript/unstable/sync';

import { SemanticBridgeError, } from './semantic-bridge-error.ts';
import { isForeignBorrowedType, } from './foreign-borrowed-identity.ts';
import {
  readonlyOwnerName,
  typeClaimsReadonlyProjection,
} from './readonly-owner.ts';
import { declarationIsReadonly, } from './readonly-declaration.ts';
import {
  CALLABLE_CAPABILITY,
  typeHasCallableCapability,
} from './readonly-callable-capability.ts';
import {
  combineClassifications,
  HONEST_READONLY,
} from './readonly-classification-combine.ts';

/**
 * Bit position of hidden TypeScript 7 mapped-property readonly state.
 */
const CHECK_FLAGS_READONLY_BIT = 3;

/**
 * Hidden TypeScript 7 mapped-property readonly bit audited from upstream Go source.
 */
const CHECK_FLAGS_READONLY = 1 << CHECK_FLAGS_READONLY_BIT;

/**
 * Sentinel while recursive type is being classified.
 */
const CLASSIFICATION_ACTIVE: unique symbol = Symbol('ReadonlyClassification traversal active for type',);

/**
 * Standard readonly generic collections classified through reachable type arguments.
 */
const READONLY_GENERIC_COLLECTION_OWNERS: ReadonlySet<string> = new Set([
  'ReadonlyMap',
  'ReadonlySet',
]);

/**
 * Semantic readonly classification used by rule diagnostics.
 *
 * @example
 * ```ts
 * const result: ReadonlyClassification = {
 *   kind: 'mutable',
 *   reason: 'property value is writable',
 * };
 * ```
 */
export type ReadonlyClassification =
  | { readonly kind: 'honest-readonly'; }
  | {
    readonly kind: 'mutable';
    readonly reason: string;
  }
  | {
    readonly kind: 'opaque-capability';
    readonly reason: string;
  }
  | {
    readonly kind: 'dishonest-readonly';
    readonly reason: string;
  };

/**
 * Determines whether property symbol is declared or mapped readonly.
 *
 * @param project - TypeScript project resolving declaration handles.
 *
 * @param property - Property symbol to inspect.
 *
 * @returns whether every declaration is readonly or mapped readonly bit is set.
 *
 * @throws {@link SemanticBridgeError} when unstable check flag is unavailable.
 *
 * @example
 * ```ts
 * const readonly = propertyIsReadonly({ project, property });
 * ```
 */
export function propertyIsReadonly({
  project,
  property,
}: {
  readonly project: Project;
  readonly property: TypeScriptSymbol;
},): boolean {
  if ((typeof property.checkFlags) !== 'number') {
    throw new SemanticBridgeError({
      reason: 'readonly-capability-unavailable',
      message: 'TypeScript Symbol.checkFlags is unavailable for readonly classification.',
    },);
  }
  if ((property.checkFlags & CHECK_FLAGS_READONLY) !== 0)
    return true;
  if (property
    .declarations
    .length
    === 0)
    return false;
  return property
    .declarations
    .every(function declarationReadonly(handle,): boolean {
      /**
       * Declaration node resolved in owning project.
       */
      const declaration = handle.resolve(project,);
      return (declaration !== undefined)
        && declarationIsReadonly(declaration,);
    },);
}

/**
 * Settled classifications by semantic type ID, per project.
 *
 * The memo inside `classifyReadonlyType` is created per call, which is correct for the cycle
 * marker it also holds and far narrower than the repetition it faces: a `Row` named by two
 * hundred callables was walked two hundred times, and each walk redid every property, element
 * and signature beneath it. Measured at 4.2ms per callable in
 * `doc/planning/oxlint-warm-sweep-attribution.md`.
 *
 * Safe to share because the classification depends on nothing but the type. Every use of
 * `checker` and `project` inside the walk is derived from the type being classified: its own
 * declaration handle, its base constraint, whether it is an array, its type arguments.
 *
 * Keyed on the project because a type ID means nothing outside the checker that issued it, which
 * is the same boundary the result is valid within, so the key cannot collide across instances.
 * `effect-final-index-cache.ts` keys its own store the same way.
 *
 * Only settled results are published. `CLASSIFICATION_ACTIVE` describes a traversal currently
 * below a type rather than a property of that type, and reaches this store by no path, since
 * `finish` is the only writer.
 */
const settledClassificationsByProject = new WeakMap<
  Project,
  Map<number, ReadonlyClassification>
>();

/**
 * Classifies deep readonly honesty for one resolved type graph.
 *
 * Recursive calls are bounded by unique TypeScript type IDs and break cycles
 * through active-state memoization.
 *
 * @param checker - TypeScript checker owning type graph.
 *
 * @param project - TypeScript project resolving symbols and declarations.
 *
 * @param type - Parameter type to classify.
 *
 * @returns deep readonly and capability classification.
 *
 * @example
 * ```ts
 * const classification = classifyReadonlyType({ checker, project, type });
 * ```
 */
export function classifyReadonlyType({
  checker,
  project,
  type,
}: {
  readonly checker: Checker;
  readonly project: Project;
  readonly type: Type;
},): ReadonlyClassification {
  /**
   * Memoized result or active traversal marker by semantic type ID.
   */
  const memo = new Map<number, ReadonlyClassification | typeof CLASSIFICATION_ACTIVE>();
  /**
   * Classifications this project has already settled, shared across every call.
   */
  const settled = settledClassificationsByProject.get(project,)
    ?? new Map<number, ReadonlyClassification>();
  settledClassificationsByProject.set(
    project,
    settled,
  );

  /**
   * Recursively classifies one type with cycle-aware memoization.
   *
   * @param current - Current semantic type node.
   *
   * @returns classification for current graph root.
   */
  function classify(current: Type,): ReadonlyClassification {
    /**
     * Result this project settled for the type on an earlier call, when it has.
     */
    const shared = settled.get(current.id,);
    if (shared !== undefined)
      return shared;
    /**
     * Prior result or active cycle marker for current type ID.
     */
    const cached = memo.get(current.id,);
    if (cached === CLASSIFICATION_ACTIVE)
      return HONEST_READONLY;
    if (cached !== undefined)
      return cached;
    memo.set(
      current.id,
      CLASSIFICATION_ACTIVE,
    );

    /**
     * Stores completed classification for current type.
     *
     * @param result - Completed current-type result.
     *
     * @returns same result after memoization.
     */
    function finish(result: ReadonlyClassification,): ReadonlyClassification {
      memo.set(
        current.id,
        result,
      );
      settled.set(
        current.id,
        result,
      );
      return result;
    }

    if (isForeignBorrowedType({
      project,
      type: current,
    },)) {
      return finish({
        kind: 'opaque-capability',
        reason: 'foreign API dictates mutable borrowed handle contract',
      },);
    }

    if ((current.flags & (TypeFlags.Any | TypeFlags.Unknown)) !== 0) {
      return finish({
        kind: 'opaque-capability',
        reason: 'unknown runtime value may carry mutable caller-owned capability',
      },);
    }

    if (current.isUnionType() || current.isIntersectionType()) {
      /**
       * Constituent classifications for combined type.
       */
      const constituentResults = current.getTypes()
        .map(classify,);
      return finish(combineClassifications(constituentResults,),);
    }
    if (current.isTypeParameter()) {
      /**
       * Base constraint providing reachable shape when available.
       */
      const constraint = checker.getBaseConstraintOfType(current,);
      return finish(constraint === undefined
        ? {
          kind: 'opaque-capability',
          reason: 'unconstrained type parameter has unknown reachable state',
        }
        : classify(constraint,),);
    }
    if ((current.flags & TypeFlags.NonPrimitive) !== 0) {
      return finish({
        kind: 'opaque-capability',
        reason: 'broad object type may carry caller-defined properties, accessors, or proxy capability',
      },);
    }
    if (typeHasCallableCapability({
      checker,
      type: current,
    },))
      return finish(CALLABLE_CAPABILITY,);
    if (!current.isObjectType())
      return finish(HONEST_READONLY,);
    /**
     * Declared owner identity used by standard projection policy.
     */
    const currentOwner = readonlyOwnerName(current,);
    if (checker.isArrayType(current,) && (currentOwner === 'Array')) {
      return finish({
        kind: 'mutable',
        reason: 'mutable Array has ReadonlyArray projection',
      },);
    }
    if (READONLY_GENERIC_COLLECTION_OWNERS.has(currentOwner,)
      && current.isTypeReference()) {
      /**
       * Deep classifications for keys and values reachable through collection iteration.
       */
      const readonlyCollectionTypeArguments = checker.getTypeArguments(current,)
        .map(classify,);
      return finish(combineClassifications(readonlyCollectionTypeArguments,),);
    }
    if (currentOwner === 'ReadonlyArray') {
      /**
       * Deep classifications for values reachable through readonly array index.
       */
      const readonlyArrayValueResults = checker.getIndexInfosOfType(current,)
        .map(function classifyReadonlyArrayValue(indexInfo,): ReadonlyClassification {
          return classify(indexInfo.valueType,);
        },);
      return finish(combineClassifications(readonlyArrayValueResults,),);
    }
    if (current.isTupleType()) {
      if (!current.readonly) {
        return finish({
          kind: 'mutable',
          reason: 'tuple is not readonly',
        },);
      }
      /**
       * Readonly tuple element classifications.
       */
      const tupleElementResults = checker.getTypeArguments(current,)
        .map(classify,);
      return finish(combineClassifications(tupleElementResults,),);
    }

    /**
     * Whether authored type claims readonly projection semantics.
     */
    const projectionClaimed = typeClaimsReadonlyProjection(current,);
    /**
     * Classification of every reachable named property.
     */
    const propertyResults = checker.getPropertiesOfType(current,)
      .map(function classifyProperty(property,): ReadonlyClassification {
        /**
         * Whether symbol is declared as method rather than data property.
         */
        const isMethod = (property.flags & SymbolFlags.Method) !== 0;
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
        if (declarationHandle === undefined) {
          return {
            kind: 'opaque-capability',
            reason: `property ${property.name} has no resolvable declaration`,
          };
        }
        /**
         * Declaration node used for property type and provenance.
         */
        const declaration = declarationHandle.resolve(project,);
        if (declaration === undefined) {
          return {
            kind: 'opaque-capability',
            reason: `property ${property.name} declaration cannot be resolved`,
          };
        }
        /**
         * Property type at exact declaring location.
         */
        const propertyType = checker.getTypeOfSymbolAtLocation(
          property,
          declaration,
        );
        /**
         * Call signatures retained by ordinary and mapped method properties.
         */
        const callSignatures = checker.getSignaturesOfType(
          propertyType,
          SignatureKind.Call,
        );
        /**
         * Whether property is behavior rather than assignable data slot.
         */
        const callable = isMethod || (callSignatures.length > 0);
        if (callable) {
          return projectionClaimed
            ? {
              kind: 'dishonest-readonly',
              reason: `${currentOwner}.${property.name} retains unknown callable capability`,
            }
            : {
              kind: 'opaque-capability',
              reason: `${currentOwner}.${property.name} has unresolved callable effect`,
            };
        }
        if (!propertyIsReadonly({
          project,
          property,
        },)) {
          return {
            kind: 'mutable',
            reason: `property ${property.name} is writable`,
          };
        }
        return classify(propertyType,);
      },);
    /**
     * Classification of every reachable index signature.
     */
    const indexResults = checker.getIndexInfosOfType(current,)
      .map(function classifyIndex(indexInfo,): ReadonlyClassification {
        if (!indexInfo.isReadonly) {
          return {
            kind: 'mutable',
            reason: 'index signature is writable',
          };
        }
        return classify(indexInfo.valueType,);
      },);
    return finish(combineClassifications([
      ...propertyResults,
      ...indexResults,
    ],),);
  }

  return classify(type,);
}
