import type { ConsolidationTerminal, } from './consolidate-settle.ts';
import type { IncumbentKind, } from './translate-absence.ts';
import type { SliceValidation, } from './translate-validate.ts';

//region Ineligible standing text
// A STANDING TEXT THE DETERMINISTIC GATE HAS ALREADY REFUSED may not ship, and
// may not be offered to the judges as something to keep.
//
// THE OWNER'S DECISION OF 2026-09-04, on the luxuanwen3 pass of that day: the
// archive's front matter broke the identity rule in
// `validateFrontMatterTranslation`, the driver logged "standing text fails
// publication eligibility and remains retryable", the slate judges endorsed
// that standing over two valid proposals (three ballots calling the archive's
// shape "the declared translated identity"), the single attempt shipped it
// "with the finding recorded", and `assertFrontMatterComplete` refused the
// whole entry an hour and 2.61 USD later. Asked whether consolidation should
// refuse to ship a standing the gate had rejected, the owner chose: prefer the
// best valid proposal, else fail the slice at once.
//
// PREFERRING THE BEST VALID PROPOSAL IS DONE BY THE JUDGES, not by a tally of
// ballots cast for the incumbent: the incumbent is simply not on the slate.
// `judgeTranslateSlate` already knows an absent incumbent (a passage the
// archive never carried), and with the standing withheld the judges choose
// among the valid proposals or decline, and a decline is the "else".
//
// THIS IS NOT THE NO-LOOP DECISION REOPENED. `consolidate-slice-buy.ts` keeps
// its single attempt for a standing that merely lacks contest ENDORSEMENT;
// that standing has passed the deterministic gate and quality machinery may
// not withhold the entry over it. A standing that has NOT passed the gate was
// never going to ship, and the page guard was going to say so after the run
// had been paid for.

/**
 * Finding recorded on a settlement whose standing was withheld from the slate.
 */
export const INELIGIBLE_STANDING_WITHHELD_FINDING: string = 'ineligible-standing-withheld: the standing text failed the '
  + 'deterministic publication rule, so it was not offered to the slate judges; only valid proposals were';

/**
 * Raised when a slice's standing text has failed the deterministic gate and
 * the settlement still ends with nothing valid to ship.
 */
export class ConsolidationStandingIneligibleError extends Error {
  /**
   * Declares this message safe to forward: it names a slice index and a
   * terminal state, never a passage.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Slice whose settlement ended with nothing shippable.
   */
  readonly sliceIndex: number;

  /**
   * Names the slice and how its settlement ended.
   *
   * @param sliceIndex - prepared position of the slice
   *
   * @param terminal - how the settlement ended, which says whether the slate
   * was empty, declined, or gated back to the standing
   *
   * @param cause - the judges' own refusal, when a decline is what ended it
   *
   * @example
   * ```ts
   * throw new ConsolidationStandingIneligibleError({ sliceIndex: 0, terminal: 'slate-declined-standing', },);
   * ```
   */
  constructor(
    {
      sliceIndex,
      terminal,
      cause,
    }: {
      readonly sliceIndex: number;
      readonly terminal: ConsolidationTerminal;
      readonly cause?: unknown;
    },
  ) {
    super(
      `slice ${String(sliceIndex,)}: the standing text failed the deterministic publication rule and the `
        + `consolidation left nothing valid to ship (${terminal}); the page would be refused at assembly, so the `
        + 'entry stops here',
      // Conditional spread keeps cause absent when none was supplied.
      ...((cause === undefined) ? [] : [{ cause, },]),
    );
    this.name = 'ConsolidationStandingIneligibleError';
    this.sliceIndex = sliceIndex;
  }
}

/**
 * What the slate offers as its incumbent: the standing text when it may
 * ship, nothing when the gate has refused it.
 *
 * @param standingEligible - whether the standing passed the deterministic gate
 *
 * @param standingText - wording in place when the stage began
 *
 * @returns Incumbent text and kind as the slate builder and the judges take them
 *
 * @example
 * ```ts
 * const incumbent = slateIncumbentFor({ standingEligible: false, standingText, },);
 * ```
 */
export function slateIncumbentFor(
  {
    standingEligible,
    standingText,
  }: {
    readonly standingEligible: boolean;
    readonly standingText: string;
  },
): {
  readonly incumbentText: string;
  readonly incumbentKind: IncumbentKind;
} {
  if (standingEligible) {
    return {
      incumbentText: standingText,
      incumbentKind: 'present',
    };
  }
  return {
    incumbentText: '',
    incumbentKind: 'absent',
  };
}

/**
 * Refuses a settlement that would ship an ineligible standing text.
 *
 * ASKED AT EVERY EXIT THAT KEEPS THE STANDING: the empty floor, the judges'
 * decline, and the gate's refusal of the consolidation they chose. A
 * `consolidated` terminal ships fresh wording the floor passed, which is the
 * one outcome the rule allows.
 *
 * @param standingEligible - whether the standing passed the deterministic gate
 *
 * @param terminal - how the settlement is about to end
 *
 * @param sliceIndex - prepared position of the slice, for the error
 *
 * @throws {@link ConsolidationStandingIneligibleError} when the standing is
 * ineligible and the terminal keeps it
 *
 * @example
 * ```ts
 * requireShippableTerminal({ standingEligible, terminal: 'consolidated', sliceIndex, },);
 * ```
 */
export function requireShippableTerminal(
  {
    standingEligible,
    terminal,
    sliceIndex,
  }: {
    readonly standingEligible: boolean;
    readonly terminal: ConsolidationTerminal;
    readonly sliceIndex: number;
  },
): void {
  if (standingEligible || (terminal === 'consolidated'))
    return;
  throw new ConsolidationStandingIneligibleError({
    sliceIndex,
    terminal,
  },);
}

/**
 * One line saying why the deterministic gate refused a standing text, for
 * the run log.
 *
 * WRITTEN FOR THE READING, not the judges: on 2026-09-04 the luxuanwen3 log
 * said only that a standing "fails publication eligibility", and learning
 * that the cause was a link destination the archive had rewritten took
 * opening the slice records. A refusal the log names is a defect class the
 * next reading finds in one grep.
 *
 * @param validation - deterministic verdict on the standing text
 *
 * @returns Findings joined into one line, the reason no comparison was
 * possible, or a word for a pass
 *
 * @example
 * ```ts
 * dl.warn(`slice 1: ${describeStandingVerdict({ validation, },)}`,);
 * ```
 */
export function describeStandingVerdict(
  { validation, }: { readonly validation: SliceValidation; },
): string {
  if (validation.kind === 'valid')
    return 'passes the deterministic publication rule';
  if (validation.kind === 'invalid')
    return validation.findings
      .join(' ',);
  return `no comparison was possible: ${validation.detail}`;
}

//endregion Ineligible standing text
