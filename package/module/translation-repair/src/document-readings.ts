import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { ChunkPair, } from './chunk-document.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { imageReadingKey, } from './image-reading-key.ts';
import {
  type OcrReader,
  type PairedReading,
  readImagePair,
} from './image-reading-pair.ts';
import { photoReferences, } from './photo-reference.ts';

import type { SliceCache, } from './slice-cache.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Document readings
// EVERY PICTURE IN ONE DOCUMENT, READ ONCE, before any of its slices is
// translated.
//
// ONCE PER PICTURE, NOT ONCE PER SLICE. A picture named by a slice is shown to
// that slice and to both its neighbours, so reading per slice would send the
// same asset three times. Measured over the pinned corpus, 79 slices name 192
// references resolving to 191 distinct assets, so the difference is most of the
// work.
//
// BEFORE THE SLICES RATHER THAN DURING THEM, because a reading is EVIDENCE that
// has to be in the cache key of every slice that sees it. Gathering them first
// means a slice's key is a function of readings that already exist, rather than
// of readings a later slice might still produce.
//
// BYTES ARE HANDED IN, never read from disk here. The driver above is a function
// of its inputs and its injected client, which is what makes it testable without
// a corpus and what keeps a corpus layout out of the lane. The corpus-run layer
// knows the entry id and the photos directory; this knows neither.

/**
 * Reads every picture one document's slices name, through the resumable store.
 *
 * @param client - injected model client
 *
 * @param slices - prepared slice pairs of one entry
 *
 * @param assets - picture bytes per asset name, gathered by the caller
 *
 * @param readerModelIds - vision sub-roster
 *
 * @param cache - cross-run store, so a resumed run re-reads no picture
 *
 * @param signal - entry abort honoured by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - driver logger
 *
 * @returns What reading produced per asset name, including refusals
 *
 * @throws {@link DOMException} on the caller's abort, and whatever the reading
 * cache raises, which is a disk failure rather than an unreadable picture. A
 * READER THAT FAILS IS NOT AMONG THESE: `readImagePair` contains it as an
 * unavailable reading, because nothing downstream requires a reading and an
 * entry must not be lost to one
 *
 * @example
 * ```ts
 * const readings = await readDocumentPictures({ client, slices, assets, readerModelIds, cache, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function readDocumentPictures(
  {
    client,
    readOcr,
    slices,
    assets,
    readerModelIds,
    cache,
    signal,
    perCallTimeoutMs,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly readOcr: OcrReader;
    readonly slices: readonly ChunkPair[];
    readonly assets: ReadonlyMap<string, Uint8Array>;
    readonly readerModelIds: readonly SyntheticModelId[];
    readonly cache: SliceCache<PairedReading>;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  },
): Promise<ReadonlyMap<string, PairedReading>> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: readDocumentPictures.name,
    l,
  },);

  /**
   * Every picture any slice names on its source side, each once, in document
   * order.
   */
  const named = new Set<string>();
  for (const slice of slices) {
    for (const reference of photoReferences({
      text: slice.source
        .text,
    },))
      named.add(reference.assetName,);
  }

  /**
   * What each picture produced.
   */
  const readings = new Map<string, PairedReading>();
  if (named.size === 0)
    return readings;

  rl.info(`reading ${String(named.size,)} pictures for this document`,);

  for (const assetName of named) {
    /**
     * Picture itself, absent when the caller gathered no bytes for it.
     */
    const bytes = assets.get(assetName,);
    if (bytes === undefined) {
      // NOT AN ERROR HERE. The caller enumerates the same references this does,
      // so a gap means the file was unreadable where the corpus was read, and
      // that is the caller's finding to make. A slice shown no reading for a
      // picture reports it as unread, which is exactly what happened.
      rl.warn(`${assetName}: no bytes were gathered, so it was not read`,);
      continue;
    }

    /**
     * Where this reading is stored, derived from what it was asked rather than
     * from what came back: readings are not deterministic, and a key over their
     * text would miss on every run.
     */
    const key = imageReadingKey({
      bytes,
      readerModelIds,
    },);

    /**
     * Reading settled on an earlier run, absent on a first pass.
     */
    const resumed = cache.resumed
      .get(key,);
    if (resumed !== undefined) {
      rl.info(`${assetName}: resumed, ${resumed.kind}`,);
      readings.set(
        assetName,
        resumed,
      );
      continue;
    }

    /* oxlint-disable no-await-in-loop -- sequential by design, matching `translateDocument`: the client's limiter grants one stream per model, so reading two pictures at once queues behind the same slot rather than doubling throughput, and settling one picture before starting the next is what makes an aborted run resumable to the picture it reached */
    /**
     * What the roster made of it now.
     */
    const paired = await readImagePair({
      readOcr,
      client,
      readerModelIds,
      bytes,
      assetName,
      signal,
      perCallTimeoutMs,
      l: rl,
    },);
    readings.set(
      assetName,
      paired,
    );
    await cache.persist({
      key,
      serialized: JSON.stringify(paired,),
    },);
    /* oxlint-enable no-await-in-loop */
  }

  return readings;
}

//endregion Document readings
