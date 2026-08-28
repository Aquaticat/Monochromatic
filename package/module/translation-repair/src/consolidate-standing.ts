import type { LaneChoice, } from './lane-contest-wire.ts';

//region Consolidate standing text
// BASELINE A CONSOLIDATION MUST BEAT at one contested slice. Lane winner is
// standing text. When contest chose neither, archive is comparison baseline so
// third rendering can still be judged; final-selection guard separately refuses
// archive itself unless contest endorsed it.

/**
 * Names the rendering a contested slice would ship without this stage.
 *
 * A DECLINED CONTEST LEAVES NO LANE STANDING. Archive remains comparison
 * baseline rather than invented lane choice, allowing third rendering to be
 * judged against current page. Keeping baseline is not approval:
 * `assertFinalSelectionSettled` refuses it unless contest endorsed archive.
 *
 * @param choice - what the lane contest settled
 *
 * @param repairText - what the repair lane would ship
 *
 * @param translateText - what the translate lane would ship
 *
 * @param incumbentText - archive wording available as decline baseline
 *
 * @returns Lane winner or archive baseline
 *
 * @example
 * ```ts
 * const standing = standingTextFor({ choice: 'repair', repairText, translateText, incumbentText, },);
 * ```
 */
export function standingTextFor(
  {
    choice,
    repairText,
    translateText,
    incumbentText,
  }: {
    readonly choice: LaneChoice;
    readonly repairText: string;
    readonly translateText: string;
    readonly incumbentText: string;
  },
): string {
  if (choice === 'repair')
    return repairText;
  if (choice === 'translate')
    return translateText;
  return incumbentText;
}

//endregion Consolidate standing text
