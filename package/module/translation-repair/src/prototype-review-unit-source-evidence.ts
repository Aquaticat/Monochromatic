// PROTOTYPE ONLY: Candidate K readable source evidence catalog.

import { hashContent, } from './document-node.ts';
import type { ReviewUnitSourceEvidence, } from './prototype-review-unit-plan-model.ts';
import type { RealizationSourceSpan, } from './prototype-realization-model.ts';

/**
 * Canonical span identity independent of readable text.
 *
 * @param span - source or archive range
 *
 * @returns Canonical span identity
 */
function spanKey(span: RealizationSourceSpan,): string {
  return JSON.stringify({
    namespace: span.namespace,
    startOffset: span.startOffset,
    endOffset: span.endOffset,
    digest: span.digest,
  },);
}

/**
 * Selects source namespace text for one canonical span.
 *
 * @returns Complete namespace text
 */
function namespaceText({
  span,
  sourceBody,
  archiveBody,
}: {
  readonly span: RealizationSourceSpan;
  readonly sourceBody: string;
  readonly archiveBody: string;
}): string {
  return span.namespace === 'source-body' ? sourceBody : archiveBody;
}

/**
 * Builds readable source evidence and refuses stale range or digest.
 *
 * @returns Span with exact readable text
 */
function readableEvidence({
  span,
  sourceBody,
  archiveBody,
}: {
  readonly span: RealizationSourceSpan;
  readonly sourceBody: string;
  readonly archiveBody: string;
}): ReviewUnitSourceEvidence {
  /**
   * Namespace text selected before slicing.
   */
  const text = namespaceText({
    span,
    sourceBody,
    archiveBody,
  });
  /**
   * Exact half-open source substring.
   */
  const excerpt = text.slice(
    span.startOffset,
    span.endOffset,
  );
  if ((span.startOffset < 0)
    || (span.endOffset <= span.startOffset)
    || (span.endOffset > text.length)
    || (hashContent({ content: excerpt, }) !== span.digest))
    throw new Error('review unit readable source evidence differs');
  return {
    ...span,
    text: excerpt,
  };
}

/**
 * Compiles first-occurrence readable evidence catalog.
 *
 * @returns Canonical evidence rows
 *
 * @example
 * ```ts
 * const evidence = createReviewUnitSourceEvidence({ spans, sourceBody, archiveBody, });
 * ```
 */
export function createReviewUnitSourceEvidence({
  spans,
  sourceBody,
  archiveBody,
}: {
  readonly spans: readonly RealizationSourceSpan[];
  readonly sourceBody: string;
  readonly archiveBody: string;
}): readonly ReviewUnitSourceEvidence[] {
  /**
   * Span identities aligned with input order.
   */
  const keys = spans.map(spanKey,);
  return spans
    .filter(function first(
      span,
      index,
    ) {
      return keys.indexOf(spanKey(span,),) === index;
    },)
    .map(function readable(span,) {
      return readableEvidence({
        span,
        sourceBody,
        archiveBody,
      });
    },);
}

/**
 * Finds canonical readable evidence position for span.
 *
 * @returns Existing evidence index
 *
 * @example
 * ```ts
 * const index = reviewUnitEvidenceIndex({ span, sourceEvidence, });
 * ```
 */
export function reviewUnitEvidenceIndex({
  span,
  sourceEvidence,
}: {
  readonly span: RealizationSourceSpan;
  readonly sourceEvidence: readonly ReviewUnitSourceEvidence[];
}): number {
  /**
   * Canonical span identity sought in catalog.
   */
  const key = spanKey(span,);
  /**
   * Matching catalog position.
   */
  const index = sourceEvidence.findIndex(function matching(value,) {
    return spanKey(value,) === key;
  },);
  if (index === (-1))
    throw new Error('review unit source evidence position is absent');
  return index;
}
