import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

//region Issue taxonomy
// MQM-derived error categories plus the extension states this pipeline needs for
// individually unreliable critics: suspected source defects must be able to block
// "corrections" toward corruption, ambiguity must be reportable without asserting a
// defect, and structural mismatches (alignment, footnotes) are first-class findings.
// The `policy` family covers editing-guide rules (sensitive-content softening,
// pronoun conventions, archive-link requirements) that hold even when the guide
// files themselves are absent.

/**
 * Every severity a claim may carry, ordered least to most severe.
 * `neutral` flags findings needing human attention without asserting a defect,
 * which is exactly what interpretive ambiguity and suspected source errors are
 * before adjudication.
 *
 * @example
 * ```ts
 * ISSUE_SEVERITIES.indexOf('major',);
 * ```
 */
export const ISSUE_SEVERITIES = [
  'neutral',
  'minor',
  'major',
  'critical',
] as const;

/**
 * Severity of one issue claim, MQM-style.
 *
 * @example
 * ```ts
 * const severity: IssueSeverity = 'major';
 * ```
 */
export type IssueSeverity = typeof ISSUE_SEVERITIES[number];

/**
 * Closed category vocabulary critics must claim within;
 * schema validation rejects anything outside it, because free-text categories from
 * unreliable models drift and cannot feed the scorecard.
 * Leaf names under `extension/` match the settled architecture verbatim so
 * cross-session references stay greppable.
 *
 * @example
 * ```ts
 * ISSUE_CATEGORIES.includes('accuracy/omission',);
 * ```
 */
export const ISSUE_CATEGORIES = [
  'accuracy/mistranslation',
  'accuracy/omission',
  'accuracy/addition',
  'accuracy/untranslated',
  'fluency/grammar',
  'fluency/spelling',
  'fluency/punctuation',
  'fluency/inconsistency',
  'terminology/inconsistent-rendering',
  'terminology/wrong-term',
  'style/register',
  'style/awkward-phrasing',
  'locale-convention/quotation-marks',
  'locale-convention/date-format',
  'locale-convention/number-format',
  'policy/sensitive-content',
  'policy/pronoun',
  'policy/link-convention',
  'extension/suspected-source-error',
  'extension/interpretive-ambiguity',
  'extension/alignment-error',
  'extension/footnote-conflict',
] as const;

/**
 * One category slug of form `family/leaf`.
 *
 * @example
 * ```ts
 * const category: IssueCategory = 'extension/suspected-source-error';
 * ```
 */
export type IssueCategory = typeof ISSUE_CATEGORIES[number];

/**
 * Family segment derived from category slugs,
 * so families can never drift from the category list they group.
 *
 * @example
 * ```ts
 * const family: IssueCategoryFamily = 'locale-convention';
 * ```
 */
export type IssueCategoryFamily = IssueCategory extends `${infer Family}/${string}`
  ? Family
  : never;

/**
 * Guards untrusted category strings from model JSON before they enter typed claims.
 *
 * @param value - candidate from unvalidated model output
 *
 * @returns Whether value names one listed category
 *
 * @example
 * ```ts
 * isIssueCategory('accuracy/omission',);
 * ```
 */
export function isIssueCategory(value: unknown,): value is IssueCategory {
  if ((typeof value) !== 'string')
    return false;

  return (ISSUE_CATEGORIES as readonly string[]).includes(value,);
}

/**
 * Guards untrusted severity strings from model JSON before they enter typed claims.
 *
 * @param value - candidate from unvalidated model output
 *
 * @returns Whether value names one listed severity
 *
 * @example
 * ```ts
 * isIssueSeverity('critical',);
 * ```
 */
export function isIssueSeverity(value: unknown,): value is IssueSeverity {
  if ((typeof value) !== 'string')
    return false;

  return (ISSUE_SEVERITIES as readonly string[]).includes(value,);
}

/**
 * Every family in category-list first-occurrence order;
 * the annotation pins each entry to the family union derived from category slugs,
 * and a unit test pins completeness in the other direction,
 * so list and slugs can never drift apart.
 * Scorecard buckets and routing tables enumerate families from here.
 *
 * @example
 * ```ts
 * for (const family of ISSUE_CATEGORY_FAMILIES) bucketByFamily(family,);
 * ```
 */
export const ISSUE_CATEGORY_FAMILIES: readonly IssueCategoryFamily[] = [
  'accuracy',
  'fluency',
  'terminology',
  'style',
  'locale-convention',
  'policy',
  'extension',
];

/**
 * Extracts family segment from one category slug,
 * because routing, panel weights, and scorecard buckets operate per family.
 *
 * @param category - slug whose family segment routing needs
 *
 * @returns Family whose slash-terminated prefix opens the slug
 *
 * @example
 * ```ts
 * categoryFamily({ category: 'policy/sensitive-content', },);
 * ```
 */
export function categoryFamily(
  { category, }: { readonly category: IssueCategory; },
): IssueCategoryFamily {
  /**
   * Family opening the slug, present for every member of the closed category union;
   * the trailing slash keeps one family from matching another's prefix.
   */
  const family = ISSUE_CATEGORY_FAMILIES
    .find(function opensSlug(candidate,) {
      return category.startsWith(`${candidate}/`,);
    },);

  return nonNullishOrThrow(family,);
}

//endregion Issue taxonomy
