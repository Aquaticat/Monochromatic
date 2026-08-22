import type { LaneChoice, } from './lane-contest-wire.ts';

//region Consolidate standing text
// WHAT WOULD SHIP TODAY at one contested slice, which is what a consolidation
// has to beat and what ships whenever it does not.

/**
 * Names the rendering a contested slice would ship without this stage.
 *
 * A DECLINED CONTEST LEAVES NOTHING STANDING, and this returns the empty string
 * rather than inventing a side. Picking either lane on a decline would make the
 * consolidation's slate carry a candidate no panel chose, and the deciding half
 * treats an absent standing text as its own terminal state precisely so that
 * case stays visible.
 *
 * @param choice - what the lane contest settled
 *
 * @param repairText - what the repair lane would ship
 *
 * @param translateText - what the translate lane would ship
 *
 * @returns Wording in place, empty where the contest declined
 *
 * @example
 * ```ts
 * const standing = standingTextFor({ choice: 'repair', repairText, translateText, },);
 * ```
 */
export function standingTextFor(
  {
    choice,
    repairText,
    translateText,
  }: {
    readonly choice: LaneChoice;
    readonly repairText: string;
    readonly translateText: string;
  },
): string {
  if (choice === 'repair')
    return repairText;
  if (choice === 'translate')
    return translateText;
  return '';
}

//endregion Consolidate standing text
