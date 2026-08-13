import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { EditableEnvelope, } from './patch-model.ts';

//region Licensed quotes
// What each envelope's issues quoted as the defect, which is what the
// preservation gate treats as licensed to disappear. Everything else in the
// replaced span has to survive.

/**
 * Collects the defect text each envelope's accepted issues quoted.
 *
 * TARGET-SIDE SPANS ONLY. A source-side quote is Chinese prose that never
 * appears in the English being edited, so licensing it would license nothing
 * and only slow the lookup.
 *
 * @param envelopes - envelopes about to be edited
 *
 * @param issues - adjudicated issues for the chunk
 *
 * @returns Quotes keyed by envelope id
 *
 * @example
 * ```ts
 * const licensedQuotes = buildLicensedQuotes({ envelopes, issues, },);
 * ```
 */
export function buildLicensedQuotes(
  {
    envelopes,
    issues,
  }: {
    readonly envelopes: readonly EditableEnvelope[];
    readonly issues: readonly AdjudicatedIssue[];
  },
): ReadonlyMap<string, readonly string[]> {
  /**
   * Quoted defect text of each issue, by issue id.
   */
  const quotesByIssue = new Map(issues.map(function toEntry(issue,) {
    return [
      issue.issueId,
      issue.claims
        .flatMap(function toQuotes(member,): readonly string[] {
        return member.claim
          .spans
          .filter(function isTargetSide(span,): boolean {
          return span.side === 'target';
        },)
          .map(function toText(span,): string {
          return span.quotedText;
        },);
      },),
    ] as const;
  },),);

  return new Map(envelopes.map(function toEntry(envelope,) {
    return [
      envelope.envelopeId,
      [...new Set(envelope.issueIds
        .flatMap(function toQuotes(issueId,): readonly string[] {
        return quotesByIssue.get(issueId,) ?? [];
      },),),].filter(function isUsable(quote,): boolean {
        return quote !== '';
      },),
    ] as const;
  },),);
}

//endregion Licensed quotes
