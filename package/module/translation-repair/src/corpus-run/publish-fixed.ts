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
 */
const PEOPLE_DIR = 'people';

/**
 * Page file name the corpus gives an entry's English rendering.
 */
const ENGLISH_PAGE_FILE = 'page.en.md';

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
 * A SILENT SLICE CONTRIBUTES EMPTY TEXT, which preserves an archive that says
 * nothing rather than inventing wording for it. Where the archive holds no
 * wording AND the original does, `spliceSlices` refuses this outright: an
 * anchor is where a rendering belongs, so blank text there would leave the
 * passage missing while the run reported it delivered. That refusal is wanted.
 * No slice in any settled artifact on disk is in that state today, 249 of 249
 * carrying archive wording, and it becomes reachable only once one-sided
 * sections are sliced.
 *
 * @param artifact - settled entry, read for what each slice would carry
 *
 * @returns Replacement per slice, in the artifact's own comparison order
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
    .map(function toReplacement(slice,): SliceReplacement {
      /**
       * What this slice would carry, or that it carries nothing.
       */
      const { reading, } = slice;

      return {
        chunkIndex: slice.chunkIndex,
        replacementText: (reading.kind === 'wording') ? reading.text : '',
      };
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
 * @param entryId - person entry being published
 *
 * @param publishDir - root of the mirrored tree
 *
 * @param l - logger, tagged by the caller with this entry
 *
 * @returns Path written
 *
 * @throws {@link UnansweredContestSliceError} when a slice the contest was
 * obliged to decide is named nowhere in it, so no reading can say what ships
 *
 * @example
 * ```ts
 * const path = await publishFixedPage({ artifact, slices, archiveText, entryId, publishDir, l, },);
 * ```
 */
export async function publishFixedPage(
  {
    artifact,
    slices,
    archiveText,
    entryId,
    publishDir,
    l,
  }: {
    readonly artifact: WouldShipSource;
    readonly slices: readonly ChunkPair[];
    readonly archiveText: string;
    readonly entryId: string;
    readonly publishDir: string;
    readonly l: Logger;
  },
): Promise<string> {
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

  /**
   * Where it goes.
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
  return path;
}

//endregion Publishing the settled entries as a corpus tree
