import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { armCallDeadline, } from '../call-deadline.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import { runDocumentLanes, } from '../document-lanes.ts';
import { prepareDocumentPair, } from '../document-preparation.ts';
import { buildSettledArtifactV2, } from './artifact-v2-build.ts';
import { writeFileAtomic, } from './atomic-write.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import { settledTallyLine, } from './settled-tally.ts';
import {
  discardSliceCache,
  openSliceCache,
  openTranslateSliceCache,
} from './slice-cache-store.ts';
import {
  RUN_CALL_CONFIG,
  RUN_CORPUS_PIN,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_TRANSLATE_MODELS,
} from './run-config.ts';

//region Pass entry
// ONE entry, start to settled: its cache, its deadline, its artifact and its
// TALLY line.
//
// Split from `corpus-pass.ts` at the line cap, on the seam between SCHEDULING
// and SETTLING. What survives in the pass is the part that decides which entry
// runs next and when to stop starting them; what moved here is everything that
// happens once an entry has been chosen, and that part never reads the
// scheduler's state.
//
// The seam matters beyond the line count: an entry either settles completely or
// records an ERROR, and nothing between those two outcomes is allowed to reach
// the artifacts directory. Keeping the whole of that in one function is what
// makes the rule checkable by reading, since the write is the last thing the
// success path does and the failure path has no write at all.

/**
 * Characters of an error message kept in a TALLY line.
 */
const ERROR_MESSAGE_CAP = 200;

/**
 * Whether an entry reached its artifact.
 *
 * A NAMED RESULT RATHER THAN A FLAG the catch sets, because the only thing
 * downstream of it is a cache discard, and a discard is destructive: reading
 * "was this settled" off a mutable variable assigned in two branches is how a
 * failed entry ends up losing the slices it had already bought.
 *
 * @example
 * ```ts
 * const outcome: EntryOutcome = { kind: 'settled', };
 * ```
 */
type EntryOutcome = {
  /**
   * Artifact was written: both lanes ran and what each produced is on disk.
   *
   * NOT that anything was decided. Under version 2 the pipeline settles an
   * entry and chooses no lane, and the artifact says so in `laneSelection`.
   */
  readonly kind: 'settled';
} | {
  /**
   * Entry raised or hit its ceiling, and no artifact exists for it.
   */
  readonly kind: 'failed';
};

/**
 * One eligible corpus pair with its text loaded.
 */
export type CorpusPair = {
  /**
   * Person entry id.
   */
  readonly id: string;

  /**
   * Original zh page text.
   */
  readonly sourceText: string;

  /**
   * Translated en page text.
   */
  readonly targetText: string;
};

/**
 * Runs one chosen entry as far as its artifact, and says whether it got there.
 *
 * SEPARATE FROM THE CACHE DISCARD that follows it, which is the whole reason
 * this function exists rather than one longer body. The discard is destructive
 * and belongs only to the settled path, and a `catch` wide enough to cover both
 * cannot tell a pipeline failure from a failed unlink.
 *
 * @param client - shared model client
 *
 * @param entry - corpus pair to settle, text already read
 *
 * @param artifactsDir - directory one JSON per settled entry is written into
 *
 * @param entryCacheDir - this entry's own cache directory
 *
 * @param tip - repository head recorded into the artifact
 *
 * @param pipelineDigest - identity of the built pipeline, which also generation
 * -stamps the slice cache so a changed pipeline cannot resume foreign slices
 *
 * @param hardCapMs - wall time this entry may run before its exchanges abort
 *
 * @param baseSignal - abort this entry's deadline forwards from
 *
 * @returns Whether an artifact was written
 *
 * @example
 * ```ts
 * const outcome = await runEntryPipeline({ client, entry, artifactsDir, entryCacheDir, ... },);
 * ```
 */
async function runEntryPipeline(
  {
    client,
    entry,
    artifactsDir,
    entryCacheDir,
    tip,
    pipelineDigest,
    hardCapMs,
    baseSignal,
  }: {
    readonly client: SyntheticClient;
    readonly entry: CorpusPair;
    readonly artifactsDir: string;
    readonly entryCacheDir: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly hardCapMs: number;
    readonly baseSignal: AbortSignal;
  },
): Promise<EntryOutcome> {
  /**
   * Start time of this entry, for its duration.
   */
  const t0 = Date.now();

  /**
   * Per-entry hard-cap deadline. Disposal at return defuses the timer and
   * detaches its listener; the repo bans try/finally, so cleanup rides on
   * `using` instead.
   *
   * ARMED BEFORE THE CACHE OPENS rather than after. Opening reads and may
   * discard a directory of settled slices, and on a large entry that is real
   * wall time; a ceiling armed afterwards would not be counting it, so the cap
   * would mean something slightly different for a resumed entry than for a
   * fresh one.
   */
  using deadline = armCallDeadline({
    signal: baseSignal,
    timeoutMs: hardCapMs,
    label: entry.id,
  },);
  try {
    /**
     * Cross-run cache resuming finished slices and persisting new ones as each
     * slice completes.
     *
     * INSIDE the try, because it touches the filesystem and can fail. Opened
     * outside, one unreadable cache directory ended the whole pass at whatever
     * entry happened to hold it, which is the opposite of this function's
     * contract.
     */
    const sliceCache = await openSliceCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },);

    /**
     * Translate lane's own cache, in its own namespace under the same
     * directory, so one entry's caches are retired together and neither lane
     * can resume the other's slices.
     */
    const translateSliceCache = await openTranslateSliceCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },);

    /**
     * Slicing BOTH lanes run over, prepared once here rather than inside
     * either.
     *
     * That is the entire reason the driver exists: one slicing, one alignment
     * and one identity block mean a difference between the two documents is a
     * difference between the LANES rather than between two runs of the aligner.
     *
     * No slice budget is passed, and that is checked rather than assumed:
     * `prepareDocumentPair` defaults to the same `SLICE_CHAR_BUDGET` that
     * `repairTranslation` passed down when it did this itself, so entries
     * settled before and after this change were sliced the same way.
     */
    const prepared = prepareDocumentPair({
      sourceText: entry.sourceText,
      targetText: entry.targetText,
    },);

    /**
     * What both lanes made of that slicing, with neither preferred.
     */
    const lanes = await runDocumentLanes({
      client,
      prepared,
      repairModels: RUN_MODELS,
      translateModels: RUN_TRANSLATE_MODELS,
      signal: deadline.callSignal,
      perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      repairSliceCache: sliceCache,
      translateSliceCache,
      l: tagged({ tag: entry.id, },),
    },);

    // AFTER the lanes return and BEFORE anything is written, which is the only
    // place this check belongs. Both drivers deliberately let a fully cached
    // lane finish after an abort, so a gate BETWEEN the lanes would discard
    // work already bought; and an entry whose ceiling fired mid-document has a
    // half-run to report, not an artifact.
    deadline.callSignal
      .throwIfAborted();

    /**
     * Wall time this entry took, both lanes included.
     */
    const durationMs = Date.now() - t0;

    /**
     * Rich artifact for later grading; corpus-derived, hence gitignored.
     *
     * Everything derivable is derived inside the builder, so what goes in is
     * the preparation and the driver's own result rather than counts taken off
     * them here. It refuses a run whose ledgers do not describe that
     * preparation, which is why no artifact can name a slicing the lanes never
     * ran over.
     */
    const artifact = buildSettledArtifactV2({
      entryId: entry.id,
      tip,
      pipelineDigest,
      corpusSha: RUN_CORPUS_PIN.commitSha,
      callConfig: RUN_CALL_CONFIG,
      durationMs,
      prepared,
      lanes,
    },);
    await writeFileAtomic({
      path: join(
        artifactsDir,
        `${entry.id}.json`,
      ),
      text: `${JSON.stringify(
        artifact,
        undefined,
        2,
      )}\n`,
    },);
    console.log(settledTallyLine({ artifact, },),);
    return { kind: 'settled', };
  }
  catch (error) {
    /**
     * Wall time before this entry failed.
     */
    const durationMs = Date.now() - t0;

    /**
     * Whether the hard-ceiling abort fired.
     */
    const { aborted, } = deadline.callSignal;

    /**
     * Trimmed failure text for the TALLY line.
     */
    const message = Error.isError(error,)
      ? error.message
        .slice(
          0,
          ERROR_MESSAGE_CAP,
        )
      : String(error,);
    console.log(`TALLY ${entry.id} status=ERROR ms=${String(durationMs,)} aborted=${String(aborted,)} error=${message}`,);
    return { kind: 'failed', };
  }
}

/**
 * Runs one chosen entry to settlement, then retires its cache if it settled.
 *
 * Never throws for a failed entry. A pass over a corpus stops for a broken
 * SCHEDULER, not for a broken document: an entry that aborts on its ceiling or
 * raises out of a stage records `status=ERROR` and the pass continues to the
 * next one. Anything raised here would therefore end the run, which is why
 * nothing is.
 *
 * Returns nothing: the artifact file and the TALLY line ARE the outputs, and a
 * caller that read a value here would be reading a second, weaker copy of what
 * the artifact already says.
 *
 * @param client - shared model client
 *
 * @param entry - corpus pair to settle, text already read
 *
 * @param artifactsDir - directory one JSON per settled entry is written into
 *
 * @param sliceCacheDir - root under which this entry claims its own cache
 * subdirectory
 *
 * @param tip - repository head recorded into the artifact
 *
 * @param pipelineDigest - identity of the built pipeline, which also generation
 * -stamps the slice cache so a changed pipeline cannot resume foreign slices
 *
 * @param hardCapMs - wall time this entry may run before its exchanges abort
 *
 * @param baseSignal - abort every entry deadline forwards from; the pass never
 * aborts it, so only a per-entry timeout ever fires
 *
 * @example
 * ```ts
 * await settleEntry({ client, entry, artifactsDir, sliceCacheDir, tip, pipelineDigest, hardCapMs, baseSignal, },);
 * ```
 */
export async function settleEntry(
  {
    client,
    entry,
    artifactsDir,
    sliceCacheDir,
    tip,
    pipelineDigest,
    hardCapMs,
    baseSignal,
  }: {
    readonly client: SyntheticClient;
    readonly entry: CorpusPair;
    readonly artifactsDir: string;
    readonly sliceCacheDir: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly hardCapMs: number;
    readonly baseSignal: AbortSignal;
  },
): Promise<void> {
  /**
   * Per-entry slice-cache directory; earlier runs' finished slices live here so
   * a large document resumes instead of restarting.
   */
  const entryCacheDir = join(
    sliceCacheDir,
    entry.id,
  );

  /**
   * Whether this entry reached its artifact.
   */
  const outcome = await runEntryPipeline({
    client,
    entry,
    artifactsDir,
    entryCacheDir,
    tip,
    pipelineDigest,
    hardCapMs,
    baseSignal,
  },);
  if (outcome.kind === 'failed') {
    // The cache is what makes the next attempt cheaper, so a failed entry keeps
    // every slice it managed to buy. This is the branch the discard used to
    // share with the settled one.
    return;
  }

  try {
    // The entry settled, so its slice cache is spent; drop it to keep the cache
    // directory bounded to in-flight large documents. AFTER the artifact write,
    // never before: a discard that ran first would turn a failed write into a
    // full re-buy of every slice.
    await discardSliceCache({ dir: entryCacheDir, },);
  }
  catch (error) {
    // A CLEANUP LINE, NEVER A SECOND TALLY. The artifact is already on disk, so
    // this entry IS settled; the old shape ran the discard inside the same try
    // as the pipeline, so a failed unlink logged `TALLY status=ERROR` after the
    // success line and every reader counting statuses saw one entry as both.
    // What is left behind is a stale cache directory, which costs disk and
    // nothing else: the next run skips the entry on its artifact.
    console.log(
      `CLEANUP ${entry.id} cache=retained error=${
        Error.isError(error,)
          ? error.message
            .slice(
              0,
              ERROR_MESSAGE_CAP,
            )
          : String(error,)
      }`,
    );
  }
}

//endregion Pass entry
