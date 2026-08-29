import type { AbsoluteNaturalnessReviewOutcome, } from './absolute-naturalness-review-stage.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Consolidation naturalness state helpers

/**
 * Deduplicates model credits while preserving first occurrence.
 *
 * @param modelIds - credits across bounded generations
 *
 * @returns Stable unique model ids
 *
 * @example
 * ```ts
 * const unique = uniqueRosterModelIds({ modelIds, });
 * ```
 */
export function uniqueRosterModelIds(
  { modelIds, }: { readonly modelIds: readonly RosterModelId[]; },
): readonly RosterModelId[] {
  return [...new Set(modelIds,),];
}

/**
 * Renders latest structured findings for stage telemetry.
 *
 * @param review - exact rejected review feeding correction
 *
 * @returns Paragraph-located descriptions
 *
 * @example
 * ```ts
 * const findings = describeReviewFindings({ review, });
 * ```
 */
export function describeReviewFindings(
  { review, }: { readonly review: AbsoluteNaturalnessReviewOutcome; },
): readonly string[] {
  return review.findings
    .map(function describe(finding,): string {
      return `Paragraph ${String(finding.paragraph,)}: ${finding.problem}`;
    },);
}

//endregion Consolidation naturalness state helpers
