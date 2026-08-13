import type { DocumentNode, } from './document-node.ts';
import type { RepairDocument, } from './parse-document.ts';

//region Refinement eligibility
// Which paragraphs of a repaired slice the naturalness lane may rewrite at all.
//
// This is an ELIGIBILITY FILTER and deliberately not called a verse detector.
// Nothing in the parsed model identifies poetry: an mdast `break`, a soft
// source wrap inside a node's text, and an HTML or MDX `<br>` are three
// different things and none of them means verse. The filter is tuned to admit
// only ordinary single-line prose, which means single-line poetry still passes
// it and correctly wrapped prose is still skipped. That asymmetry is acceptable
// for a filter and would be dishonest for a detector.
//
// Everything here reads the REPAIRED slice, never the original target. Accuracy
// edits shift offsets and can change block structure, so eligibility computed
// against the pre-repair document would be describing text that no longer
// exists.

/**
 * Shortest paragraph worth spending a rewrite on;
 * below this there is not enough prose for naturalness to be the problem.
 */
const MIN_REFINE_CHARS = 120;

/**
 * Longest paragraph the lane will attempt.
 *
 * A cap rather than an optimization: every protected atom in a paragraph has to
 * survive in order, so a very long paragraph multiplies the ways a rewrite can
 * silently drop one while still reading well.
 */
const MAX_REFINE_CHARS = 1_200;

/**
 * Block kind the lane rewrites. Headings, block quotes, code, tables, and
 * lists are excluded by not appearing here rather than by a deny list, so a
 * new block kind is ineligible until someone decides otherwise.
 */
const ELIGIBLE_KIND = 'paragraph';

/**
 * Parse findings that make the tree a LESS faithful account of the bytes.
 *
 * `invisible-line-masked` is deliberately absent, and its absence is the whole
 * point of naming kinds rather than counting them. Blanking a line that showed
 * a reader nothing makes the parse more faithful, not less: it restores the
 * paragraph break the author wrote, which the byte-order mark had welded shut.
 * Treating it as degradation disqualified a slice for having been repaired.
 */
const DEGRADING_FINDINGS: ReadonlySet<string> = new Set([
  'mdx-downgraded',
  'html-comment-skipped',
  'unterminated-html-comment',
],);

/**
 * Markup that can carry a line break or a structural element without a newline
 * appearing in the node text, which is what makes the single-line check alone
 * insufficient.
 */
const MARKUP_MARKERS = [
  '<',
  '>',
  '{',
  '}',
] as const;

/**
 * Why one paragraph was skipped, in scorecard-stable wording.
 *
 * @example
 * ```ts
 * const reason: IneligibleReason = 'multi-line';
 * ```
 */
export type IneligibleReason =
  | 'not-a-paragraph'
  | 'not-body-zone'
  | 'multi-line'
  | 'carries-markup'
  | 'too-short'
  | 'too-long'
  | 'parse-degraded';

/**
 * One paragraph's eligibility verdict.
 *
 * @example
 * ```ts
 * const verdict: ParagraphEligibility = { node, eligible: true, };
 * ```
 */
export type ParagraphEligibility =
  | {
    readonly eligible: true;

    /**
     * Block the lane may rewrite.
     */
    readonly node: DocumentNode;
  }
  | {
    readonly eligible: false;

    /**
     * Block that was skipped.
     */
    readonly node: DocumentNode;

    /**
     * First rule that excluded it, in check order.
     */
    readonly reason: IneligibleReason;
  };

/**
 * Builds a skip verdict, so the rule chain reads as one expression per rule
 * rather than as a reason threaded through an absent value.
 *
 * @param node - block being skipped
 *
 * @param reason - rule that excluded it
 *
 * @returns Skip verdict
 *
 * @example
 * ```ts
 * return skipped({ node, reason: 'too-short', },);
 * ```
 */
function skipped(
  {
    node,
    reason,
  }: {
    readonly node: DocumentNode;
    readonly reason: IneligibleReason;
  },
): ParagraphEligibility {
  return {
    eligible: false,
    node,
    reason,
  };
}

/**
 * Judges one block against every eligibility rule, reporting the first that
 * excluded it.
 *
 * @param node - block under consideration
 *
 * @param degraded - whether parsing this slice reported findings, which makes
 * every block in it ineligible
 *
 * @returns Verdict carrying the excluding rule when there is one
 *
 * @example
 * ```ts
 * const verdict = judgeParagraph({ node, degraded: false, },);
 * ```
 */
function judgeParagraph(
  {
    node,
    degraded,
  }: {
    readonly node: DocumentNode;
    readonly degraded: boolean;
  },
): ParagraphEligibility {
  if (node.kind !== ELIGIBLE_KIND)
    return skipped({
      node,
      reason: 'not-a-paragraph',
    },);
  if (node.zone !== 'body')
    return skipped({
      node,
      reason: 'not-body-zone',
    },);

  // A degraded parse means the mdast this filter reasons about is not a
  // faithful account of the bytes, so no block in the slice is eligible.
  if (degraded)
    return skipped({
      node,
      reason: 'parse-degraded',
    },);
  if (node.text
    .includes('\n',))
    return skipped({
      node,
      reason: 'multi-line',
    },);
  if (MARKUP_MARKERS.some(function present(marker,) {
    return node.text
      .includes(marker,);
  },))
    return skipped({
      node,
      reason: 'carries-markup',
    },);
  if (node.text
    .length
    < MIN_REFINE_CHARS)
    return skipped({
      node,
      reason: 'too-short',
    },);
  if (node.text
    .length
    > MAX_REFINE_CHARS)
    return skipped({
      node,
      reason: 'too-long',
    },);
  return {
    eligible: true,
    node,
  };
}

/**
 * Selects the paragraphs of one repaired slice the naturalness lane may
 * rewrite, keeping every skip with its reason so the lane's yield is
 * explainable rather than merely observed.
 *
 * @param document - REPAIRED slice, parsed after accuracy edits landed
 *
 * @returns Verdict per block in document order
 *
 * @example
 * ```ts
 * const verdicts = selectRefinableParagraphs({ document, },);
 * ```
 */
export function selectRefinableParagraphs(
  {
    document,
  }: {
    readonly document: RepairDocument;
  },
): readonly ParagraphEligibility[] {
  /**
   * Whether the tree is a less faithful account of the bytes than usual, which
   * disqualifies the whole slice rather than the offending block alone: a
   * downgrade to plain markdown or a blanked comment changes how every block
   * was read.
   *
   * Asked of the finding KIND rather than of the count, because not every
   * finding is a loss. See {@link DEGRADING_FINDINGS}.
   */
  const degraded = document.parseFindings
    .some(function isLoss(finding,) {
      return DEGRADING_FINDINGS.has(finding.kind,);
    },);
  return document.nodes
    .map(function toVerdict(node,) {
      return judgeParagraph({
        node,
        degraded,
      },);
    },);
}

//endregion Refinement eligibility
