import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { ChunkPair, } from '../chunk-document.ts';
import type { PairedReading, } from '../image-reading-pair.ts';
import type { SliceCache, } from '../slice-cache.ts';
import {
  type PassVisualEvidenceReader,
  readPassVisualEvidence,
} from './pass-visual-evidence.ts';
import type { RunClient, } from './run-client-contract.ts';
import {
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';
import { readJudgeSeats, } from './run-seats.ts';

//region Seated picture reading
// WHO READS THE PICTURES IS DECIDED THE WAY THE BENCHES ARE. The reader
// roster used to be the catalog's answer alone (`RUN_READER_MODELS`), which
// is the right roster while every provider is wet and the wrong one the
// moment a model is withheld on the provider that would serve it: the first
// OpenRouter-only pass (keyword233, 2026-09-03 18:15 UTC) kept Kimi-K3 off
// every judge bench and still bought six of its translations, and a picture
// is the dearest call there is. Split out of `pass-entry.ts` at the line
// cap, on the seam between seating the readers and reading.

/**
 * Seats the picture readers off the meters, then reads every picture with
 * the seated ones.
 *
 * ONE READING OF THE METERS FOR THE STAGE, logged as `JUDGE SEATS
 * phase=pictures`, taken here rather than borrowed from the lanes' reading
 * that follows: the lanes read theirs after this stage has spent its calls,
 * and XIEPT2 on 2026-09-03 showed a provider going dry inside one entry.
 *
 * @param client - run client, whose dryness view seats the readers and whose
 * chat surface reads the pictures
 *
 * @param slices - prepared entry slices naming assets
 *
 * @param entryId - corpus entry whose asset directory is read
 *
 * @param cache - durable paired reading cache
 *
 * @param signal - entry cancellation
 *
 * @param l - entry logger, which records the seating line and the readings
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
 * const readings = await readSeatedPictures({ client, slices, entryId, cache, signal, l, },);
 * ```
 */
export async function readSeatedPictures(
  {
    client,
    slices,
    entryId,
    cache,
    signal,
    l,
    visualEvidenceReader,
  }: {
    readonly client: RunClient;
    readonly slices: readonly ChunkPair[];
    readonly entryId: string;
    readonly cache: SliceCache<PairedReading>;
    readonly signal: AbortSignal;
    readonly l: Logger;
    readonly visualEvidenceReader?: PassVisualEvidenceReader;
  },
): Promise<ReadonlyMap<string, PairedReading>> {
  /**
   * The readers this reading of the meters seats.
   */
  const seats = await readJudgeSeats({
    client,
    phase: 'pictures',
    signal,
    l,
  },);
  return await readPassVisualEvidence({
    client,
    slices,
    pin: RUN_CORPUS_PIN,
    entryId,
    readerModelIds: seats.readers,
    cache,
    signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
    ...((visualEvidenceReader === undefined) ? {} : { visualEvidenceReader, }),
  },);
}

//endregion Seated picture reading
