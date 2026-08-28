import type { ChunkPair, } from '../chunk-document.ts';
import { splitFrontMatter, } from '../front-matter.ts';
import { validateFrontMatterTranslation, } from '../front-matter-translation.ts';

//region Front matter publication completeness
// Final page must retain parseable metadata under explicit reviewed slice.

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
   * @param reason - structural evidence absent or invalid
   */
  public constructor(
    {
      entryId,
      reason,
    }: {
      readonly entryId: string;
      readonly reason: 'missing-slice' | 'presence-mismatch' | 'invalid-page' | 'incumbent-fallback';
    },
  ) {
    super(`entry ${entryId} front matter is not publishable (${reason})`,);
    this.name = 'FrontMatterCompletenessError';
  }
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
 * @throws FrontMatterCompletenessError when metadata presence, role, or syntax differs
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
  if (sourcePresent !== archivePresent) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'presence-mismatch',
    },);
  }
  /**
   * Parsed assembled page.
   */
  const page = splitFrontMatter({ text: pageText, });
  if (!sourcePresent) {
    if (page.frontMatter !== undefined) {
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

  if ((page.frontMatter === undefined)
    || (archive.frontMatter === undefined)
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
   * Exact archive metadata bytes preparation must have reviewed.
   */
  const { raw: archiveFrontMatter, } = archive.frontMatter;
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
  const misplaced = (targetSlice.sliceIndex !== 0)
    || (sourceSlice.startOffset !== 0)
    || (targetSlice.startOffset !== 0)
    || (sourceSlice.endOffset !== sourceFrontMatter.length)
    || (targetSlice.endOffset !== archiveFrontMatter.length)
    || (sourceSlice.text !== sourceFrontMatter)
    || (targetSlice.text !== archiveFrontMatter);
  if (misplaced) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'missing-slice',
    },);
  }

  /**
   * Exact page metadata bytes.
   */
  const { raw: pageFrontMatter, } = page.frontMatter;
  /**
   * Structural validation before persistence.
   */
  const validation = validateFrontMatterTranslation({
    pageText: archiveFrontMatter,
    candidateText: pageFrontMatter,
  },);
  if (validation.kind !== 'valid') {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'invalid-page',
    },);
  }
  if ((sourceFrontMatter !== archiveFrontMatter) && (pageFrontMatter === archiveFrontMatter)) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'incumbent-fallback',
    },);
  }
}

//endregion Front matter publication completeness
