import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { SliceSyntax, } from './chunk-document.ts';
import { describeStandingVerdict, } from './consolidate-ineligible-standing.ts';
import { contestStandingMayShip, } from './consolidate-standing.ts';
import type { ArtifactContestVerdict, } from './corpus-run/artifact-two-lane-contest.ts';
import type { LaneChoice, } from './lane-contest-wire.ts';
import { validateTranslatedSlice, } from './translate-validate.ts';

//region Consolidation standing verdict
// TWO VERDICTS ON ONE TEXT, kept apart on purpose. The deterministic gate says
// whether the standing may ever ship (`standingValid`); the contest says
// whether it has the endorsement to ship unchanged (`standingMayShip`). The
// owner's decision of 2026-09-04 (`translation-repair-ineligible-standing.md`)
// hangs on the first, the single-attempt rule on the second, and the run log
// has to name which one refused: on the luxuanwen3 pass of that day one
// warning covered both, and learning that a link destination the archive had
// rewritten was the cause took opening the slice records.

/**
 * Both verdicts on a slice's standing text.
 */
export type StandingVerdict = {
  /**
   * Whether the standing passes the deterministic publication rules.
   */
  readonly standingValid: boolean;

  /**
   * Whether the standing has prior approval and may ship unchanged.
   */
  readonly standingMayShip: boolean;
};

/**
 * Reads both verdicts on a standing text and logs a refusal by name.
 *
 * @param sourceText - original slice
 *
 * @param standingText - wording in place when consolidation begins
 *
 * @param incumbentText - page text this slice replaces
 *
 * @param syntax - explicit syntax role, absent for ordinary prose
 *
 * @param lineStructured - whether line-structure rule governs this slice
 *
 * @param choice - lane the contest chose
 *
 * @param contestVerdict - how the contest ended
 *
 * @param sliceIndex - prepared position of the slice, for the log line
 *
 * @param l - logger a refusal is written through
 *
 * @returns Deterministic eligibility and contest endorsement
 *
 * @example
 * ```ts
 * const { standingValid, standingMayShip, } = readStandingVerdict({
 *   sourceText, standingText, incumbentText, lineStructured: false, choice, contestVerdict, sliceIndex: 1, l,
 * },);
 * ```
 */
export function readStandingVerdict(
  {
    sourceText,
    standingText,
    incumbentText,
    syntax,
    lineStructured,
    choice,
    contestVerdict,
    sliceIndex,
    l,
  }: {
    readonly sourceText: string;
    readonly standingText: string;
    readonly incumbentText: string;
    readonly syntax?: SliceSyntax;
    readonly lineStructured: boolean;
    readonly choice: LaneChoice;
    readonly contestVerdict: ArtifactContestVerdict;
    readonly sliceIndex: number;
    readonly l: Logger;
  },
): StandingVerdict {
  /**
   * Syntax verdict for standing text, or ordinary prose admission.
   */
  const validation = validateTranslatedSlice({
    sourceText,
    candidateText: standingText,
    pageText: incumbentText,
    ...((syntax === undefined) ? {} : { syntax, }),
    lineStructured,
  },);
  /**
   * Whether standing text itself passes syntax-bearing publication rules.
   */
  const standingValid = validation.kind === 'valid';
  /**
   * Whether this baseline has prior approval and may ship unchanged.
   */
  const standingMayShip = contestStandingMayShip({
    choice,
    verdict: contestVerdict,
    standingValid,
  },);
  if (!standingValid) {
    l.warn(
      `slice ${String(sliceIndex,)}: consolidation standing text fails the deterministic publication rule and is `
        + `withheld from the slate: ${describeStandingVerdict({ validation, },)}`,
    );
  } else if (!standingMayShip) {
    l.warn(
      `slice ${String(sliceIndex,)}: consolidation standing text lacks contest endorsement and remains retryable`,
    );
  }
  return {
    standingValid,
    standingMayShip,
  };
}

//endregion Consolidation standing verdict
