import type { SliceSyntax, } from './chunk-document.ts';
import type { LaneContestOutcome, } from './lane-contest-stage.ts';
import { validateTranslatedSlice, } from './translate-validate.ts';

//region Lane contest publication eligibility

/**
 * Reports whether contest winner can cross final publication boundary.
 *
 * ORDINARY PROSE KEEPS ROSTER VERDICT. Front matter is syntax-bearing and has
 * deterministic identity invariants, so a lane that violates them cannot
 * become warm-run terminal evidence merely because enough ballots selected it.
 * A declined contest remains retryable through consolidation and therefore has
 * no selected lane to reject here.
 *
 * @param outcome - contest result whose selected lane is checked
 *
 * @param sourceText - original metadata
 *
 * @param incumbentText - archive metadata defining compatible YAML shape
 *
 * @param repairText - repair lane candidate
 *
 * @param translateText - translate lane candidate
 *
 * @param syntax - explicit syntax role, absent for ordinary prose
 *
 * @returns Whether selected lane is structurally publishable
 *
 * @example
 * ```ts
 * const mayShip = laneContestChoiceMayShip({ outcome, sourceText, incumbentText, repairText, translateText, syntax: 'front-matter', });
 * ```
 */
export function laneContestChoiceMayShip(
  {
    outcome,
    sourceText,
    incumbentText,
    repairText,
    translateText,
    syntax,
  }: {
    readonly outcome: LaneContestOutcome;
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly repairText: string;
    readonly translateText: string;
    readonly syntax?: SliceSyntax;
  },
): boolean {
  if ((syntax === undefined) || (outcome.choice === 'neither'))
    return true;
  /**
   * Wording selected by contest panel.
   */
  const selectedText = (outcome.choice === 'repair')
    ? repairText
    : translateText;
  /**
   * Structural verdict for selected syntax-bearing candidate.
   */
  const validation = validateTranslatedSlice({
    sourceText,
    candidateText: selectedText,
    pageText: incumbentText,
    syntax,
  },);
  return validation.kind === 'valid';
}

//endregion Lane contest publication eligibility
