import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type {
  IssueCategory,
  IssueSeverity,
} from './issue-taxonomy.ts';

//region Sample grading model
// The milestone-three headline gate is precision of accepted issues on a
// human-graded sample, because a judge ensemble drawn from the same seven
// models re-affirming its own panel's acceptances is circular. The draw is
// stratified by page-size band: the accumulation pool skews small, so a plain
// uniform draw would under-represent the heavily-sliced large tail, exactly
// where the lockstep slicing fix most affects precision. This module owns the
// corpus-free model -- size-band cuts, the grading candidate, and flattening
// one accepted issue into a candidate. The seeded draw lives in
// `sample-draw.ts` and the sheet rendering in `grading-sheet.ts`; the
// corpus-reading wiring lives in the corpus-run script, since sheet content
// quotes UNLICENSED corpus text and must never be committed.

/**
 * Exclusive upper byte bound of the small band: a page whose zh source is
 * under this many UTF-8 bytes is small. The value is the corpus source-byte
 * lower tertile the accumulation loop already sorts by, so sample bands match
 * accumulation bands exactly.
 */
export const SMALL_BAND_MAX_BYTES = 1_843;

/**
 * Exclusive upper byte bound of the medium band: a page at or above
 * {@link SMALL_BAND_MAX_BYTES} yet under this many UTF-8 bytes is medium, and
 * at or above it the page is large. The value is the corpus source-byte upper
 * tertile.
 */
export const MEDIUM_BAND_MAX_BYTES = 3_686;

/**
 * Default headline-sample size; the user accepted 50 when scoping milestone
 * three.
 */
export const DEFAULT_SAMPLE_SIZE = 50;

/**
 * Default precision bar the graded sample must clear; the user accepted 0.9
 * when scoping milestone three.
 */
export const DEFAULT_PRECISION_BAR = 0.9;

/**
 * Default draw seed. Fixing it makes the draw deterministic: the same
 * candidate pool and seed always produce the same sample, so a draw can be
 * reproduced and audited.
 */
export const DEFAULT_SAMPLE_SEED = 'milestone-three-precision';

/**
 * One of the three page-size bands the corpus stratifies into.
 */
export type SizeBand = 'small' | 'medium' | 'large';

/**
 * Bands in presentation order, smallest first.
 */
export const SIZE_BANDS: readonly SizeBand[] = [
  'small',
  'medium',
  'large',
];

/**
 * A per-band count: candidates available, or slots allocated.
 */
export type BandQuota = Readonly<Record<SizeBand, number>>;

/**
 * One accepted issue flattened into everything a human grader needs to judge
 * whether it is a real defect, and everything the draw needs to stratify.
 *
 * @example
 * ```ts
 * const candidate: GradingCandidate = {
 *   entryId: 'MushroomGuuuu',
 *   band: 'medium',
 *   issueId: 'adjudicated/abcd',
 *   category: 'accuracy/omission',
 *   severity: 'minor',
 *   summary: 'The closing greeting is dropped.',
 *   sourceQuotes: ['再见'],
 *   targetQuotes: [],
 * };
 * ```
 */
export type GradingCandidate = {
  /**
   * Corpus entry the issue was found in.
   */
  readonly entryId: string;

  /**
   * Size band of the entry, for stratification.
   */
  readonly band: SizeBand;

  /**
   * Deterministic adjudicated-issue identity, also the draw's shuffle key.
   */
  readonly issueId: string;

  /**
   * Category of the issue's primary claim.
   */
  readonly category: IssueCategory;

  /**
   * Adjudicated severity of the issue.
   */
  readonly severity: IssueSeverity;

  /**
   * One-sentence statement of the primary claimed defect.
   */
  readonly summary: string;

  /**
   * Distinct zh source quotes the issue anchors, in first-seen order.
   */
  readonly sourceQuotes: readonly string[];

  /**
   * Distinct en target quotes the issue anchors, in first-seen order.
   */
  readonly targetQuotes: readonly string[];
};

/**
 * Classifies a page into its size band by zh source byte length, using the
 * same tertile cuts the accumulation loop sorts by.
 *
 * @param sourceBytes - UTF-8 byte length of the entry's zh source
 *
 * @returns The entry's size band
 *
 * @example
 * ```ts
 * const band = classifyBand({ sourceBytes: 1_934, },); // 'medium'
 * ```
 */
export function classifyBand(
  { sourceBytes, }: { readonly sourceBytes: number; },
): SizeBand {
  if (sourceBytes < SMALL_BAND_MAX_BYTES)
    return 'small';
  if (sourceBytes < MEDIUM_BAND_MAX_BYTES)
    return 'medium';
  return 'large';
}

/**
 * Distinct non-empty span quotes on one side of an adjudicated issue, in
 * first-seen order. A `Set` collapses the repeats a multi-claim issue anchors
 * onto the same text while preserving insertion order.
 *
 * @param issue - the adjudicated issue whose spans are gathered
 *
 * @param side - which document side to keep quotes from
 *
 * @returns Distinct quotes for that side
 */
function sideQuotes(
  {
    issue,
    side,
  }: {
    readonly issue: AdjudicatedIssue;
    readonly side: 'source' | 'target';
  },
): readonly string[] {
  return [
    ...new Set(
      issue.claims
        .flatMap(function claimSpans(member,) {
          return member.claim
            .spans
            .filter(function onSide(span,) {
              return span.side === side;
            },)
            .map(function toQuote(span,) {
              return span.quotedText;
            },);
        },)
        .filter(function nonEmpty(quote,) {
          return quote.length > 0;
        },),
    ),
  ];
}

/**
 * Flattens one adjudicated issue into a grading candidate. Primary category,
 * severity and summary come from the issue's first member claim in document
 * order; source and target quotes gather across every member claim.
 *
 * @param issue - the accepted adjudicated issue
 *
 * @param entryId - corpus entry the issue was found in
 *
 * @param band - size band of that entry
 *
 * @returns The flattened grading candidate
 *
 * @example
 * ```ts
 * const candidate = extractGradingCandidate({
 *   issue,
 *   entryId: 'MushroomGuuuu',
 *   band: 'medium',
 * },);
 * ```
 */
export function extractGradingCandidate(
  {
    issue,
    entryId,
    band,
  }: {
    readonly issue: AdjudicatedIssue;
    readonly entryId: string;
    readonly band: SizeBand;
  },
): GradingCandidate {
  /**
   * First member claim in document order, carrying the headline category and
   * summary a grader reads first; `at` keeps the empty-claims narrowing the
   * fallbacks below rely on.
   */
  const primary = issue.claims
    .at(0,);

  return {
    entryId,
    band,
    issueId: issue.issueId,
    category: primary?.claim
      .category
      ?? 'extension/alignment-error',
    severity: issue.severity,
    summary: primary?.claim
      .summary
      ?? '(no claim summary)',
    sourceQuotes: sideQuotes({
      issue,
      side: 'source',
    },),
    targetQuotes: sideQuotes({
      issue,
      side: 'target',
    },),
  };
}

//endregion Sample grading model
