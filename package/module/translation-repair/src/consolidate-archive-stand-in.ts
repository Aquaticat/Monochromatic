import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import {
  type ArchiveDispute,
  describeArchiveDispute,
} from './archive-dispute.ts';
import type { LaneChoice, } from './lane-contest-wire.ts';

//region Consolidation archive stand-in
// The consolidation's side of class one hundred seven: on a disputed slice
// the repair lane's text is the archive wording every sheet, key and
// standing reads, and where the contest chose neither lane the kept standing
// is that stand-in, which the page must then be written with rather than
// left as the contest found it.

/**
 Archive wording as one consolidation settlement takes it.

 @param archiveDisputes - disputed slices, absent where none were read

 @param sliceIndex - slice being settled

 @param incumbentText - archive's own wording of the slice

 @param choice - what the lane contest settled

 @param l - driver logger

 @returns Wording standing as the archive here, and whether a kept standing
 is the stand-in the page must carry

 @example
 ```ts
 const { incumbentText, standInShips, } = archiveStandInFor({ archiveDisputes, sliceIndex, incumbentText, choice, l, },);
 ```
 */
export function archiveStandInFor(
  {
    archiveDisputes,
    sliceIndex,
    incumbentText,
    choice,
    l,
  }: {
    readonly archiveDisputes?: ReadonlyMap<number, ArchiveDispute>;
    readonly sliceIndex: number;
    readonly incumbentText: string;
    readonly choice: LaneChoice;
    readonly l: Logger;
  },
): {
  readonly incumbentText: string;
  readonly standInShips: boolean;
} {
  /**
   Dispute over this slice's archive rendering, absent for most slices.
   */
  const dispute = archiveDisputes?.get(sliceIndex,);
  if (dispute === undefined) {
    return {
      incumbentText,
      standInShips: false,
    };
  }
  l.info(`${describeArchiveDispute({ dispute, },)}; the stand-in is the consolidation's incumbent`,);
  return {
    incumbentText: dispute.standIn,
    standInShips: choice === 'neither',
  };
}

//endregion Consolidation archive stand-in
