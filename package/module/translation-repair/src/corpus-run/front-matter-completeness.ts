import type { ChunkPair, } from '../chunk-document.ts';
import { isInsertionChunk, } from '../chunk-placement.ts';
import {
  type FrontMatterBlock,
  splitFrontMatter,
} from '../front-matter.ts';
import { validateFrontMatterTranslation, } from '../front-matter-translation.ts';
import type { LaneSliceText, } from '../lane-slice-text.ts';

//region Front matter publication completeness
// Final page must retain parseable metadata under explicit reviewed slice.
//
// A KEPT INCUMBENT IS NOT A FALLBACK WHEN A LANE DECIDED TO KEEP IT. Until
// 2026-09-02 this guard read "page metadata equals archive metadata while the
// source's differs" as nobody having reviewed the slice, and refused the page.
// The Carena0442 pass of that day ran 94 minutes to a finished consolidation,
// the translate lane judged its metadata slice twice and kept the archive's
// already-correct English (`name: Carena` against the source's `飞猫`), and the
// page was refused with every slice of body work behind it. The lane vocabulary
// in `lane-slice-text.ts` already tells a decision from a default since
// 2026-08-16; this guard now reads it rather than inferring the default from
// bytes, and keeps the one case bytes alone did catch: an archive whose visible
// name is still the directory id, which a kept incumbent leaves untranslated.

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
   * when the archive's metadata stands because no lane settled the slice,
   * `directory-id-name` when it stands with the directory id as its visible name
   */
  public constructor(
    {
      entryId,
      reason,
    }: {
      readonly entryId: string;
      readonly reason: 'missing-slice' | 'invalid-page' | 'incumbent-fallback' | 'directory-id-name';
    },
  ) {
    super(`entry ${entryId} front matter is not publishable (${reason})`,);
    this.name = 'FrontMatterCompletenessError';
  }
}

/**
 * How the page's metadata came to carry what it carries.
 *
 * @example
 * ```ts
 * const standing: MetadataStanding = 'decided';
 * ```
 */
export type MetadataStanding =
  /**
   * A lane examined the metadata slice and settled its wording, the archive's
   * own wording included when the judges kept it.
   */
  | 'decided'
  /**
   * No lane settled it: the archive's metadata stands because nobody produced
   * anything, which is what a lost voice looks like.
   */
  | 'by-default';

/**
 * Reads how the metadata slice's wording came to stand, off the lane that
 * renders every slice afresh.
 *
 * THE TRANSLATE LANE, because it is the lane that renders metadata: the repair
 * lane mends body English and records nothing it chose about the front matter.
 * A metadata slice the preparation never produced reads as `by-default`, and
 * the structural check refuses such a page on its own.
 *
 * @param slices - preparation carrying explicit syntax role
 *
 * @param sliceTexts - translate lane's per-slice wordings, outcomes named
 *
 * @returns Whether a lane decided the metadata slice or the archive stands by
 * default
 *
 * @example
 * ```ts
 * const standing = metadataStandingOf({ slices, sliceTexts: artifact.lanes.translate.result.sliceTexts, },);
 * ```
 */
export function metadataStandingOf(
  {
    slices,
    sliceTexts,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sliceTexts: readonly LaneSliceText[];
  },
): MetadataStanding {
  /**
   * Metadata slice, when the preparation produced one.
   */
  const metadataSlice = slices.find(function isFrontMatter(slice,): boolean {
    return slice.syntax === 'front-matter';
  },);
  if (metadataSlice === undefined)
    return 'by-default';

  /**
   * Global index of the metadata slice, which the lane names its wording by.
   */
  const metadataIndex = metadataSlice.source
    .sliceIndex;

  /**
   * What the translate lane did about that slice.
   */
  const wording = sliceTexts.find(function namesIt(candidate,): boolean {
    return candidate.sliceIndex === metadataIndex;
  },);
  if (wording === undefined)
    return 'by-default';

  /**
   * The lane's outcome there.
   */
  const { outcome, } = wording;
  return (outcome.kind === 'decided') ? 'decided' : 'by-default';
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
 * @param metadataStanding - whether a lane decided the metadata slice or the
 * archive's metadata stands by default, read by {@link metadataStandingOf}
 *
 * @throws FrontMatterCompletenessError when metadata role or syntax differs,
 * when the archive's metadata stands by default where the source's differs, or
 * when it stands with the directory id as the visible name
 *
 * @example
 * ```ts
 * assertFrontMatterComplete({ entryId, sourceText, archiveText, pageText, slices, metadataStanding: 'decided', });
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
  // THE ARCHIVE'S OWN METADATA STANDING is refused only where nobody decided
  // it, or where what stands still names the directory id. A lane that judged
  // the slice and kept a correct translation has reviewed it, and bytes equal to
  // the archive's cannot tell that apart from a lost voice; the standing can.
  if ((archiveMetadata === undefined)
    || (sourceFrontMatter === archiveFrontMatter)
    || (pageFrontMatter !== archiveFrontMatter))
    return;
  if (metadataStanding === 'by-default') {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'incumbent-fallback',
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
