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
 * Tests unique bounded-index array.
 *
 * Used for both parameter positions and effect slots, which is why the bound is a plain
 * argument: the two share a representation and differ only in what bounds them, and passing
 * the wrong one here would accept a payload whose numbers point outside the callable.
 *
 * @param value - Parsed JSON value.
 *
 * @param upperBound - Exclusive index limit.
 *
 * @returns whether array contains only unique valid indexes.
 */
function isBoundedIndexes({
  value,
  upperBound,
}: {
  readonly value: unknown;
  readonly upperBound: number;
}): boolean {
  if ((!Array.isArray(value,)) || (value.length > upperBound))
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
        upperBound,
      },))
      || seen.has(index,))
      return false;
    seen.add(index,);
  }
  return true;
}

/**
 * Tests caller-side roots recorded per callee position.
 *
 * The outer length is a count of the callee's positions, which this validator cannot know,
 * so it is bounded by arity alone. The inner values belong to the caller and are bounded by
 * whatever the caller has: slots for effect origins, parameters for foreign ownership.
 *
 * @param value - Parsed JSON value.
 *
 * @param upperBound - Exclusive caller index limit.
 *
 * @returns whether nested argument roots are bounded and valid.
 */
function isArgumentRoots({
  value,
  upperBound,
}: {
  readonly value: unknown;
  readonly upperBound: number;
}): boolean {
  return Array.isArray(value,)
    && (value.length <= MAX_CALLABLE_ARITY)
    && value.every(function validRoots(roots,): boolean {
      return isBoundedIndexes({
        value: roots,
        upperBound,
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
 * @param slotCount - Exclusive caller slot limit.
 *
 * @returns whether every edge field and relation is valid.
 */
function isCallEdge({
  value,
  parameterCount,
  slotCount,
}: {
  readonly value: unknown;
  readonly parameterCount: number;
  readonly slotCount: number;
}): boolean {
  if ((!isRecord(value,))
    || (!isCacheString(value.calleeKey,))
    || (!isCacheString(value.calleeFileName,))
    || (!Array.isArray(value.originsByCalleeSlot,))
    || (!isArgumentRoots({
      value: value.originsByCalleeSlot,
      upperBound: slotCount,
    },))
    || (!Array.isArray(value.foreignOriginsByFormal,))
    || (!isArgumentRoots({
      value: value.foreignOriginsByFormal,
      upperBound: parameterCount,
    },))
    || (!Array.isArray(value.directForeignByFormal,))
    || (!Array.isArray(value.callbackKeysByCalleeSlot,))
    || (!Array.isArray(value.callbackFileNamesByCalleeSlot,))
    || ((typeof value.foreignInbound) !== 'boolean'))
    return false;
  /* Two lengths, not one. Slots split the edge: origins and callback identities are indexed
   * by the callee's slots, while foreign ownership is indexed by its formals, and a callee
   * with a destructured parameter has strictly more of the first. The counts belong to the
   * callee, which this validator cannot see, so only their agreement is checked. */
  /**
   * Callee slot count shared by every slot-indexed edge field.
   */
  const slotArity = value.originsByCalleeSlot
    .length;
  /**
   * Callee formal count shared by every formal-indexed edge field.
   */
  const formalArity = value.foreignOriginsByFormal
    .length;
  return (formalArity <= slotArity)
    && (value.directForeignByFormal
      .length
      === formalArity)
    && (value.callbackKeysByCalleeSlot
      .length
      === slotArity)
    && (value.callbackFileNamesByCalleeSlot
      .length
      === slotArity)
    && value.directForeignByFormal
    .every(function booleanFlag(flag,): boolean {
      return (typeof flag) === 'boolean';
    },)
    && value.callbackKeysByCalleeSlot
    .every(isCallbackKey,)
    && value.callbackFileNamesByCalleeSlot
    .every(isCallbackKey,);
}

/**
 * Tests one callback relation.
 *
 * @param value - Parsed JSON value.
 *
 * @param slotCount - Exclusive callable slot limit.
 *
 * @returns whether relation indexes are valid.
 */
function isCallbackRelation({
  value,
  slotCount,
}: {
  readonly value: unknown;
  readonly slotCount: number;
}): boolean {
  return isRecord(value,)
    && isIndex({
      value: value.callbackSlot,
      upperBound: slotCount,
    },)
    && isIndex({
      value: value.sourceSlot,
      upperBound: slotCount,
    },)
    && isIndex({
      value: value.callbackArgumentPosition,
      upperBound: MAX_CALLABLE_ARITY,
    },);
}

/**
 * Tests one serialized element-flow relation.
 *
 * @param value - Parsed JSON value.
 *
 * @param slotCount - Exclusive callable slot limit.
 *
 * @returns whether relation identity and indexes are valid.
 */
function isElementApplication({
  value,
  slotCount,
}: {
  readonly value: unknown;
  readonly slotCount: number;
}): boolean {
  return isRecord(value,)
    && isIndex({
      value: value.receiverSlot,
      upperBound: slotCount,
    },)
    && isCacheString(value.callbackKey,)
    && isBoundedIndexes({
      value: value.observerParameterIndexes,
      upperBound: MAX_CALLABLE_ARITY,
    },);
}

/**
 * Tests opaque provenance entries.
 *
 * @param value - Parsed JSON value.
 *
 * @param slotCount - Exclusive callable slot limit.
 *
 * @returns whether provenance keys and facts are bounded.
 */
function isOpaqueProvenance({
  value,
  slotCount,
}: {
  readonly value: unknown;
  readonly slotCount: number;
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
      upperBound: slotCount,
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
  const { parameterCount, } = value;
  /* Ownership is what makes the rest of the payload meaningful, so it is checked before
   * anything that depends on it. Every slot must name a parameter this callable has, and the
   * whole parameters must come first and in order, because that is the numbering the
   * allocator produces and a caller's cached edge indexes into. */
  /**
   * Persisted slot ownership, still unvalidated.
   */
  const { parameterOfSlot, } = value;
  if (!Array.isArray(parameterOfSlot,))
    return false;
  /**
   * Distinct owners named by the persisted ownership.
   */
  const distinctOwners = [...new Set(parameterOfSlot,),];
  if ((parameterOfSlot.length < parameterCount)
    || (parameterOfSlot.length > MAX_CALLABLE_ARITY)
    || (!isBoundedIndexes({
      value: distinctOwners,
      upperBound: parameterCount,
    },))
    || parameterOfSlot
      .slice(
        0,
        parameterCount,
      )
    .some(function outOfOrderWholeSlot(
        owner,
        slot,
      ): boolean {
        return owner !== slot;
      },))
    return false;
  /**
   * Slot count bounding every slot-relative field.
   */
  const slotCount = parameterOfSlot.length;
  /**
   * Set-backed effect arrays requiring bounded unique slots.
   */
  const slotArrays = [
    value.directMutated,
    value.directInvoked,
    value.directOpaque,
    value.mutated,
    value.invoked,
    value.opaque,
    value.directReturned,
  ];
  return slotArrays.every(function validSlots(slots,): boolean {
    return isBoundedIndexes({
      value: slots,
      upperBound: slotCount,
    },);
  },)
    && isBoundedIndexes({
      value: value.directForeignBorrowed,
      upperBound: parameterCount,
    },)
    && isOpaqueProvenance({
      value: value.opaqueProvenanceBySlot,
      slotCount,
    },)
    && Array.isArray(value.relations,)
    && (value.relations
      .length
      <= MAX_CALLABLE_ARITY)
    && value.relations
    .every(function validRelation(relation,): boolean {
      return isCallbackRelation({
        value: relation,
        slotCount,
      },);
    },)
    && Array.isArray(value.elementApplications,)
    && (value.elementApplications
      .length
      <= MAX_CALLABLE_ARITY)
    && value.elementApplications
    .every(function validApplication(application,): boolean {
      return isElementApplication({
        value: application,
        slotCount,
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
        slotCount,
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
