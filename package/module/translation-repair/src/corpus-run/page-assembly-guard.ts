import type { ArchiveOriginalSpan, } from '../archive-original-note.ts';
import { withholdLoneContainerHalves, } from '../assembly-container-halves.ts';
import { guardFootnoteAssembly, } from '../assembly-integrity.ts';
import type { ChunkPair, } from '../chunk-document.ts';
import type { ArtifactPageAssembly, } from './artifact-two-lane-page-assembly.ts';
import { restoreContributorNames, } from './contributor-name-restore.ts';
import { placeHandleGlosses, } from './handle-gloss-place.ts';
import { restoreCollidingHeadings, } from './heading-collision-restore.ts';
import { unifyHeadingSeries, } from './heading-series-unify.ts';
import { restoreArchiveCasing, } from './archive-casing-restore.ts';
import { restoreArchiveNameCasing, } from './archive-name-casing.ts';
import { canadianizePage, } from './canadian-forms.ts';
import { correctPinyinPage, } from './pinyin-tone.ts';
import { restoreJsxAttributes, } from './jsx-attribute-restore.ts';
import { restoreListSpread, } from './list-spread-restore.ts';
import { restoreNameGlossLines, } from './name-gloss-restore.ts';
import { shippableReplacements, } from './publish-fixed.ts';
import type { SliceReplacement, } from '../splice-slices.ts';
import { unifyTitleReferences, } from './title-reference-unify.ts';
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
 
 @param archiveOriginalSpans - spans sealed as the English original, which
 the Canadian forms pass leaves as the archive has them
 
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
    archiveOriginalSpans = [],
  }: {
    readonly artifact: WouldShipSource;
    readonly slices: readonly ChunkPair[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly archiveOriginalSpans?: readonly ArchiveOriginalSpan[];
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
   Replacements less any container half whose partner ships nothing (class
   fifty-seven), so the guard never reads a closing tag with no opening.
   */
  const halves = withholdLoneContainerHalves({
    slices,
    replacements,
  },);
  /**
   Headings a lane rewrote into another section's, restored to the archive's
   before the footnote guard reads the page (class forty-five).
   */
  const restoration = restoreCollidingHeadings({
    sourceText,
    targetText,
    slices,
    replacements: halves.replacements,
  },);
  /**
   Contributor names rendered one way across headings and signatures (class
   sixty-seven).
   */
  const names = restoreContributorNames({
    slices,
    replacements: restoration.replacements,
  },);
  /**
   Every romanised handle's literal meaning at its first appearance alone
   (class eighty-eight).
   */
  const glosses = placeHandleGlosses({
    slices,
    replacements: names.replacements,
  },);
  /**
   The original's numbered heading series rendered in one style (class
   sixty-eight).
   */
  const series = unifyHeadingSeries({
    slices,
    replacements: glosses.replacements,
  },);
  /**
   Every tag attribute at the archive's value (class ninety-nine).
   */
  const attributes = restoreJsxAttributes({
    slices,
    replacements: series.replacements,
  },);
  /**
   Every reference to a section title as the heading renders it (class one
   hundred).
   */
  const titles = unifyTitleReferences({
    slices,
    replacements: attributes.replacements,
  },);
  /**
   The archive's gloss line of a name wherever the shipped text carries the
   name unglossed (class one hundred five).
   */
  const glossLines = restoreNameGlossLines({
    slices,
    replacements: titles.replacements,
  },);
  /**
   Every list at the archive's spacing between its items (class one hundred
   seventeen).
   */
  const lists = restoreListSpread({
    slices,
    replacements: glossLines.replacements,
  },);
  /**
   Every word the archive writes only in capitals at the archive's form
   (class one hundred twenty-one).
   */
  const casing = restoreArchiveCasing({
    slices,
    replacements: lists.replacements,
  },);
  /**
   Every multi-word name the archive writes title case at the archive's form
   (class one hundred thirty-six).
   */
  const nameCasing = restoreArchiveNameCasing({
    slices,
    replacements: casing.replacements,
  },);
  /**
   Every date month first and every listed word in its Canadian spelling, on
   every slice the page carries (class one hundred thirty-four).
   */
  const canadian = canadianizePage({
    slices,
    replacements: nameCasing.replacements,
    archiveOriginalSpans,
  },);
  /**
   Every pinyin syllable of a Han and pinyin pair in its character's tone,
   on every slice the page carries (class one hundred thirty-seven).
   */
  const pinyinTones = correctPinyinPage({
    slices,
    replacements: canadian.replacements,
    archiveOriginalSpans,
  },);
  /**
   Rows the page-assembly passes rewrote, the latest pass's text per slice.
   */
  const restoredRows = new Map<number, SliceReplacement>([
    ...restoration.restored,
    ...names.restored,
    ...glosses.restored,
    ...series.restored,
    ...attributes.restored,
    ...titles.restored,
    ...glossLines.restored,
    ...lists.restored,
    ...casing.restored,
    ...nameCasing.restored,
    ...canadian.restored,
    ...pinyinTones.restored,
  ].map(function bySlice(row,): readonly [
    number,
    SliceReplacement,
  ] {
    return [
      row.sliceIndex,
      row,
    ];
  },),);
  /**
   The guard's reading of the composed page.
   */
  const guarded = guardFootnoteAssembly({
    targetText,
    slices,
    replacements: pinyinTones.replacements
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
  const restoredOnly = [...restoredRows.values(),]
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
    withdrawn: [
      ...halves.withheld,
      ...guarded.revertedChunkIndices,
    ],
    findings: [
      ...halves.findings,
      ...restoration.findings,
      ...names.findings,
      ...glosses.findings,
      ...series.findings,
      ...attributes.findings,
      ...titles.findings,
      ...glossLines.findings,
      ...lists.findings,
      ...casing.findings,
      ...nameCasing.findings,
      ...canadian.findings,
      ...pinyinTones.findings,
      ...guarded.findings,
    ],
  };
}

//endregion Page assembly guard
