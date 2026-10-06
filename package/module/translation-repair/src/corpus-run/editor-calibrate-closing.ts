import { wordForCount, } from '../count-word.ts';
import type { RosterModelId, } from '../roster-id.ts';
import type { SliceRounds, } from './editor-calibrate-slice.ts';

//region Editor calibrate closing
// THE TWO CLOSING PARAGRAPHS of the editor calibration's report, after both
// standings: how many slices the naturalness lane could reach at all, and what
// shipped with no vote behind it.

/**
 Prints how many slices the naturalness lane could reach at all.

 THE REFINER STANDING'S DENOMINATOR, and it is not the slice count. A
 paragraph under the eligibility floor is never offered to a rewriter, so a
 slice can buy the whole accuracy lane and reach no refiner. Without this an
 empty refiner standing reads as a rewriter roster that answered nothing,
 which is a different and much worse fact.

 @param perSlice - what every slice produced

 @example
 ```ts
 printEditorCalibrateRefineReach({ perSlice, },);
 ```
 */
export function printEditorCalibrateRefineReach(
  { perSlice, }: { readonly perSlice: readonly SliceRounds[]; },
): void {
  /**
   Slices carrying a paragraph the lane was willing to offer a rewriter.
   */
  const asked = perSlice.filter(function eligible(slice,): boolean {
    return slice.refineAsked;
  },);

  console.log(
    `  reached a rewriter on ${String(asked.length,)} of ${String(perSlice.length,)} ${
      wordForCount({
        count: perSlice.length,
        one: 'slice',
        many: 'slices',
      },)
    }; `
      + 'the rest carried no paragraph over the eligibility floor, so no refiner was asked '
      + 'and their silence is not evidence about any model',
  );
}

/**
 Prints what shipped, and how much of it no vote ever touched.

 THE STANDING'S BLIND SPOT, MEASURED. `selectChunkPatch` ships outright when
 every proposal is identical, recording no round because there was nothing to
 choose between. A slice like that repairs and contributes nothing to a
 standing, so without this line a converged run reads as a lane that did no
 work. It was found live: a slice whose panel adjudicated seven issues
 repaired one of them and reported zero editor rounds.

 SHIPPING IS NOT WINNING. Nobody preferred this text to anything, so these
 counts must never be read as a rate against the standing this report prints.

 @param perSlice - what every slice produced

 @example
 ```ts
 printEditorCalibrateShipped({ perSlice, },);
 ```
 */
export function printEditorCalibrateShipped(
  { perSlice, }: { readonly perSlice: readonly SliceRounds[]; },
): void {
  /**
   Slices that shipped a repair without any editor round being judged.
   */
  const unvoted = perSlice.filter(function converged(slice,): boolean {
    return (slice.editor
      .length
      === 0) && (slice.editorShipped
        .length
        > 0);
  },);

  /**
   Slices that shipped a repair at all.
   */
  const shipping = perSlice.filter(function repaired(slice,): boolean {
    return slice.editorShipped
      .length
      > 0;
  },);

  console.log(
    `\nEDITORS SHIPPED on ${String(shipping.length,)} of ${String(perSlice.length,)} ${
      wordForCount({
        count: perSlice.length,
        one: 'slice',
        many: 'slices',
      },)
    }, `
      + `${String(unvoted.length,)} of them with no editor round judged at all`,
  );

  if (shipping.length === 0) {
    console.log('  NOTHING SHIPPED. No slice in this sample carried an accepted issue.',);
    return;
  }

  /**
   How many slices each model wrote shipping text on.
   */
  const credits = new Map<RosterModelId, number>();

  for (const slice of shipping) {
    for (const modelId of slice.editorShipped) {
      credits.set(
        modelId,
        (credits.get(modelId,) ?? 0) + 1,
      );
    }
  }

  for (
    const [modelId, count,] of [...credits.entries(),].toSorted(function byCount(
      left,
      right,
    ): number {
      return right[1] - left[1];
    },)
  ) {
    console.log(
      `  ${modelId}: wrote shipping text on ${String(count,)} of ${String(shipping.length,)} ${
        wordForCount({
          count: shipping.length,
          one: 'slice',
          many: 'slices',
        },)
      }`,
    );
  }

  console.log(
    '  THIS IS NOT A PREFERENCE. A model ships here by writing text that survived, including '
      + 'text every other editor proposed identically, which no judge was ever asked about.',
  );
}

//endregion Editor calibrate closing
