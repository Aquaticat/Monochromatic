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
      readonly reason: 'missing-slice' | 'presence-mismatch' | 'invalid-page';
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
  if (!sourcePresent)
    return;

  if (!slices.some(function isFrontMatter(slice,): boolean {
    return slice.syntax === 'front-matter';
  },)) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'missing-slice',
    },);
  }

  /**
   * Candidate front matter alone, split from assembled body.
   */
  const page = splitFrontMatter({ text: pageText, });
  if ((page.frontMatter === undefined) || (archive.frontMatter === undefined)) {
    throw new FrontMatterCompletenessError({
      entryId,
      reason: 'invalid-page',
    },);
  }
  /**
   * Exact page metadata bytes.
   */
  const { raw: pageFrontMatter, } = page.frontMatter;
  /**
   * Exact archive metadata bytes defining expected shape.
   */
  const { raw: archiveFrontMatter, } = archive.frontMatter;
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
}

//endregion Front matter publication completeness
