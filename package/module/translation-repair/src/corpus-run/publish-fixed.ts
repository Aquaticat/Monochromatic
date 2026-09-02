//region Publishing the settled entries as a corpus tree

import {
  mkdir,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

import type {
  Logger,
} from '@monochromatic-dev/module-logger/ts';

import type {
  ChunkPair,
} from '../chunk-document.ts';
import {
  type SliceReplacement,
  spliceSlices,
} from '../splice-slices.ts';
import {
  writeFileAtomic,
} from './atomic-write.ts';
import {
  type WouldShipSource,
  wouldShipTextPerSlice,
} from './would-ship-text.ts';
import { assertFrontMatterComplete, } from './front-matter-completeness.ts';
import type { MetadataStanding, } from './front-matter-standing.ts';
import { refusePageThatDisagrees, } from './published-page-check.ts';
import { assertContributorNamesComplete, } from './contributor-completeness.ts';
import { assertDestinationsComplete, } from './destination-completeness.ts';
import {
  type DestinationCheck,
  droppedDestinations,
} from './dropped-destinations.ts';

/**
 * Directory under a runs dir holding the published corpus tree.
 *
 * BESIDE `artifacts/` RATHER THAN ANYWHERE ELSE, which is the property that
 * matters rather than the name. A runs dir lives outside this repository, so a
 * tree written inside one cannot be committed by accident, and the corpus is
 * unlicensed: its wording must never reach git. Rooting the tree here also
 * means a throwaway run produces a throwaway tree, so verification never writes
 * over anything real.
 */
export const FIXED_TREE_DIR = 'fixed';

/**
 * Corpus-relative directory every person entry lives under.
 *
 * EXPORTED SO `verify-published.ts` CAN LIST WHAT A RUN PUBLISHED rather than
 * only compose one path at a time. A verifier that spelled this name itself
 * would report an empty tree as a clean one.
 *
 * @internal
 */
export const PEOPLE_DIR = 'people';

/**
 * Page file name the corpus gives an entry's English rendering.
 *
 * EXPORTED BESIDE {@link PEOPLE_DIR} and for the same reason.
 *
 * @internal
 */
export const ENGLISH_PAGE_FILE = 'page.en.md';

/**
 * Names where one entry's fixed English page is written.
 *
 * MIRRORS THE CORPUS LAYOUT EXACTLY, `people/<id>/page.en.md`, because the
 * owner asked for the corpus's directory structure replicated rather than for
 * a flat pile named by id. A tree shaped this way is a drop-in set: it can be
 * diffed against the corpus directory it mirrors, entry by entry, with nothing
 * to translate between the two layouts first.
 *
 * @param publishDir - root of the tree being written, holding no corpus text itself
 *
 * @param entryId - person entry this page belongs to
 *
 * @returns Absolute path this entry's page is written to
 *
 * @example
 * ```ts
 * const path = fixedPagePath({ publishDir, entryId: 'lintong', },);
 * ```
 */
export function fixedPagePath(
  {
    publishDir,
    entryId,
  }: {
    readonly publishDir: string;
    readonly entryId: string;
  },
): string {
  return join(
    publishDir,
    PEOPLE_DIR,
    entryId,
    ENGLISH_PAGE_FILE,
  );
}

/**
 * Turns one settled entry's per-slice readings into the replacements that
 * assemble its page.
 *
 * A SILENT SLICE CONTRIBUTES EMPTY TEXT AT A CONTENT SPAN AND NOTHING AT ALL AT
 * AN ANCHOR, which are two answers rather than one because silence itself means
 * two things. Over a span the archive already renders, the empty string is what
 * the deciders chose: they agreed the passage carries no wording, and omitting
 * the row would republish the archive underneath that decision and undo it. At
 * an anchor there is no archive wording to republish and none to remove, so the
 * honest contribution is no row at all, leaving `spliceSlices` to pass the gap
 * through exactly as it found it.
 *
 * THE ANCHOR HALF IS WHAT `XIEPT2` COST FOUR HOURS AND FORTY-EIGHT MINUTES TO
 * ESTABLISH. This builder used to hand every silent slice the empty string, and
 * `spliceSlices` refuses blank text at an anchor outright, correctly: an anchor
 * is where a rendering belongs, so writing nothing there would leave the passage
 * missing while the run reported it delivered. That refusal landed in
 * `publishFixedPage`, which runs BEFORE the artifact is written, so an entry
 * whose translate lane had already recorded slice 12 unfilled three and a half
 * hours earlier died at the last step with no artifact and no page kept.
 * `translate-absence.ts` promises the opposite and owns the policy: one refused
 * anchor costs its own slice rather than the entry. The refusal stays; what
 * changes is that a slice deliberately left unfilled no longer presents itself
 * to the splice as a blank rendering.
 *
 * READ OFF `incumbentKind` RATHER THAN OFF AN EMPTY INCUMBENT, per the same
 * file: absence is a mode decided once from the target chunk, and testing the
 * text would conflate an anchor with a content span whose archive wording
 * genuinely is blank.
 *
 * @param artifact - settled entry, read for what each slice would carry
 *
 * @returns Replacement per slice that contributes one, in comparison order
 *
 * @example
 * ```ts
 * const replacements = shippableReplacements({ artifact, },);
 * ```
 */
export function shippableReplacements(
  { artifact, }: { readonly artifact: WouldShipSource; },
): readonly SliceReplacement[] {
  return wouldShipTextPerSlice({ artifact, },)
    .flatMap(function toReplacement(slice,): readonly SliceReplacement[] {
      /**
       * What this slice would carry, or that it carries nothing.
       */
      const { reading, } = slice;

      if (reading.kind === 'wording')
        return [{
          sliceIndex: slice.sliceIndex,
          replacementText: reading.text,
        },];

      // NOTHING SHIPS HERE, and at an anchor nothing is also what the assembler
      // must be told: a row carrying blank text claims a rendering was written
      // where none was, which is the claim the splice exists to refuse.
      if (reading.incumbentKind === 'absent')
        return [];

      return [{
        sliceIndex: slice.sliceIndex,
        replacementText: '',
      },];
    },);
}

/**
 * Writes one settled entry's fixed English page into the mirrored tree.
 *
 * CALLED BEFORE THE ARTIFACT IS WRITTEN, and that ordering is the whole
 * correctness argument rather than a preference. A pass builds its skip set
 * from the artifacts already on disk, so "done" means exactly "an artifact
 * exists". Publishing after the artifact would let a crash between the two
 * leave an entry marked done forever with no page ever written; publishing
 * before it makes "done implies published" true by construction, and a resumed
 * pass skips an entry whose page is already there.
 *
 * BYTE-FAITHFUL, WITH NOTHING APPLIED HERE. The readings arrive wrapped as the
 * stage that settled them left them, so re-wrapping at this site would change
 * text both deciders already approved, which is the defect `#162` closed at the
 * consolidation. Nothing normalizes the trailing newline either: the archive
 * text is preserved byte for byte outside the slices that were replaced.
 *
 * @param artifact - settled entry, read for what each slice would carry
 *
 * @param slices - pairs this entry was prepared into, carrying the spans to write into
 *
 * @param archiveText - whole archive English this entry started from
 *
 * @param sourceText - whole source page, read for the destinations it links to
 *
 * @param entryId - person entry being published
 *
 * @param publishDir - root of the mirrored tree
 *
 * @param metadataStanding - how the metadata slice came to stand (judged keep,
 * matched keep, replacement, fallback), read off the settled translate lane's
 * selections by `metadataStandingOf`
 *
 * @param l - logger, tagged by the caller with this entry
 *
 * @returns Path written, and what the page carries of the source's destinations
 *
 * @throws {@link UnansweredContestSliceError} when a slice the contest was
 * obliged to decide is named nowhere in it, so no reading can say what ships
 *
 * @example
 * ```ts
 * const { path, } = await publishFixedPage({ artifact, slices, archiveText, sourceText, entryId, publishDir, l, },);
 * ```
 */
export async function publishFixedPage(
  {
    artifact,
    slices,
    archiveText,
    sourceText,
    entryId,
    publishDir,
    metadataStanding,
    l,
  }: {
    readonly artifact: WouldShipSource;
    readonly slices: readonly ChunkPair[];
    readonly archiveText: string;
    readonly sourceText: string;
    readonly entryId: string;
    readonly publishDir: string;
    readonly metadataStanding: MetadataStanding;
    readonly l: Logger;
  },
): Promise<{
  readonly path: string;
  readonly destinations: DestinationCheck;
}> {
  /**
   * What each slice contributes, silent slices included.
   */
  const replacements = shippableReplacements({ artifact, },);

  /**
   * This entry's page as the deciders settled it.
   */
  const pageText = spliceSlices({
    targetText: archiveText,
    slices,
    replacements,
  },);

  assertFrontMatterComplete({
    entryId,
    sourceText,
    archiveText,
    pageText,
    slices,
    metadataStanding,
  },);
  assertContributorNamesComplete({
    entryId,
    archiveText,
    pageText,
  },);

  // BEFORE THE WRITE, so a page that disagrees with its artifact publishes
  // nothing rather than landing on disk for a later reader to find. The archive
  // handed in here is the text actually spliced rather than the copy the
  // artifact stores, so the weighing is an equality on every entry instead of
  // reporting an older artifact as unweighable.
  refusePageThatDisagrees({
    artifact,
    archive: {
      kind: 'stored',
      text: archiveText,
    },
    pageText,
    entryId,
  },);

  /**
   * What would-ship page carries of source destinations.
   */
  const destinations = droppedDestinations({
    sourceText,
    pageText,
  },);
  assertDestinationsComplete({
    entryId,
    destinations,
  },);

  /**
   * Where it goes after every completeness invariant passes.
   */
  const path = fixedPagePath({
    publishDir,
    entryId,
  },);
  await mkdir(
    dirname(path,),
    { recursive: true, },
  );
  await writeFileAtomic({
    path,
    text: pageText,
  },);
  l.info(
    `publish: wrote ${String(replacements.length,)} slices into a page of `
      + `${String(pageText.length,)} characters`,
  );
  for (const finding of destinations.findings)
    l.warn(`publish: ${finding}`,);
  return {
    path,
    destinations,
  };
}

//endregion Publishing the settled entries as a corpus tree
