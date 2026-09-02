import type { ChunkPair, } from '../chunk-document.ts';
import { isInsertionChunk, } from '../chunk-placement.ts';
import {
  type FrontMatterBlock,
  splitFrontMatter,
} from '../front-matter.ts';
import { validateFrontMatterTranslation, } from '../front-matter-translation.ts';
import {
  fallbackDetailOf,
  isReviewedKeep,
  type MetadataStanding,
} from './front-matter-standing.ts';

//region Front matter publication completeness
// Final page must retain parseable metadata under explicit reviewed slice.
//
// A KEPT INCUMBENT IS EVIDENCE ONLY WHEN A PANEL CHOSE IT. Until 2026-09-02
// this guard read "page metadata equals archive metadata while the source's
// differs" as nobody having reviewed the slice, and refused the page. The
// Carena0442 pass of that day ran 94 minutes to a finished consolidation and
// was refused on that reading, and the first fix (commit 503ec902c) published
// any keep whose stage had heard a translator. That was a misreading of the
// same log: both of Carena's metadata rounds ended `declined-indecision`, four
// judges of eight split 1.5 to 1 to 0.5 and the leader fell short of the
// minimum weight, so the incumbent shipped by fallback, not by judgment. The
// same night the Toka_ls relaunch showed the other half: its translate lane
// replaced the metadata by a judged vote and the consolidation gate restored
// the archive's six ballots to two, which the translate lane's record alone
// reads as a withdrawn replacement. `front-matter-standing.ts` now reads the
// stage that shipped the text, in the order the assembly walks them: a keep
// publishes when a panel chose it or every heard translator reproduced it,
// every fallback refuses by the name of its decision, and an archive whose
// visible name is still the directory id refuses whatever the decision was.

/**
 * Refusal when published front matter lacks structural review evidence.
 *
 * @example
 * ```ts
 * throw new FrontMatterCompletenessError({ entryId: 'Cat', reason: 'missing-slice', });
 * ```
 */
export class FrontMatterCompletenessError extends Error {
  /**
   * Message names entry and structural reason only.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Builds refusal.
   *
   * @param entryId - entry refused
   *
   * @param reason - structural evidence absent or invalid: `incumbent-fallback`
   * when the archive's metadata stands without a panel having chosen it,
   * `directory-id-name` when it stands with the directory id as its visible name
   *
   * @param detail - which decision left the incumbent standing, named after the
   * reason so the TALLY line tells an indecision from a lost voice
   */
  public constructor(
    {
      entryId,
      reason,
      detail,
    }: {
      readonly entryId: string;
      readonly reason: 'missing-slice' | 'invalid-page' | 'incumbent-fallback' | 'directory-id-name';
      readonly detail?: string;
    },
  ) {
    super(
      `entry ${entryId} front matter is not publishable (${reason}${
        (detail === undefined) ? '' : `: ${detail}`
      })`,
    );
    this.name = 'FrontMatterCompletenessError';
  }
}

/**
 * Whether metadata still shows the directory id where a person's name goes.
 *
 * @param metadata - parsed front matter block
 *
 * @param entryId - directory id of the entry
 *
 * @returns Whether the visible name is the directory id
 *
 * @example
 * ```ts
 * namesDirectoryId({ metadata, entryId: 'Cat', },);
 * ```
 */
function namesDirectoryId(
  {
    metadata,
    entryId,
  }: {
    readonly metadata: FrontMatterBlock;
    readonly entryId: string;
  },
): boolean {
  /**
   * Parsed YAML, unknown until proven a record with a name.
   */
  const { data, } = metadata;
  if (((typeof data) !== 'object') || (data === null))
    return false;
  if (!('name' in data))
    return false;
  return (data as { readonly name: unknown; }).name === entryId;
}

/**
 * Refuses page whose metadata was not structurally reviewed.
 *
 * @param entryId - entry being published
 *
 * @param sourceText - complete original page
 *
 * @param archiveText - complete archive page before lane changes
 *
 * @param pageText - assembled page candidate
 *
 * @param slices - preparation carrying explicit syntax role
 *
 * @param metadataStanding - how the metadata slice came to stand, read by
 * `metadataStandingOf` off the stage that shipped it
 *
 * @throws FrontMatterCompletenessError when metadata role or syntax differs,
 * when the archive's metadata stands where the source's differs without a
 * panel or every heard translator having chosen it, or when it stands with
 * the directory id as the visible name
 *
 * @example
 * ```ts
 * assertFrontMatterComplete({ entryId, sourceText, archiveText, pageText, slices, metadataStanding, });
 * ```
 */
export function assertFrontMatterComplete(
  {
    entryId,
    sourceText,
    archiveText,
    pageText,
    slices,
    metadataStanding,
  }: {
    readonly entryId: string;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly pageText: string;
    readonly slices: readonly ChunkPair[];
    readonly metadataStanding: MetadataStanding;
  },
): void {
  /**
   * Parsed source page.
   */
  const source = splitFrontMatter({ text: sourceText, });
  /**
   * Parsed archive page.
   */
  const archive = splitFrontMatter({ text: archiveText, });
  /**
   * Presence of source metadata.
   */
  const sourcePresent = source.frontMatter !== undefined;
  /**
   * Presence of archive metadata.
   */
  const archivePresent = archive.frontMatter !== undefined;
  /**
   * Parsed assembled page.
   */
  const page = splitFrontMatter({ text: pageText, });
  /**
   * Archive metadata when target declares it.
   */
  const { frontMatter: archiveMetadata, } = archive;
  /**
   * Assembled metadata when final page declares it.
   */
  const { frontMatter: pageMetadata, } = page;
  if (!sourcePresent) {
    if (!archivePresent) {
      if (pageMetadata !== undefined) {
        throw new FrontMatterCompletenessError({
          entryId,
          reason: 'invalid-page',
        },);
      }
      return;
    }
    if ((pageMetadata === undefined)
      || (archiveMetadata === undefined)
      || (pageMetadata.raw !== archiveMetadata.raw)) {
      throw new FrontMatterCompletenessError({
        entryId,
        reason: 'invalid-page',
      },);
    }
    return;
  }

  /**
   * Metadata slices, which must be exactly slice zero.
   */
  const metadataSlices = slices.filter(function isFrontMatter(slice,): boolean {
    return slice.syntax === 'front-matter';
  },);
  /**
   * Sole metadata slice when count is valid.
   */
  const [metadataSlice,] = metadataSlices;
  if ((metadataSlices.length !== 1) || (metadataSlice === undefined)) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'missing-slice',
    },);
  }

  if ((pageMetadata === undefined)
    || (source.frontMatter === undefined)) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'invalid-page',
    },);
  }

  /**
   * Exact source metadata bytes preparation must have reviewed.
   */
  const { raw: sourceFrontMatter, } = source.frontMatter;
  /**
   * Exact archive metadata bytes preparation reviewed,
   * empty for source-only insertion.
   */
  const archiveFrontMatter = archiveMetadata?.raw ?? '';
  /**
   * Source span metadata slice claims.
   */
  const { source: sourceSlice, } = metadataSlice;
  /**
   * Target span metadata slice claims.
   */
  const { target: targetSlice, } = metadataSlice;
  /**
   * Whether explicit role points anywhere but exact metadata spans.
   */
  const misplaced = (slices.at(0,) !== metadataSlice)
    || (sourceSlice.sliceIndex !== 0)
    || (targetSlice.sliceIndex !== 0)
    || (sourceSlice.startOffset !== 0)
    || (targetSlice.startOffset !== 0)
    || (sourceSlice.endOffset !== sourceFrontMatter.length)
    || (targetSlice.endOffset !== archiveFrontMatter.length)
    || (sourceSlice.text !== sourceFrontMatter)
    || (targetSlice.text !== archiveFrontMatter)
    || ((archivePresent) && isInsertionChunk(targetSlice,))
    || ((!archivePresent) && (!isInsertionChunk(targetSlice,)));
  if (misplaced) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'missing-slice',
    },);
  }

  /**
   * Exact page metadata bytes.
   */
  const { raw: pageFrontMatter, } = pageMetadata;
  /**
   * Structural validation before persistence.
   */
  const validation = validateFrontMatterTranslation({
    sourceText: sourceFrontMatter,
    pageText: archiveFrontMatter,
    candidateText: pageFrontMatter,
  },);
  if (validation.kind !== 'valid') {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'invalid-page',
    },);
  }
  // THE ARCHIVE'S OWN METADATA STANDING is refused unless a panel chose it or
  // every heard translator reproduced it, and refused whatever the decision
  // where what stands still names the directory id. Bytes equal to the
  // archive's cannot tell a judged keep from an indecision; the standing can.
  if ((archiveMetadata === undefined)
    || (sourceFrontMatter === archiveFrontMatter)
    || (pageFrontMatter !== archiveFrontMatter))
    return;
  if (!isReviewedKeep({ standing: metadataStanding, },)) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'incumbent-fallback',
      detail: fallbackDetailOf({ standing: metadataStanding, },),
    },);
  }
  if (namesDirectoryId({
    metadata: archiveMetadata,
    entryId,
  },)) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'directory-id-name',
    },);
  }
}

//endregion Front matter publication completeness
