import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import type { ChunkPair, } from '../chunk-document.ts';
import { readDocumentPictures, } from '../document-readings.ts';
import { readImageWithOcr, } from '../image-ocr.ts';
import type { PairedReading, } from '../image-reading-pair.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import type { CorpusPin, } from '../corpus-source.ts';
import type { SliceCache, } from '../slice-cache.ts';
import { gatherEntryPictures, } from './entry-pictures.ts';
import { assertVisualEvidenceComplete, } from './visual-evidence-completeness.ts';

//region Pass visual evidence

/**
 * Test seam supplying reviewed visual evidence without corpus asset I/O.
 */
export type PassVisualEvidenceReader = (args: {
  readonly slices: readonly ChunkPair[];
},) => Promise<ReadonlyMap<string, PairedReading>>;

/**
 * Reads and requires complete visual evidence before any lane work.
 *
 * @param client - provider client for image readers
 *
 * @param slices - prepared entry slices naming assets
 *
 * @param pin - corpus commit assets belong to
 *
 * @param entryId - corpus entry whose asset directory is read
 *
 * @param readerModelIds - vision roster
 *
 * @param cache - durable paired reading cache
 *
 * @param signal - entry cancellation
 *
 * @param perCallTimeoutMs - image exchange deadline
 *
 * @param l - entry logger
 *
 * @param visualEvidenceReader - optional integration-test evidence seam
 *
 * @returns Corroborated or reviewed no-text evidence by asset
 *
 * @throws {@link import('./visual-evidence-completeness.ts').VisualEvidenceInterruptedError}
 * when any referenced asset lacks usable evidence
 *
 * @example
 * ```ts
 * const readings = await readPassVisualEvidence({ client, slices, pin, entryId, readerModelIds, cache, signal, perCallTimeoutMs, l, });
 * ```
 */
export async function readPassVisualEvidence(
  {
    client,
    slices,
    pin,
    entryId,
    readerModelIds,
    cache,
    signal,
    perCallTimeoutMs,
    l,
    visualEvidenceReader,
  }: {
    readonly client: SyntheticClient;
    readonly slices: readonly ChunkPair[];
    readonly pin: CorpusPin;
    readonly entryId: string;
    readonly readerModelIds: readonly RosterModelId[];
    readonly cache: SliceCache<PairedReading>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
    readonly visualEvidenceReader?: PassVisualEvidenceReader;
  },
): Promise<ReadonlyMap<string, PairedReading>> {
  /**
   * Assets read only on production path.
   */
  const assets = (visualEvidenceReader === undefined)
    ? await gatherEntryPictures({
      pin,
      entryId,
      slices,
      l,
    },)
    : new Map<string, Uint8Array>();
  /**
   * Paired visual evidence from production or integration seam.
   */
  const readings = (visualEvidenceReader === undefined)
    ? await readDocumentPictures({
      readOcr: readImageWithOcr,
      client,
      slices,
      assets,
      readerModelIds,
      cache,
      signal,
      perCallTimeoutMs,
      l,
    },)
    : await visualEvidenceReader({ slices, },);
  assertVisualEvidenceComplete({
    slices,
    readings,
  },);
  return readings;
}

//endregion Pass visual evidence
