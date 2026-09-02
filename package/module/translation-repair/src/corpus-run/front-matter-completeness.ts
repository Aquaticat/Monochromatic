import type { ChunkPair, } from '../chunk-document.ts';
import { isInsertionChunk, } from '../chunk-placement.ts';
import {
  type FrontMatterBlock,
  splitFrontMatter,
} from '../front-matter.ts';
import { validateFrontMatterTranslation, } from '../front-matter-translation.ts';
import type { SliceSelection, } from '../slice-selection.ts';

//region Front matter publication completeness
// Final page must retain parseable metadata under explicit reviewed slice.
//
// A KEPT INCUMBENT IS EVIDENCE ONLY WHEN THE JUDGES CHOSE IT. Until 2026-09-02
// this guard read "page metadata equals archive metadata while the source's
// differs" as nobody having reviewed the slice, and refused the page. The
// Carena0442 pass of that day ran 94 minutes to a finished consolidation and
// was refused on that reading, and the first fix (commit 503ec902c) published
// any keep whose stage had heard a translator. That was a misreading of the
// same log: both of Carena's metadata rounds ended `declined-indecision`, four
// judges of eight split 1.5 to 1 to 0.5 and the leader fell short of the
// minimum weight, so the incumbent shipped by fallback, not by judgment.
// `translate-stage-result.ts` draws the line this guard now reads: "the
// incumbent shipped" and "the judges chose the incumbent" are different facts,
// and only the second is evidence about the incumbent. A keep publishes when
// the judges chose it or every heard translator reproduced it; every fallback
// refuses by the name of its decision, and an archive whose visible name is
// still the directory id refuses whatever the decision was.

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
   * when the archive's metadata stands without the judges having chosen it,
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
 * How the page's metadata came to carry what it carries, read off the
 * translate lane's own record of the slice.
 *
 * @example
 * ```ts
 * const standing: MetadataStanding = { kind: 'judged-keep', voteWeight: 3, };
 * ```
 */
export type MetadataStanding =
  /**
   * The judges chose the archive's wording over fresh renderings.
   */
  | {
    readonly kind: 'judged-keep';
    readonly voteWeight: number;
  }
  /**
   * Every heard translator reproduced the archive's wording, so the slate
   * collapsed to the incumbent and shipped unjudged; named by who matched it.
   */
  | {
    readonly kind: 'matched-keep';
    readonly matchedBy: readonly string[];
  }
  /**
   * The judges chose a fresh rendering; whether the document carries it is the
   * assembly's business, and a page still carrying the archive's bytes under
   * this standing had its replacement withdrawn.
   */
  | {
    readonly kind: 'replaced';
    readonly shipped: boolean;
  }
  /**
   * The incumbent shipped because nothing decided otherwise: an indecision, a
   * rejection, an empty slate, a lost voice, or a sole incumbent nobody matched.
   */
  | {
    readonly kind: 'fallback';
    readonly decision: string;
  }
  /**
   * No metadata slice, or no record of it: the structural check refuses such a
   * page on its own.
   */
  | { readonly kind: 'unrecorded'; };

/**
 * Reads how the metadata slice's wording came to stand, off the lane that
 * renders every slice afresh.
 *
 * THE TRANSLATE LANE, because it is the lane that renders metadata: the repair
 * lane mends body English and records nothing it chose about the front matter.
 * READ OFF THE SELECTION rather than the lane's wording, because the wording
 * says only whether somebody was heard, and a heard translator whose judges
 * split is not a review of the incumbent.
 *
 * @param slices - preparation carrying explicit syntax role
 *
 * @param sliceSelections - translate lane's per-slice selections, decision and
 * origin named
 *
 * @returns How the metadata slice's wording came to stand
 *
 * @example
 * ```ts
 * const standing = metadataStandingOf({ slices, sliceSelections: artifact.lanes.translate.result.sliceSelections, },);
 * ```
 */
export function metadataStandingOf(
  {
    slices,
    sliceSelections,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sliceSelections: readonly SliceSelection[];
  },
): MetadataStanding {
  /**
   * Metadata slice, when the preparation produced one.
   */
  const metadataSlice = slices.find(function isFrontMatter(slice,): boolean {
    return slice.syntax === 'front-matter';
  },);
  if (metadataSlice === undefined)
    return { kind: 'unrecorded', };

  /**
   * Global index of the metadata slice, which the lane names its record by.
   */
  const metadataIndex = metadataSlice.source
    .sliceIndex;

  /**
   * What the translate lane decided about that slice.
   */
  const selection = sliceSelections.find(function namesIt(candidate,): boolean {
    return candidate.sliceIndex === metadataIndex;
  },);
  if (selection === undefined)
    return { kind: 'unrecorded', };

  /**
   * The decision, who produced the winner and whether it was the archive's.
   */
  const {
    decision,
    origin,
    producer,
    voteWeight,
    shipped,
  } = selection;
  if (origin === 'fresh') {
    return {
      kind: 'replaced',
      shipped,
    };
  }
  if (decision === 'judged') {
    return {
      kind: 'judged-keep',
      voteWeight,
    };
  }
  if (decision === 'sole-candidate') {
    // The incumbent is offered whenever it has text, so a slate of one is
    // either every heard translator reproducing it or nobody proposing at all;
    // the producer's matched list is what tells those apart.
    if (producer.kind === 'incumbent') {
      /**
       * Translators whose proposal was the incumbent's text.
       */
      const { matched, } = producer;
      if (matched.length > 0) {
        return {
          kind: 'matched-keep',
          matchedBy: matched,
        };
      }
    }
    return {
      kind: 'fallback',
      decision: 'sole-candidate-unmatched',
    };
  }
  return {
    kind: 'fallback',
    decision,
  };
}

/**
 * Whether a kept incumbent was chosen by the judges or reproduced by every
 * heard translator, the two standings that are a review of it.
 *
 * @param standing - how the metadata slice came to stand
 *
 * @returns Whether the keep is a review
 *
 * @example
 * ```ts
 * isReviewedKeep({ standing: { kind: 'judged-keep', voteWeight: 3, }, },);
 * ```
 */
function isReviewedKeep(
  { standing, }: { readonly standing: MetadataStanding; },
): boolean {
  return (standing.kind === 'judged-keep')
    || (standing.kind === 'matched-keep');
}

/**
 * Names why a kept incumbent is not a review.
 *
 * @param standing - how the metadata slice came to stand, not a reviewed keep
 *
 * @returns Decision that left the incumbent standing
 *
 * @throws {@link RangeError} on a reviewed keep, which has no fallback to name
 *
 * @example
 * ```ts
 * fallbackDetailOf({ standing: { kind: 'fallback', decision: 'declined-indecision', }, },);
 * ```
 */
function fallbackDetailOf(
  { standing, }: { readonly standing: MetadataStanding; },
): string {
  if (standing.kind === 'fallback')
    return standing.decision;
  if (standing.kind === 'replaced')
    return standing.shipped ? 'replacement-not-carried' : 'replacement-withdrawn';
  if (standing.kind === 'unrecorded')
    return 'unrecorded';
  throw new RangeError(`a ${standing.kind} is a review of the incumbent and names no fallback`,);
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
 * {@link metadataStandingOf}
 *
 * @throws FrontMatterCompletenessError when metadata role or syntax differs,
 * when the archive's metadata stands where the source's differs without the
 * judges or every heard translator having chosen it, or when it stands with
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
  // THE ARCHIVE'S OWN METADATA STANDING is refused unless the judges chose it
  // or every heard translator reproduced it, and refused whatever the decision
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
