import { archiveContributorNameForms, } from '../contributor-name-authority.ts';
import { findDroppedDeclaredNames, } from '../declared-name-survival.ts';

//region Contributor completeness

/**
 * Failure raised when final page changes target-authoritative contributor name.
 *
 * @example
 * ```ts
 * throw new ContributorCompletenessError({ entryId: 'CatEntry', droppedCount: 1, });
 * ```
 */
export class ContributorCompletenessError extends Error {
  /**
   * Declares message safe to forward because it names entry and count only.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Entry whose contributor authority failed.
   */
  readonly entryId: string;

  /**
   * Number of target contributor forms final page lost.
   */
  readonly droppedCount: number;

  /**
   * @param entryId - entry refused
   *
   * @param droppedCount - target contributor forms final page lost
   */
  public constructor(
    {
      entryId,
      droppedCount,
    }: {
      readonly entryId: string;
      readonly droppedCount: number;
    },
  ) {
    super(`entry ${entryId} changed ${String(droppedCount,)} target-authoritative contributor names`,);
    this.name = 'ContributorCompletenessError';
    this.entryId = entryId;
    this.droppedCount = droppedCount;
  }
}

/**
 * Reports whether two contributor spellings project to same complete identity.
 *
 * Bidirectional survival prevents prefix acceptance: `Snow` survives inside
 * `Snowflake` in one direction, while `Snowflake` does not survive in `Snow`.
 *
 * @param left - one visible contributor form
 *
 * @param right - other visible contributor form
 *
 * @returns Whether forms differ only by supported name separators or markup
 *
 * @example
 * ```ts
 * const same = contributorFormsMatch({ left: 'Snow_Cat', right: 'Snow Cat', });
 * ```
 */
function contributorFormsMatch(
  {
    left,
    right,
  }: {
    readonly left: string;
    readonly right: string;
  },
): boolean {
  /**
   * Left projected identity losses when compared into right.
   */
  const leftDropped = findDroppedDeclaredNames({
    forms: [left,],
    baseText: left,
    candidateText: right,
  },);
  /**
   * Whether left projected identity occurs in right.
   */
  const leftSurvives = leftDropped.length === 0;
  /**
   * Right projected identity losses when compared into left.
   */
  const rightDropped = findDroppedDeclaredNames({
    forms: [right,],
    baseText: right,
    candidateText: left,
  },);
  /**
   * Whether right projected identity occurs in left.
   */
  const rightSurvives = rightDropped.length === 0;
  return leftSurvives && rightSurvives;
}

/**
 * Refuses final page that drops or respells contributor identity established by
 * existing English archive attribution line.
 *
 * @param entryId - corpus entry being published
 *
 * @param archiveText - complete existing English archive page
 *
 * @param pageText - assembled final page
 *
 * @throws {@link ContributorCompletenessError} when target contributor identity changed
 *
 * @example
 * ```ts
 * assertContributorNamesComplete({ entryId: 'CatEntry', archiveText, pageText, });
 * ```
 */
export function assertContributorNamesComplete(
  {
    entryId,
    archiveText,
    pageText,
  }: {
    readonly entryId: string;
    readonly archiveText: string;
    readonly pageText: string;
  },
): void {
  /**
   * Public identity spellings existing English archive establishes.
   */
  const forms = archiveContributorNameForms({ text: archiveText, });
  /**
   * Visible contributor spellings final page carries after reflow.
   */
  const finalForms = archiveContributorNameForms({ text: pageText, });
  /**
   * Established contributor forms final attribution no longer names whole.
   */
  const dropped = forms.filter(function absent(form,): boolean {
    return !finalForms.some(function matches(candidate,): boolean {
      return contributorFormsMatch({
        left: form,
        right: candidate,
      },);
    },);
  },);
  if (dropped.length === 0)
    return;
  throw new ContributorCompletenessError({
    entryId,
    droppedCount: dropped.length,
  },);
}

//endregion Contributor completeness
