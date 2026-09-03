import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { armCallDeadline, } from '../call-deadline.ts';
import { runDocumentLanes, } from '../document-lanes.ts';
import type { RunClient, } from './run-client-contract.ts';
import { openPictureReadingCache, } from './reading-cache-store.ts';
import { preparePassEntry, } from './pass-prepare.ts';
import { frontMatterSliceIndexes, } from '../front-matter-slice.ts';
import { buildSettledTwoLaneArtifact, } from './artifact-two-lane-build.ts';
import { assertCarriedInsertionsRemain, } from './carried-insertion-completeness.ts';
import { projectLanes, } from './artifact-two-lane-derive.ts';
import { runPassContest, } from './pass-contest.ts';
import type {
  CorpusPair,
  EntryOutcome,
} from './pass-entry-contract.ts';
import { decidePassInsertionAdmission, } from './pass-insertion-admission.ts';
import { runPassConsolidation, } from './pass-consolidate.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import { destinationsLine, } from './destinations-line.ts';
import { entryErrorOutcome, } from './entry-error-outcome.ts';
import { persistSettledEntry, } from './pass-entry-persist.ts';
import { unfilledPageFindings, } from './publish-completeness.ts';
import { settledTallyLine, } from './settled-tally.ts';
import { readPassOverlap, } from './pass-overlap.ts';
import { tallyErrorText, } from './tally-error-text.ts';
import { readSeatedPictures, } from './pass-seated-pictures.ts';
import type { PassVisualEvidenceReader, } from './pass-visual-evidence.ts';
import {
  discardSliceCache,
  openRefineSliceCache,
  openSliceCache,
  openTranslateSliceCache,
} from './slice-cache-store.ts';
import {
  RUN_CALL_CONFIG,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';
import { readJudgeSeats, } from './run-seats.ts';

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
 * @param publishDir - root of the mirrored corpus tree each fixed page is written into
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
 * @param overlap - most slices each per-slice driver keeps in flight
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
    publishDir,
    entryCacheDir,
    tip,
    pipelineDigest,
    hardCapMs,
    baseSignal,
    overlap,
    visualEvidenceReader,
  }: {
    readonly client: RunClient;
    readonly entry: CorpusPair;
    readonly artifactsDir: string;
    readonly publishDir: string;
    readonly entryCacheDir: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly hardCapMs: number;
    readonly baseSignal: AbortSignal;
    readonly overlap: number;
    readonly visualEvidenceReader?: PassVisualEvidenceReader;
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
     * Naturalness lane's own cache, in its own namespace under the same
     * directory.
     *
     * SEPARATE FROM THE REPAIR LANE'S because it runs AFTER that lane has
     * persisted every slice, so its answers cannot ride in a record written
     * before it was asked. Without it a resumed entry replayed the accuracy
     * pass from disk and then rebought the whole rewrite, publishing different
     * text on identical inputs.
     */
    const refineSliceCache = await openRefineSliceCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },);

    /**
     * Store for what this entry's pictures were read as.
     *
     * ITS OWN NAMESPACE beside the two lanes', because a reading is neither
     * lane's slice: it is evidence keyed by the picture, gathered before either
     * lane runs and shown to one of them.
     */
    const readingCache = await openPictureReadingCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },);

    /**
     * The roster preparation asks, read off the meters first of all
     * (`run-seats.ts`): a withheld model pairs no blocks and reviews no
     * archive either, and the pairing round is the entry's first purchase.
     */
    const preparationSeats = await readJudgeSeats({
      client,
      phase: 'preparation',
      signal: deadline.callSignal,
      l: tagged({ tag: entry.id, },),
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
     *
     * THE ROSTER DECIDES WHICH PARAGRAPH RENDERS WHICH, per
     * `doc/decision/llm-assisted-block-pairing.md`, because the deterministic
     * scorer is exhausted on this corpus: block kind is constant across
     * paragraphs, Chinese and English prose share no Latin tokens, and length
     * alone reached four correct pairings in eight on `saurikissa` and went no
     * further at any weight. Six of eleven slices there paired unrelated
     * paragraphs, and every stage downstream then behaved correctly on wrong
     * input. A section the roster cannot pair keeps the scorer and says so.
     */
    const {
      prepared,
      findings: pairingFindings,
    } = await preparePassEntry({
      client,
      entryId: entry.id,
      entryCacheDir,
      pipelineDigest,
      modelIds: preparationSeats.roster,
      sourceText: entry.sourceText,
      // Normalized inside (`pass-prepare.ts`): the archive both deciders judge
      // is the archive as prepared, never these bytes.
      targetText: entry.targetText,
      signal: deadline.callSignal,
      exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      l: tagged({ tag: entry.id, },),
    },);
    /**
     * Archive after preparation-stage review corrections.
     */
    const settledArchiveText = prepared.targetText;

    /**
     * Complete reviewed visual evidence required before insertion and lanes,
     * read by the readers the meters seat (`pass-seated-pictures.ts`): a model
     * withheld on the provider that would serve it reads no picture either.
     */
    const pictureReadings = await readSeatedPictures({
      client,
      slices: prepared.slices,
      entryId: entry.id,
      cache: readingCache,
      signal: deadline.callSignal,
      l: tagged({ tag: entry.id, },),
      ...((visualEvidenceReader === undefined) ? {} : { visualEvidenceReader, }),
    },);

    /**
     * The lanes' judge benches, read off Synthetic's meter (`run-seats.ts`).
     * The contest and the consolidation seams read their own: XIEPT2 on
     * 2026-09-03 ran Synthetic dry seven minutes into a 219-minute entry.
     */
    const seats = await readJudgeSeats({
      client,
      phase: 'lanes',
      signal: deadline.callSignal,
      l: tagged({ tag: entry.id, },),
    },);

    /**
     * Semantic and deterministic proof for every source-only slice.
     *
     * BOUGHT BEFORE THE LANES so known omission is licensed for translation or
     * unresolved placement pauses stage as incomplete. Coverage roster searches
     * whole target, independent of pairing;
     * page shortfall or a missing destination supplies second corroboration.
     */
    const translateInsertionAdmission = await decidePassInsertionAdmission({
      client,
      prepared,
      modelIds: seats.roster,
      overlap,
      signal: deadline.callSignal,
      perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      l: tagged({ tag: entry.id, },),
    },);

    /**
     * What both lanes made of that slicing, with neither preferred.
     */
    const lanes = await runDocumentLanes({
      client,
      prepared,
      repairModels: seats.repairModels,
      translateModels: seats.translateModels,
      pictureReadings,
      signal: deadline.callSignal,
      perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      overlap,
      repairSliceCache: sliceCache,
      refineSliceCache,
      translateSliceCache,
      translateInsertionAdmission,
      l: tagged({ tag: entry.id, },),
    },);

    // AFTER the lanes return and BEFORE anything is written, which is the only
    // place this check belongs. Both drivers deliberately let a fully cached
    // lane finish after an abort, so a gate BETWEEN the lanes would discard
    // work already bought; and an entry whose ceiling fired mid-document has a
    // half-run to report, not an artifact.
    deadline.callSignal
      .throwIfAborted();

    // A RECORDED GAP, NOT A REFUSAL. Under the no-loop design of 2026-09-01 a
    // source passage still unfilled after the single round and its one
    // follow-up ships as a gap the artifact records (`lanes.translate.unfilled`
    // and the lane's findings), because an insertion is recovered supplementary
    // content whose absence is a recorded gap, not a missing required page. The
    // refusal that stood here (2026-08-27) dropped XIEPT2 after 35 minutes on
    // 2026-09-02 over one passage two judge rounds tied on, and an earlier
    // XIEPT2 attempt after four hours forty-eight minutes.
    /**
     * Source passages translation could not fill, each named in the log.
     */
    const { unfilled, } = lanes.translate;
    for (const finding of unfilledPageFindings({ unfilled, },)) {
      tagged({ tag: entry.id, },)
        .warn(`entry ${entry.id}: ${finding}`,);
    }

    /**
     * Both ledgers as version 2 rows, beside the comparison they derive.
     *
     * DERIVED HERE AND HANDED TO THE BUILDER`S OWN CALL rather than passed
     * along, because the builder derives it again from the same function. The
     * contest needs it first, to know which slices are worth asking about.
     */
    const projected = projectLanes({ lanes, },);

    /**
     * Syntax-bearing metadata slice indexes shared by final quality stages.
     */
    const frontMatterSlices = frontMatterSliceIndexes({
      slices: prepared.slices,
    },);

    /**
     * What the roster said at every slice the two lanes worded differently.
     */
    const contestSlices = await runPassContest({
      client,
      lanes,
      projected,
      frontMatterSlices,
      ...((prepared.identityContext === undefined)
        ? {}
        : { identityContext: prepared.identityContext, }),
      entryCacheDir,
      pipelineDigest,
      signal: deadline.callSignal,
      overlap,
      l: tagged({ tag: entry.id, },),
    },);

    /**
     * Third rendering and final naturalness decisions for contested slices.
     */
    const consolidateSlices = await runPassConsolidation({
      client,
      prepared,
      projected,
      contests: contestSlices,
      frontMatterSlices,
      pictureReadings,
      entryCacheDir,
      pipelineDigest,
      signal: deadline.callSignal,
      overlap,
      l: tagged({ tag: entry.id, },),
    },);

    /**
     * Wall time this entry took, both lanes and the contest included.
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
    const artifact = buildSettledTwoLaneArtifact({
      entryId: entry.id,
      tip,
      pipelineDigest,
      corpusSha: RUN_CORPUS_PIN.commitSha,
      callConfig: RUN_CALL_CONFIG,
      durationMs,
      prepared,
      lanes,

      // A CONTEST THAT RAN, whatever it found. A document whose two lanes never
      // differed records an empty contest rather than the pending kind: "the
      // roster was asked and nothing differed" and "nobody has asked" are
      // different facts, and the pending kind now means only the second.
      laneSelection: {
        kind: 'contested',
        slices: contestSlices,
      },

      // A CONSOLIDATION THAT RAN, whatever it found, for the reason given
      // above about the contest: a document where every contested slice kept
      // its standing text records a settled stage with those records in it,
      // not the absence that means nobody asked.
      consolidation: {
        kind: 'settled',
        slices: consolidateSlices,
      },
    },);

    /**
     * This entry's TALLY line, read off the artifact BEFORE it is written.
     *
     * NOT INLINED INTO THE `console.log` BELOW, which is where it sat until
     * 2026-08-22 and where the obvious tidying would put it back. The line asks
     * what each slice would carry, and that question raises
     * `UnansweredContestSliceError` on a document whose lanes differ at a slice
     * the contest names nowhere. Raised after the write, that lands in the catch
     * below, which prints `status=ERROR` for an entry whose complete artifact is
     * already on disk: every later reader would then find a settled file the
     * pass reported as failed.
     *
     * Asking first makes the refusal truthful. A contest that cannot account for
     * a slice it was obliged to decide has not settled the document, and no
     * artifact should claim it did; the stage caches still hold every answer, so
     * a re-run reproduces the contradiction rather than losing it.
     */
    assertCarriedInsertionsRemain({
      artifact,
      slices: prepared.slices,
      targetText: settledArchiveText,
      carried: translateInsertionAdmission.carried ?? [],
    },);
    /**
     * Tally proven readable before any persistence.
     */
    const tally = settledTallyLine({ artifact, },);

    // BEFORE THE ARTIFACT, for the same reason the tally line is read before it,
    // and for one more. A pass builds its skip set from the artifacts already on
    // disk, so an entry whose artifact exists is never attempted again. Written
    // second, a crash between the two writes would leave that entry done forever
    // with no page ever produced; written first, every entry the pass calls
    // settled has its page, by construction rather than by luck.
    /**
     * Where the page went and what it carries of the source's destinations.
     */
    const destinations = await persistSettledEntry({
      artifact,
      slices: prepared.slices,
      archiveText: settledArchiveText,
      sourceText: entry.sourceText,
      entryId: entry.id,
      publishDir,
      artifactsDir,
      l: tagged({ tag: entry.id, },),
    },);
    console.log(tally,);
    // COUNTS ONLY ON STDOUT; the addresses themselves are in the run log.
    console.log(destinationsLine({
      entryId: entry.id,
      destinations,
    },),);
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
     * Failure text for the TALLY line, named or quoted per its class and capped.
     */
    const message = tallyErrorText({ error, },);
    /**
     * Tally and retry classification for caught state.
     */
    const classified = entryErrorOutcome({ error, },);
    console.log(`TALLY ${entry.id} status=${classified.status} ms=${String(durationMs,)} aborted=${String(aborted,)} error=${message}`,);
    return classified.outcome;
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
 * Returns scheduling disposition so quality interruption cannot masquerade as
 * cache-progress reason for fresh whole-entry attempt.
 *
 * @param client - shared model client
 *
 * @param entry - corpus pair to settle, text already read
 *
 * @param artifactsDir - directory one JSON per settled entry is written into
 *
 * @param publishDir - root of the mirrored corpus tree each fixed page is written into
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
 * @throws StatedRefusalError before entry work when overlap environment value
 * is invalid launch configuration
 *
 * @returns Settlement, resumable operational failure, or stopped incomplete work
 *
 * @example
 * ```ts
 * const outcome = await settleEntry({ client, entry, artifactsDir, sliceCacheDir, tip, pipelineDigest, hardCapMs, baseSignal, },);
 * ```
 */
export async function settleEntry(
  {
    client,
    entry,
    artifactsDir,
    publishDir,
    sliceCacheDir,
    tip,
    pipelineDigest,
    hardCapMs,
    baseSignal,
    visualEvidenceReader,
  }: {
    readonly client: RunClient;
    readonly entry: CorpusPair;
    readonly artifactsDir: string;
    readonly publishDir: string;
    readonly sliceCacheDir: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly hardCapMs: number;
    readonly baseSignal: AbortSignal;
    readonly visualEvidenceReader?: PassVisualEvidenceReader;
  },
): Promise<EntryOutcome> {
  /**
   * Slice overlap read once for this entry and shared by every per-slice driver.
   */
  const overlap = readPassOverlap({ entryId: entry.id, },);

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
    publishDir,
    entryCacheDir,
    tip,
    pipelineDigest,
    hardCapMs,
    baseSignal,
    overlap,
    ...((visualEvidenceReader === undefined) ? {} : { visualEvidenceReader, }),
  },);
  if (outcome.kind !== 'settled') {
    // The cache is what makes operational resume cheaper. Stopped quality work
    // also keeps evidence but does not earn another whole-entry attempt.
    return outcome;
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
    console.log(`CLEANUP ${entry.id} cache=retained error=${tallyErrorText({ error, },)}`,);
  }
  return outcome;
}

//endregion Pass entry
