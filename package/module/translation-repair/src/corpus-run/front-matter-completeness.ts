import type { ChunkPair, } from '../chunk-document.ts';
import { isInsertionChunk, } from '../chunk-placement.ts';
import {
  type FrontMatterBlock,
  splitFrontMatter,
} from '../front-matter.ts';
import { validateFrontMatterTranslation, } from '../front-matter-translation.ts';

//region Front matter publication completeness
// Final page must retain parseable metadata under explicit reviewed slice.
//
// STRUCTURAL CHECKS ONLY, by the owner's decision of 2026-09-02. The rule of
// 2026-08-28 ("review visible front matter", written for #269, archives whose
// metadata was never translated) refused a page whose metadata equalled the
// archive's while the source's differed, reading that as nobody having
// reviewed the slice. Chinese and English metadata always differ, so the
// trigger was a proxy for nothing: it discarded the Carena0442 pass, whose
// judges had split, and would have discarded Toka_ls, whose gate kept the
// archive six ballots to two, and one night of machinery reading which panel
// had chosen the keep (commits daaf0ffa0, 6f70a2085, 1160ebb4c) answered a
// question that only existed because of the proxy. Metadata is judged like
// every other slice by the lanes, the contest and the gate, and the artifact
// keeps their records. What stays here is what is structural: the metadata
// slice sits where the preparation put it, the page parses, the identity and
// attribution rules hold, and the visible name is not the directory id.

/**
 * Refusal when published front matter fails a structural check.
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
   * @param reason - structural check that failed: `missing-slice` when the
   * preparation carries no metadata slice where it must, `invalid-page` when
   * the page's metadata does not parse or breaks the identity or attribution
   * rules, `directory-id-name` when the page's visible name is the directory id
   */
  public constructor(
    {
      entryId,
      reason,
    }: {
      readonly entryId: string;
      readonly reason: 'missing-slice' | 'invalid-page' | 'directory-id-name';
    },
  ) {
    super(`entry ${entryId} front matter is not publishable (${reason})`,);
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
 * Refuses page whose metadata fails a structural check.
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
 * @throws FrontMatterCompletenessError when metadata role or syntax differs,
 * when the page's metadata does not parse or breaks the identity or
 * attribution rules, or when its visible name is still the directory id
 *
 * @example
 * ```ts
 * assertFrontMatterComplete({ entryId, sourceText, archiveText, pageText, slices, });
 * ```
 */
export function assertFrontMatterComplete(
  {
    entryId,
    sourceText,
    archiveText,
    pageText,
    slices,
  }: {
    readonly entryId: string;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly pageText: string;
    readonly slices: readonly ChunkPair[];
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
  // THE PAGE'S OWN VISIBLE NAME, whatever the archive carried and whether or
  // not any lane changed the slice: a person published under the folder name is
  // the one metadata defect bytes alone ever caught, and it stays refused.
  if (namesDirectoryId({
    metadata: pageMetadata,
    entryId,
  },)) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'directory-id-name',
    },);
  }
}

//endregion Front matter publication completeness
