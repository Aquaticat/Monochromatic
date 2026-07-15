/**
 * Complete persistent effect-summary payload validation.
 *
 * @module
 */

import type {
  SerializedCallEdge,
  SerializedCallbackKey,
  SerializedEffectSummaries,
  SerializedEffectSummary,
} from './effect-summary-serialization.ts';

/**
 * Maximum supported callable parameter or argument count.
 */
const MAX_CALLABLE_ARITY = 65_535;

/**
 * Maximum retained cache string length.
 */
const MAX_CACHE_STRING_LENGTH = 65_535;

/**
 * Tests whether unknown value is property-bearing record.
 *
 * @param value - Parsed JSON value.
 *
 * @returns whether direct string properties can be inspected.
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Tests bounded nonnegative integer.
 *
 * @param value - Parsed JSON value.
 *
 * @param upperBound - Exclusive maximum.
 *
 * @returns whether value is valid index.
 */
function isIndex({
  value,
  upperBound,
}: {
  readonly value: unknown;
  readonly upperBound: number;
}): boolean {
  return ((typeof value) === 'number')
    && Number.isInteger(value,)
    && (value >= 0)
    && (value < upperBound);
}

/**
 * Tests bounded cache string.
 *
 * @param value - Parsed JSON value.
 *
 * @returns whether string length fits cache policy.
 */
function isCacheString(value: unknown,): value is string {
  return ((typeof value) === 'string')
    && (value.length <= MAX_CACHE_STRING_LENGTH);
}

/**
 * Tests unique parameter-index array.
 *
 * @param value - Parsed JSON value.
 *
 * @param parameterCount - Exclusive parameter-index limit.
 *
 * @returns whether array contains only unique valid indexes.
 */
function isParameterIndexes({
  value,
  parameterCount,
}: {
  readonly value: unknown;
  readonly parameterCount: number;
}): boolean {
  if ((!Array.isArray(value,)) || (value.length > parameterCount))
    return false;
  /**
   * Parsed indexes narrowed from JSON array.
   */
  const indexes: readonly unknown[] = value;
  /**
   * Seen indexes rejecting duplicate cache amplification.
   */
  const seen = new Set<number>();
  for (const index of indexes) {
    if (((typeof index) !== 'number')
      || (!isIndex({
        value: index,
        upperBound: parameterCount,
      },))
      || seen.has(index,))
      return false;
    seen.add(index,);
  }
  return true;
}

/**
 * Tests caller-parameter roots for each call argument.
 *
 * @param value - Parsed JSON value.
 *
 * @param parameterCount - Exclusive caller parameter-index limit.
 *
 * @returns whether nested argument roots are bounded and valid.
 */
function isArgumentRoots({
  value,
  parameterCount,
}: {
  readonly value: unknown;
  readonly parameterCount: number;
}): boolean {
  return Array.isArray(value,)
    && (value.length <= MAX_CALLABLE_ARITY)
    && value.every(function validRoots(roots,): boolean {
      return isParameterIndexes({
        value: roots,
        parameterCount,
      },);
    },);
}

/**
 * Tests serialized callback identity.
 *
 * @param value - Parsed JSON value.
 *
 * @returns whether callback identity is unavailable or exact owned key.
 */
function isCallbackKey(value: unknown,): value is SerializedCallbackKey {
  return isRecord(value,)
    && ((value.kind === 'unavailable')
      || ((value.kind === 'owned') && isCacheString(value.key,)));
}

/**
 * Tests one serialized owned call edge.
 *
 * @param value - Parsed JSON value.
 *
 * @param parameterCount - Exclusive caller parameter-index limit.
 *
 * @returns whether every edge field and relation is valid.
 */
function isCallEdge({
  value,
  parameterCount,
}: {
  readonly value: unknown;
  readonly parameterCount: number;
}): boolean {
  if ((!isRecord(value,))
    || (!isCacheString(value.calleeKey,))
    || (!Array.isArray(value.arguments,))
    || (!isArgumentRoots({
      value: value.arguments,
      parameterCount,
    },))
    || (!Array.isArray(value.foreignArguments,))
    || (!isArgumentRoots({
      value: value.foreignArguments,
      parameterCount,
    },))
    || (!Array.isArray(value.directForeignArguments,))
    || (!Array.isArray(value.callbackKeys,))
    || ((typeof value.foreignInbound) !== 'boolean'))
    return false;
  /**
   * Call arity shared by every argument-relative edge field.
   */
  const arity = value.arguments
    .length;
  return (value.foreignArguments
    .length
    === arity)
    && (value.directForeignArguments
      .length
      === arity)
    && (value.callbackKeys
      .length
      === arity)
    && value.directForeignArguments
    .every(function booleanFlag(flag,): boolean {
      return (typeof flag) === 'boolean';
    },)
    && value.callbackKeys
    .every(isCallbackKey,);
}

/**
 * Tests one callback relation.
 *
 * @param value - Parsed JSON value.
 *
 * @param parameterCount - Exclusive callable parameter-index limit.
 *
 * @returns whether relation indexes are valid.
 */
function isCallbackRelation({
  value,
  parameterCount,
}: {
  readonly value: unknown;
  readonly parameterCount: number;
}): boolean {
  return isRecord(value,)
    && isIndex({
      value: value.callbackParameterIndex,
      upperBound: parameterCount,
    },)
    && isIndex({
      value: value.sourceParameterIndex,
      upperBound: parameterCount,
    },)
    && isIndex({
      value: value.callbackArgumentIndex,
      upperBound: MAX_CALLABLE_ARITY,
    },);
}

/**
 * Tests opaque provenance entries.
 *
 * @param value - Parsed JSON value.
 *
 * @param parameterCount - Exclusive callable parameter-index limit.
 *
 * @returns whether provenance keys and facts are bounded.
 */
function isOpaqueProvenance({
  value,
  parameterCount,
}: {
  readonly value: unknown;
  readonly parameterCount: number;
}): boolean {
  if (!Array.isArray(value,))
    return false;
  /**
   * Parsed provenance entries narrowed from JSON array.
   */
  const entries: readonly unknown[] = value;
  return entries.every(function validEntry(entry,): boolean {
    if ((!Array.isArray(entry,)) || (entry.length !== 2))
      return false;
    /**
     * Parsed tuple fields retained as unknown until individual validation.
     */
    const fields: readonly unknown[] = entry;
    /**
     * Parsed provenance parameter index and fact list.
     */
    const [index, facts,] = fields;
    if ((!isIndex({
      value: index,
      upperBound: parameterCount,
    },))
      || (!Array.isArray(facts,))
      || (facts.length > MAX_CALLABLE_ARITY))
      return false;
    /**
     * Parsed provenance facts narrowed from JSON array.
     */
    const factValues: readonly unknown[] = facts;
    return factValues.every(isCacheString,);
  },);
}

/**
 * Tests complete serialized direct summary.
 *
 * @param value - Parsed JSON value.
 *
 * @returns whether all summary fields satisfy runtime schema.
 */
function isEffectSummary(value: unknown,): value is SerializedEffectSummary {
  if ((!isRecord(value,))
    || ((typeof value.parameterCount) !== 'number')
    || (!isIndex({
      value: value.parameterCount,
      upperBound: MAX_CALLABLE_ARITY,
    })))
    return false;
  /**
   * Callable parameter count reused by every parameter-relative field.
   */
  const {parameterCount} = value;
  /**
   * Set-backed effect arrays requiring bounded unique indexes.
   */
  const effectArrays = [
    value.directMutated,
    value.directInvoked,
    value.directOpaque,
    value.directDocumentedUncertain,
    value.mutated,
    value.invoked,
    value.opaque,
    value.documentedUncertain,
    value.directForeignBorrowed,
  ];
  return effectArrays.every(function validIndexes(indexes,): boolean {
    return isParameterIndexes({
      value: indexes,
      parameterCount,
    },);
  },)
    && isOpaqueProvenance({
      value: value.opaqueProvenanceByParameter,
      parameterCount,
    },)
    && Array.isArray(value.relations,)
    && (value.relations
      .length
      <= MAX_CALLABLE_ARITY)
    && value.relations
    .every(function validRelation(relation,): boolean {
      return isCallbackRelation({
        value: relation,
        parameterCount,
      },);
    },)
    && Array.isArray(value.calls,)
    && (value.calls
      .length
      <= MAX_CALLABLE_ARITY)
    && value.calls
    .every(function validCall(call,): boolean {
      return isCallEdge({
        value: call,
        parameterCount,
      },);
    },);
}

/**
 * Tests full persistent effect-summary payload schema.
 *
 * @param value - Parsed JSON payload.
 *
 * @returns whether value can be safely rehydrated.
 *
 * @example
 * ```ts
 * if (isSerializedEffectSummaries(value)) deserializeEffectSummaries(value);
 * ```
 */
export function isSerializedEffectSummaries(
  value: unknown,
): value is SerializedEffectSummaries {
  if ((!Array.isArray(value,)) || (value.length > MAX_CALLABLE_ARITY))
    return false;
  /**
   * Parsed summary entries narrowed from JSON array.
   */
  const entries: readonly unknown[] = value;
  /**
   * Callable keys rejecting duplicate cache entries.
   */
  const keys = new Set<string>();
  for (const entry of entries) {
    if ((!Array.isArray(entry,)) || (entry.length !== 2))
      return false;
    /**
     * Parsed tuple fields retained as unknown until individual validation.
     */
    const fields: readonly unknown[] = entry;
    /**
     * Parsed callable key and direct summary.
     */
    const [key, summary,] = fields;
    if ((!isCacheString(key,)) || keys.has(key,)
      || (!isEffectSummary(summary,)))
      return false;
    keys.add(key,);
  }
  return true;
}
