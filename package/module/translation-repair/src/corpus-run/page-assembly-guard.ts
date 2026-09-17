import { guardFootnoteAssembly, } from '../assembly-integrity.ts';
import type { ChunkPair, } from '../chunk-document.ts';
import type { ArtifactPageAssembly, } from './artifact-two-lane-page-assembly.ts';
import { restoreCollidingHeadings, } from './heading-collision-restore.ts';
import { shippableReplacements, } from './publish-fixed.ts';
import type { WouldShipSource, } from './would-ship-text.ts';

//region Page assembly guard
// THE COMPOSED PAGE THROUGH THE SAME GUARD EACH LANE RUNS. What the polish, the
// consolidation and the contest chose per slice is spliced over the archive
// the way the page will be, and the assembly guard trims an orphan definition
// out of a definitions-only slice, withdraws a slice that breaks the footnote
// graph or the parse, and names what it did. The outcome is recorded in the
// artifact (`artifact-two-lane-page-assembly.ts`) rather than acted on here, so
// the page a reader composes from the artifact is the page the guard settled.

/**
 Runs the assembly guard over the page the artifact would ship.
 
 @param artifact - artifact as composed before the guard, carrying no page
 assembly yet
 
 @param slices - preparation defining replacement spans
 
 @param sourceText - the original document, whose headings set how many
 distinct headings the page owes (class forty-five)
 
 @param targetText - archive text the replacement spans address
 
 @returns What the guard trimmed, withdrew and found
 
 @example
 ```ts
 const pageAssembly = guardPageAssembly({ artifact, slices, sourceText, targetText, },);
 ```
 */
export function guardPageAssembly(
  {
    artifact,
    slices,
    sourceText,
    targetText,
  }: {
    readonly artifact: WouldShipSource;
    readonly slices: readonly ChunkPair[];
    readonly sourceText: string;
    readonly targetText: string;
  },
): ArtifactPageAssembly {
  /**
   Archive text of every slice, by index.
   */
  const incumbentBySlice = new Map(slices.map(function toEntry(slice,) {
    return [
      slice.target
        .sliceIndex,
      slice.target
        .text,
    ] as const;
  },),);
  /**
   Replacements the page would write, less any that repeat the archive's own
   wording: a content slice whose archive wording is blank and which ships
   nothing reaches the assembler as an empty write, which is no change.
   */
  const replacements = shippableReplacements({ artifact, },)
    .filter(function changes(replacement,): boolean {
      return replacement.replacementText !== incumbentBySlice.get(replacement.sliceIndex,);
    },);
  /**
   Headings a lane rewrote into another section's, restored to the archive's
   before the footnote guard reads the page (class forty-five).
   */
  const restoration = restoreCollidingHeadings({
    sourceText,
    targetText,
    slices,
    replacements,
  },);
  /**
   The guard's reading of the composed page.
   */
  const guarded = guardFootnoteAssembly({
    targetText,
    slices,
    replacements: restoration.replacements
      .filter(function stillChanges(replacement,): boolean {
        // A restoration that brings a slice back to the archive's exact wording
        // is no change for the assembler; its override row below still says
        // what the page carries.
        return replacement.replacementText !== incumbentBySlice.get(replacement.sliceIndex,);
      },),
  },);
  /**
   Restored slices the footnote guard neither trimmed nor withdrew, which
   ride the same override a trimmed slice does: the page carries this text.
   */
  const restoredOnly = restoration.restored
    .filter(function untouchedByGuard(row,): boolean {
      /**
       Whether the guard already owns this slice's override.
       */
      const trimmedByGuard = guarded.trimmed
        .some(function namesIt(trimmed,): boolean {
          return trimmed.sliceIndex === row.sliceIndex;
        },);
      return (!trimmedByGuard) && (!guarded.revertedChunkIndices
        .includes(row.sliceIndex,));
    },);
  return {
    trimmed: [
      ...guarded.trimmed,
      ...restoredOnly,
    ],
    withdrawn: guarded.revertedChunkIndices,
    findings: [
      ...restoration.findings,
      ...guarded.findings,
    ],
  };
}

//endregion Page assembly guard
