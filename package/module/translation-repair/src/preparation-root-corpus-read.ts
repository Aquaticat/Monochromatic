import { createHash, } from 'node:crypto';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  isMissingCorpusObject,
  readCorpusBytes,
  type CorpusPin,
} from './corpus-source.ts';
import { hashContent, } from './document-node.ts';
import { foldCarriageReturns, } from './line-endings.ts';
import { PreparationRootError, } from './preparation-root-error.ts';
import type { PreparationRootRawDocument, } from './preparation-root-population-model.ts';

//region Native raw corpus reads retain text-transform provenance

/**
 * One effective text is owned with its raw committed-byte identity.
 *
 * @example
 * ```ts
 * const read: PreparationRootTextRead = { text, identity };
 * ```
 */
export type PreparationRootTextRead = {
  /**
   * Native UTF-8 decoding followed by shared CRLF folding.
   */
  readonly text: string;
  /**
   * Raw and effective identities describe different representations.
   */
  readonly identity: PreparationRootRawDocument;
};

/**
 * Missing corpus sides remain explicit, while unreadable repositories never become eligibility exclusions.
 *
 * @example
 * ```ts
 * const read = await readPreparationRootCorpusPair({ pin, entryId, l });
 * ```
 */
export type PreparationRootCorpusPair = {
  /**
   * Both files are physically readable at the independent pin.
   */
  readonly kind: 'complete';
  /**
   * Current effective source and its raw identity.
   */
  readonly source: PreparationRootTextRead;
  /**
   * Current effective archive and its raw identity.
   */
  readonly archive: PreparationRootTextRead;
} | {
  /**
   * At least one object is absent at a readable pinned commit.
   */
  readonly kind: 'missing';
  /**
   * Successful sides retain their identities even when the pair is incomplete.
   */
  readonly rawDocuments: readonly PreparationRootRawDocument[];
};

/**
 * Applies precisely the shared corpus reader's text transformations to owned raw bytes.
 *
 * @param bytes - native committed blob bytes
 *
 * @param relPath - independently constructed corpus-relative locator
 *
 * @returns Effective text with raw and normalized identities
 *
 * @example
 * ```ts
 * const read = preparationRootText({ bytes, relPath });
 * ```
 */
function preparationRootText({
  bytes,
  relPath,
}: {
  readonly bytes: Readonly<Uint8Array>;
  readonly relPath: string;
},): PreparationRootTextRead {
  /**
   * Decoding matches readCorpusFile rather than inventing a new text policy.
   */
  const decoded = Buffer.from(bytes,)
    .toString('utf8',);
  /**
   * The native CRLF fold preserves the existing lone-CR behavior and line numbering.
   */
  const folded = foldCarriageReturns({ text: decoded, },);
  return {
    text: folded.text,
    identity: {
      relPath,
      bytes: bytes.byteLength,
      rawHash: createHash('sha256',)
        .update(bytes,)
        .digest('hex',),
      decodedHash: hashContent({ content: decoded, },),
      effectiveHash: hashContent({ content: folded.text, },),
      foldedCrLf: folded.folded,
    },
  };
}

/**
 * Reads both native corpus objects without resolving Git per file or exposing input-bearing subprocess causes.
 * The caller owns one already-resolved, snapshotted pin for the population operation.
 *
 * @param pin - independent native corpus location and commit
 *
 * @param entryId - checked native corpus entry component
 *
 * @param l - caller logger retaining population scope
 *
 * @returns Explicit complete or missing-side evidence
 *
 * @throws PreparationRootError when a failure is not an ordinary missing pinned object
 *
 * @example
 * ```ts
 * const read = await readPreparationRootCorpusPair({ pin, entryId, l });
 * ```
 */
export async function readPreparationRootCorpusPair({
  pin,
  entryId,
  l,
}: {
  readonly pin: CorpusPin;
  readonly entryId: string;
  readonly l: Logger;
},): Promise<PreparationRootCorpusPair> {
  /**
   * All logs retain the owning read operation without corpus text or subprocess excerpts.
   */
  const pl = tagged({
    tag: readPreparationRootCorpusPair.name,
    l,
  },);
  /**
   * Native order fixes source and archive roles before asynchronous reads begin.
   */
  const paths = [
    `people/${entryId}/page.md`,
    `people/${entryId}/page.en.md`,
  ] as const;
  pl.debug(`reading pinned source and archive bytes for ${JSON.stringify(entryId,)}`,);
  /**
   * Only the two sides of this entry overlap; population iteration remains bounded.
   */
  const reads = await Promise.allSettled(paths.map(async function read(relPath,): Promise<Uint8Array> {
    return await readCorpusBytes({
      pin,
      relPath,
    },);
  },),);
  for (const [index, read,] of reads.entries()) {
    if (read.status === 'fulfilled')
      continue;
    /**
     * Rejection data stays opaque until the existing missing-object classifier establishes its scope.
     */
    const failure: unknown = read.reason;
    if (!isMissingCorpusObject(failure,)) {
      pl.warn('pinned corpus read failed outside missing-object eligibility; subprocess details were not retained',);
      throw new PreparationRootError({
        kind: 'corpus-read',
        input: nonNullishOrThrow(paths[index],),
      },);
    }
    pl.info(`pinned corpus object is absent: ${nonNullishOrThrow(paths[index],)}`,);
  }
  /**
   * Every successfully read side is converted without accepting a failed side as empty text.
   */
  const texts = reads.flatMap(function successful(
    read,
    index,
  ): PreparationRootTextRead[] {
    if (read.status === 'rejected')
      return [];
    return [preparationRootText({
      bytes: read.value,
      relPath: nonNullishOrThrow(paths[index],),
    },),];
  },);
  if (texts.length !== paths.length)
    return {
      kind: 'missing',
      rawDocuments: texts.map(function identity(read,): PreparationRootRawDocument { return read.identity; },),
    };
  pl.debug(`read complete pinned corpus pair for ${JSON.stringify(entryId,)}`,);
  return {
    kind: 'complete',
    source: nonNullishOrThrow(texts[0],),
    archive: nonNullishOrThrow(texts[1],),
  };
}

//endregion Native raw corpus reads retain text-transform provenance
