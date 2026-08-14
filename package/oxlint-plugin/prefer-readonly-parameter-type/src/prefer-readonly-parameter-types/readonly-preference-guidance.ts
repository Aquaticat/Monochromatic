import type { ReadonlySuggestion, } from './readonly-suggestion.ts';
import type { ReadonlyTypeOrigin, } from './readonly-type-origin-location.ts';
import type { ReadonlyTypeOriginEvidence, } from './readonly-type-origin.ts';

/**
 * Sentinel for verified suggestion guidance being unavailable.
 */
const VERIFIED_GUIDANCE_UNAVAILABLE: unique symbol = Symbol('verified suggestion guidance unavailable');

/**
 * Describes unique origin boundary for reader.
 *
 * @param origin - Eager workspace-owned origin metadata.
 *
 * @returns named or anonymous origin subject.
 *
 * @example
 * ```ts
 * originSubject({
 *   identity: '/repo/src/a.ts:10',
 *   kind: 'callable',
 *   name: 'toRow',
 *   location: 'src/a.ts:4',
 * });
 * ```
 */
function originSubject(origin: ReadonlyTypeOrigin,): string {
  if (origin.kind === 'callable') {
    return origin.name === undefined
      ? 'an anonymous callable'
      : `callable "${origin.name}"`;
  }
  if (origin.kind === 'type') {
    return origin.name === undefined
      ? 'an unnamed type declaration'
      : `type "${origin.name}"`;
  }
  return 'an inferred object expression';
}

/**
 * Gives cautious edit path for one unique semantic origin.
 *
 * @param origin - Eager workspace-owned origin metadata.
 *
 * @returns likely edit with explicit proof limit.
 *
 * @example
 * ```ts
 * uniqueOriginGuidance({
 *   identity: '/repo/src/a.ts:10',
 *   kind: 'callable',
 *   name: 'toRow',
 *   location: 'src/a.ts:4',
 * });
 * ```
 */
function uniqueOriginGuidance(origin: ReadonlyTypeOrigin,): string {
  /**
   * Shared origin sentence preceding category-specific edit path.
   */
  const introduction = `Its inferred parameter type originates in ${originSubject(origin,)} at ${origin.location}.`;
  if (origin.kind === 'callable') {
    return `${introduction} Likely edit: give that callable an explicit deeply readonly return type. No exact type syntax was proved for that producer; run type checking after the edit.`;
  }
  if (origin.kind === 'type') {
    return `${introduction} Likely edit: make the reported writable path deeply readonly in that type, or introduce a deeply readonly result type at the producer boundary. No exact type syntax was proved for that producer; run type checking after the edit.`;
  }
  return `${introduction} Likely edit: annotate the nearest project-owned producer boundary with a deeply readonly element type. No exact type syntax was proved for that producer; run type checking after the edit.`;
}

/**
 * Formats exact suggestion descriptions into diagnostic guidance.
 *
 * @param suggestions - Semantically verified replacement suggestions.
 *
 * @returns exact edit guidance when descriptions are available.
 *
 * @example
 * ```ts
 * verifiedSuggestionGuidance([{
 *   diagnosticGuidance: 'Replace A with B.',
 *   desc: 'Replace A with B.',
 *   fix,
 * }]);
 * ```
 */
function verifiedSuggestionGuidance(
  suggestions: readonly ReadonlySuggestion[],
): string | typeof VERIFIED_GUIDANCE_UNAVAILABLE {
  /**
   * Human-readable one-line transformations from verified suggestion channel.
   */
  const descriptions = suggestions.map(function describedSuggestion(suggestion,): string {
    return suggestion.diagnosticGuidance;
  },);
  if (descriptions.length === 0)
    return VERIFIED_GUIDANCE_UNAVAILABLE;
  if (descriptions.length === 1)
    return `Verified edit: ${descriptions[0]}`;
  /**
   * Numbered verified alternatives joined without line breaks.
   */
  const alternatives = descriptions
    .map(function numbered(
      description,
      index,
    ): string {
      return `${String(index + 1,)}. ${description}`;
    },)
    .join(' ',);
  return `Verified alternatives: ${alternatives}`;
}

/**
 * Builds complete action path for readonly preference diagnostic.
 *
 * @param suggestions - Semantically verified local replacement suggestions.
 *
 * @param originEvidence - Authored or inferred semantic type origin evidence.
 *
 * @returns exact,
 * likely,
 * multi-origin,
 * or boundary guidance.
 *
 * @example
 * ```ts
 * readonlyPreferenceGuidance({ suggestions, originEvidence });
 * ```
 */
export function readonlyPreferenceGuidance({
  suggestions,
  originEvidence,
}: {
  readonly suggestions: readonly ReadonlySuggestion[];
  readonly originEvidence: ReadonlyTypeOriginEvidence;
},): string {
  /**
   * Exact local transformation when suggestion builder proved one.
   */
  const verified = verifiedSuggestionGuidance(suggestions,);
  if ((typeof verified) !== 'symbol')
    return verified;
  if (originEvidence.kind === 'authored') {
    return 'No exact syntax replacement was proved for this authored type. Make the reported writable path deeply readonly in its declaration or replace the annotation with a deeply readonly projection, then run type checking.';
  }
  if (originEvidence.kind === 'unique')
    return uniqueOriginGuidance(originEvidence.origin,);
  if (originEvidence.kind === 'uncertain') {
    return 'At least one semantic declaration could not be resolved, so no unique workspace-owned origin was proved. Establish an explicit deeply readonly type at the nearest project-owned merge or producer boundary, then run type checking.';
  }
  if (originEvidence.kind === 'multiple') {
    return 'Its inferred parameter type has multiple workspace-owned origins, so no single producer edit was proved. Establish one common deeply readonly element type at their merge boundary, then annotate every producer to satisfy it.';
  }
  return 'No workspace-owned source origin was proved for this inferred parameter type. Introduce an explicit deeply readonly type at the nearest project-owned boundary that supplies this callback value, then run type checking.';
}
