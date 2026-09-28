import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { BenchSeating, } from '../bench-seating.ts';
import type { PairedPreparation, } from '../prepare-with-pairing.ts';
import { preparePassEntry, } from './pass-prepare.ts';
import type { PassVisualEvidenceReader, } from './pass-visual-evidence.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import type { RunClient, } from './run-client-contract.ts';
import { RUN_PER_CALL_TIMEOUT_MS, } from './run-config.ts';
import {
  readJudgeSeats,
  type SeatReadingClient,
} from './run-seats-read.ts';

//region Preparation re-seating
// THE PREPARATION'S PER-ITEM HOOK (ledger X12), beside the other phases'
// hooks, so a test can drive it with the reading rig they are tested with.
// One hook serves every stage that asks the roster: the attestation, each
// section and block pairing round, and each archive block's review.

/**
 Hook the preparation calls before each item it asks the roster about.

 @example
 ```ts
 const hooks: PreparationHooks = preparationHooksFor({ client, signal, l, },);
 ```
 */
export type PreparationHooks = {
  readonly beforeItem: () => Promise<BenchSeating>;
};

/**
 Seating that keeps the roster the preparation started on.

 @returns No roster, so the given one stands

 @example
 ```ts
 const seating = await keepBench();
 ```
 */
function keepBench(): Promise<BenchSeating> {
  return Promise.resolve({},);
}

/**
 Builds the preparation's per-item hook.

 @param _ - run client, entry abort and entry logger the re-seating will read

 @returns Per-item reader, handing each item the roster it is asked of

 @example
 ```ts
 const hooks = preparationHooksFor({ client, signal, l, },);
 ```
 */
export function preparationHooksFor(
  _: {
    readonly client: SeatReadingClient;
    readonly signal: AbortSignal;
    readonly l: Logger;
  },
): PreparationHooks {
  return { beforeItem: keepBench, };
}

/**
 Prepares one entry on the roster the meters seat, with its per-item hook
 wired: the seam `runPassEntry` calls (ledger X12 and X14: split out so a
 test can drive the wiring, as it drives the other phases').

 @param client - run client whose dryness view seats the roster and whose
 chat surface asks it

 @param entryId - corpus entry prepared, which tags the log lines

 @param entryCacheDir - per-entry cache root

 @param pipelineDigest - generation stamp for the caches

 @param readPictures - shared entry reader supplying picture support

 @param sourceText - the original

 @param targetText - the archive as the corpus holds it

 @param signal - entry deadline and caller abort

 @returns Prepared slices and pairing findings

 @example
 ```ts
 const paired = await runPassPreparation({ client, entryId, entryCacheDir, pipelineDigest, readPictures, sourceText, targetText, signal, },);
 ```
 */
export async function runPassPreparation(
  {
    client,
    entryId,
    entryCacheDir,
    pipelineDigest,
    readPictures,
    sourceText,
    targetText,
    signal,
  }: {
    readonly client: RunClient;
    readonly entryId: string;
    readonly entryCacheDir: string;
    readonly pipelineDigest: PipelineDigest;
    readonly readPictures: PassVisualEvidenceReader;
    readonly sourceText: string;
    readonly targetText: string;
    readonly signal: AbortSignal;
  },
): Promise<PairedPreparation> {
  /**
   Entry logger the preparation and its hook write to.
   */
  const l = tagged({ tag: entryId, },);
  /**
   The roster preparation asks, read off the meters first of all
   (`run-seats.ts`): a withheld model pairs no blocks and reviews no
   archive either, and the pairing round is the entry's first purchase.
   */
  const seats = await readJudgeSeats({
    client,
    phase: 'preparation',
    signal,
    l,
  },);
  return await preparePassEntry({
    client,
    entryId,
    entryCacheDir,
    pipelineDigest,
    modelIds: seats.roster,
    readPictures,
    sourceText,
    targetText,
    signal,
    exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
    // EVERY ITEM RE-SEATS UNDER A HOLD (ledger X12).
    beforeItem: preparationHooksFor({
      client,
      signal,
      l,
    },)
      .beforeItem,
  },);
}

//endregion Preparation re-seating
