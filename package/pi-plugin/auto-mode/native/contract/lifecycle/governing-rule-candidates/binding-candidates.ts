/**
 Original candidate handles retain exact source intervals and independent heading context. @module
 */
import { createHash } from 'node:crypto';
import type { PolicyHeading } from '../../policy-index-types.ts';
import { retainGoverningHeadings } from './binding-headings.ts';
import type {
  GoverningBindingIndex,
  GoverningCandidateCapture,
  GoverningClause,
  GoverningClauseRetention,
  GoverningRuleProjection,
  GoverningSource,
  RetainedUnclassifiedClause,
} from './binding-types.ts';

//region Source-owned candidate identity retains structure without assigning meaning.
/**
 Retain one opaque handle per original clause and an independent aggregate for referenced headings.

 @param source - original admitted source occurrence

 @param index - original structural intervals and literal codes

 @param referenced - exact contextual heading identities from those intervals

 @returns original source-owned membership and immutable candidate arrays

 @example captureGoverningCandidates({ source, index, referenced });
 */
export function captureGoverningCandidates({
  source,
  index,
  referenced
}: Readonly<{
  source: GoverningSource;
  index: GoverningBindingIndex;
  referenced: ReadonlySet<PolicyHeading>;
}>): GoverningCandidateCapture {
  /**
   Foreign handles cannot retrieve original projections even when their contents match.
   */
  const records = new WeakMap<object, GoverningRuleProjection>();
  /**
   Literal codes remain unique only inside this original indexed source.
   */
  const byCode = new Map<string, Readonly<object>>();
  /**
   Retain offsets beside original handles so sorting cannot confuse contextual aggregates with clauses.
   */
  const clauses: Readonly<{
    handle: Readonly<object>;
    projection: GoverningClause
  }>[] = [];
  /**
   Unclassified diagnostics preserve the original selectable candidate.
   */
  const unclassified: RetainedUnclassifiedClause[] = [];
  /**
   Bind one original interval without inventing authority or semantic qualification.

   @param record - original indexed interval and heading context

   @param classification - literal code or retained unclassified node category

   @returns frozen opaque original candidate handle
   */
  function retain({
    record,
    classification
  }: GoverningClauseRetention): Readonly<object> {
    /**
     Handle identity belongs only to this original source binding.
     */
    const handle = Object.freeze({});
    /**
     Exact source text and UTF-16 offsets remain available for independent interpretation.
     */
    const projection: GoverningClause = Object.freeze({
      sourceOccurrence: source.occurrence,
      sourceSHA256: source.sha256,
      ...classification,
      start: record.start,
      end: record.end,
      text: record.text,
      textSHA256: createHash('sha256')
        .update(record.text)
        .digest('hex'),
      headings: Object.freeze((record.headings ?? []).map(function readHeadingContextText(value) { 
        return value.text; 
      })),
      authorityEstablishedByIndex: false,
      semanticQualification: 'not-established',
    });
    records.set(
      handle,
      projection
    );
    clauses.push({
      handle,
      projection
    });
    return handle;
  }
  for (const record of index.records) {
    /**
     Only literal tagged paragraphs participate in code selection.
     */
    const handle = retain({
      record,
      classification: { code: record.code }
    });
    byCode.set(
      record.code,
      handle
    );
  }
  for (const record of index.unclassified) {
    /**
     Unclassified spans remain independently selectable without being called instructions.
     */
    const candidate = retain({
      record,
      classification: {
        kind: 'unclassified-source-span',
        nodeType: record.type
      }
    });
    unclassified.push(Object.freeze({
      candidate,
      start: record.start,
      end: record.end,
      text: record.text,
      type: record.type
    }));
  }
  /**
   Heading retention may append orphan candidates to the same original clause order.
   */
  const retainedContextualHeadings = retainGoverningHeadings({
    index,
    referenced,
    retain,
    unclassified
  });
  /**
   Aggregate context exists only when original clauses referenced heading occurrences.
   */
  const headingContextCandidate = retainedContextualHeadings.length > 0 ? Object.freeze({}) : undefined;
  if (headingContextCandidate) {
    records.set(
      headingContextCandidate,
      Object.freeze({
      kind: 'source-heading-context',
      sourceOccurrence: source.occurrence,
      sourceSHA256: source.sha256,
      headings: retainedContextualHeadings,
      authorityEstablishedByIndex: false,
      semanticQualification: 'not-established',
    })
    );
  }
  /**
   Tagged candidate order remains the original parser order.
   */
  const candidateHandles = Object.freeze([...byCode.values()]);
  /**
   Original source offsets restore complete tagged, unclassified, and orphan-heading order.
   */
  const orderedClauses = clauses.toSorted(function compareOriginalRecordOffsets(
    left,
    right
  ) { 
    return left.projection
    .start
    - right.projection
    .start; 
  });
  /**
   Public enumeration exposes only original handles, never private sort records.
   */
  const instructionHandles = Object.freeze(orderedClauses.map(function originalClauseHandle(clause) { 
    return clause.handle; 
  }));
  /**
   Diagnostic order follows the same original source intervals.
   */
  const retainedUnclassified = Object.freeze(unclassified.toSorted(function compareSourceSpanOffsets(
    left,
    right
  ) { 
    return left.start - right.start; 
  }));
  return {
    records,
    byCode,
    candidateHandles,
    instructionHandles,
    headingCandidates: Object.freeze(headingContextCandidate ? [headingContextCandidate] : []),
    retainedUnclassified,
    retainedContextualHeadings,
    ...(headingContextCandidate === undefined ? {} : { headingContextCandidate }),
  };
}
//endregion
