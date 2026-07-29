/**
 * Shared vocabulary for opacity a store caused, as opposed to opacity a call caused.
 *
 * Both causes travel in the same provenance strings, because that is what already crosses
 * a call edge: `propagateUncertaintyProvenance` copies a callee's facts onto the caller
 * verbatim, so a cause recorded in the text reaches every caller with no change to the
 * summary model, the fixed point, the in-process cache or the persistent format. Reading a
 * cause back out of that text is the idiom `everyBoundaryIsInputMethod` already uses to
 * decide which message a boundary set deserves.
 *
 * The writer and the reader therefore share one constant instead of spelling the same
 * prefix twice, which is the whole reason this module exists rather than a literal at each
 * end.
 *
 * @module
 */

/**
 * Prefix marking a provenance fact as a store rather than an unresolved call.
 */
const RETENTION_PROVENANCE_PREFIX = 'stored into ';

/**
 * Builds one provenance fact for a value the callable handed to a binding it does not own.
 *
 * @param target - Authored text of what the value was handed to.
 *
 * @param location - Where the store sits, so a report can point at it.
 *
 * @returns provenance fact carrying both cause and place.
 *
 * @example
 * ```ts
 * retentionProvenance({ target: 'this.#task', location: 'src/card.ts:60', });
 * ```
 */
export function retentionProvenance({
  target,
  location,
}: {
  readonly target: string;
  readonly location: string;
},): string {
  return `${RETENTION_PROVENANCE_PREFIX}${target} [${location}]`;
}

/**
 * Separates provenance facts a call caused from facts a store caused.
 *
 * Kept as one pass returning both halves rather than two predicates over the same list,
 * because every caller needs both: one half decides whether to speak and the other decides
 * what to name.
 *
 * @param boundaries - Provenance facts recorded against one parameter.
 *
 * @returns facts split by cause, each keeping its original order.
 *
 * @example
 * ```ts
 * const { callBoundaries, } = splitRetentionBoundaries({ boundaries, },);
 * ```
 */
export function splitRetentionBoundaries({
  boundaries,
}: {
  readonly boundaries: readonly string[];
},): {
  readonly callBoundaries: readonly string[];
  readonly retentionBoundaries: readonly string[];
} {
  return {
    callBoundaries: boundaries.filter(function boundaryIsCall(boundary,): boolean {
      return !boundary.startsWith(RETENTION_PROVENANCE_PREFIX,);
    },),
    retentionBoundaries: boundaries.filter(function boundaryIsRetention(boundary,): boolean {
      return boundary.startsWith(RETENTION_PROVENANCE_PREFIX,);
    },),
  };
}
