/**
 * Deep readonly and capability classification over TypeScript 7 semantic types.
 *
 * @module
 */

import {
  ModifierFlags,
  SignatureKind,
  SymbolFlags,
  type Checker,
  type Project,
  type Symbol as TypeScriptSymbol,
  type Type,
} from 'typescript/unstable/sync';

import {
  intrinsicEffect,
  NO_INTRINSIC_EFFECT,
} from './intrinsic-effect-catalog.ts';
import {
  intrinsicEffectQuery,
  NO_INTRINSIC_QUERY,
} from './intrinsic-effect-query.ts';
import { SemanticBridgeError, } from './semantic-bridge-error.ts';

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
 * Mutable standard data containers with honest readonly projections.
 */
const PROJECTABLE_MUTABLE_OWNERS: ReadonlySet<string> = new Set([
  'Array',
  'Map',
  'Set',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
]);

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
 * Honest readonly singleton result.
 */
const HONEST_READONLY: ReadonlyClassification = { kind: 'honest-readonly', };

/**
 * Returns owner symbol name for resolved type.
 *
 * @param type - TypeScript semantic type.
 *
 * @returns declared or alias symbol name, or empty string when anonymous.
 */
function ownerName(type: Type,): string {
  /**
   * Direct symbol for interface, class, and object type.
   */
  const symbol = type.getSymbol();
  if (symbol !== undefined)
    return symbol.name;
  /**
   * Alias symbol fallback for mapped and projected types.
   */
  const aliasSymbol = type.getAliasSymbol();
  return aliasSymbol === undefined ? '' : aliasSymbol.name;
}

/**
 * Detects authored readonly projection aliases.
 *
 * @param type - TypeScript semantic type.
 *
 * @returns whether alias claims readonly projection.
 */
function claimsReadonlyProjection(type: Type,): boolean {
  /**
   * Authored alias name when type was instantiated through projection.
   */
  const aliasName = type.getAliasSymbol()
    ?.name;
  return (aliasName === 'Readonly')
    || (aliasName === 'ReadonlyDeep')
    || (aliasName === 'ReadonlyArray');
}

/**
 * Reads declaration modifier flags without assuming every node supports modifiers.
 *
 * @param value - TypeScript declaration node.
 *
 * @returns whether declaration carries readonly modifier.
 */
function declarationIsReadonly(value: object,): boolean {
  if (!('modifierFlags' in value))
    return false;
  /**
   * Runtime-narrowed modifier flags on declaration node.
   */
  const { modifierFlags, } = value;
  return ((typeof modifierFlags) === 'number')
    && ((modifierFlags & ModifierFlags.Readonly) !== 0);
}

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
 * Combines constituent classifications by diagnostic priority.
 *
 * @param classifications - Results from union or intersection constituents.
 *
 * @returns highest-priority non-readonly classification or honest readonly.
 */
function combineClassifications(
  classifications: readonly ReadonlyClassification[],
): ReadonlyClassification {
  return classifications.find(function dishonest(result,): boolean {
    return result.kind === 'dishonest-readonly';
  },)
    ?? classifications.find(function opaque(result,): boolean {
      return result.kind === 'opaque-capability';
    },)
    ?? classifications.find(function mutable(result,): boolean {
      return result.kind === 'mutable';
    },)
    ?? HONEST_READONLY;
}

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
   * Recursively classifies one type with cycle-aware memoization.
   *
   * @param current - Current semantic type node.
   *
   * @returns classification for current graph root.
   */
  function classify(current: Type,): ReadonlyClassification {
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
      return result;
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
    if (!current.isObjectType())
      return finish(HONEST_READONLY,);
    /**
     * Declared owner identity used by standard projection policy.
     */
    const currentOwner = ownerName(current,);
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
    const projectionClaimed = claimsReadonlyProjection(current,);
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
         * Exact intrinsic lookup query when declaration provenance is recognized.
         */
        const query = intrinsicEffectQuery({
          project,
          receiverType: current,
          memberSymbol: property,
        },);
        /**
         * Audited intrinsic mutation effect or no-effect sentinel.
         */
        const effect = query === NO_INTRINSIC_QUERY
          ? NO_INTRINSIC_EFFECT
          : intrinsicEffect(query,);
        if (effect !== NO_INTRINSIC_EFFECT) {
          if (projectionClaimed) {
            return {
              kind: 'dishonest-readonly',
              reason: `${currentOwner}.${property.name} retains intrinsic mutation capability`,
            };
          }
          if (PROJECTABLE_MUTABLE_OWNERS.has(currentOwner,)) {
            return {
              kind: 'mutable',
              reason: `${currentOwner}.${property.name} mutates projectable data`,
            };
          }
          return {
            kind: 'opaque-capability',
            reason: `${currentOwner}.${property.name} is an intrinsic capability`,
          };
        }
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
