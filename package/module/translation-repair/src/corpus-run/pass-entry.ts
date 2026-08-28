import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { armCallDeadline, } from '../call-deadline.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import { readDocumentPictures, } from '../document-readings.ts';
import { readImageWithOcr, } from '../image-ocr.ts';
import { runDocumentLanes, } from '../document-lanes.ts';
import { gatherEntryPictures, } from './entry-pictures.ts';
import { openPictureReadingCache, } from './reading-cache-store.ts';
import { preparePassEntry, } from './pass-prepare.ts';
import { sliceNeighbourContexts, } from '../fidelity-window.ts';
import { frontMatterSliceIndexes, } from '../front-matter-slice.ts';
import { slicePictureContexts, } from '../slice-pictures.ts';
import { buildSettledTwoLaneArtifact, } from './artifact-two-lane-build.ts';
import { projectLanes, } from './artifact-two-lane-derive.ts';
import { consolidateDocument, } from '../consolidate-driver.ts';
import { contestDocumentLanes, } from '../lane-contest-driver.ts';
import { openConsolidateCache, } from './consolidate-cache-store.ts';
import { openLaneContestCache, } from './lane-contest-cache-store.ts';
import type {
  CorpusPair,
  EntryOutcome,
} from './pass-entry-contract.ts';
import { decidePassInsertionAdmission, } from './pass-insertion-admission.ts';
import { passArchiveText, } from './pass-archive.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import { destinationsLine, } from './destinations-line.ts';
import { persistSettledEntry, } from './pass-entry-persist.ts';
import { assertPublishableTranslation, } from './publish-completeness.ts';
import { settledTallyLine, } from './settled-tally.ts';
import { readPassOverlap, } from './pass-overlap.ts';
import { tallyErrorText, } from './tally-error-text.ts';
import {
  discardSliceCache,
  openRefineSliceCache,
  openSliceCache,
  openTranslateSliceCache,
} from './slice-cache-store.ts';
import {
  RUN_CALL_CONFIG,
  RUN_CORPUS_PIN,
  RUN_READER_MODELS,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
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
  }: {
    readonly client: SyntheticClient;
    readonly entry: CorpusPair;
    readonly artifactsDir: string;
    readonly publishDir: string;
    readonly entryCacheDir: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly hardCapMs: number;
    readonly baseSignal: AbortSignal;
    readonly overlap: number;
  },
): Promise<EntryOutcome> {
  /**
   * Start time of this entry, for its duration.
   */
  const t0 = Date.now();

  /**
   * Archive bytes both deciders judge, normalized before preparation so spans,
   * candidates, artifact and published page all describe same visible text.
   */
  const archiveText = passArchiveText({ text: entry.targetText, });

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
      modelIds: RUN_ROSTER,
      sourceText: entry.sourceText,
      targetText: archiveText,
      signal: deadline.callSignal,
      exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      l: tagged({ tag: entry.id, },),
    },);

    /**
     * Pictures this entry's slices show, read off the pinned corpus.
     *
     * BEFORE THE LANES, not during them: a reading has to be in the cache key
     * of every slice that sees it, so it must exist before the first slice is
     * keyed.
     */
    const assets = await gatherEntryPictures({
      pin: RUN_CORPUS_PIN,
      entryId: entry.id,
      slices: prepared.slices,
      l: tagged({ tag: entry.id, },),
    },);

    /**
     * What each of those pictures says, corroborated across the two readers
     * that can be sent one.
     */
    const pictureReadings = await readDocumentPictures({
      readOcr: readImageWithOcr,
      client,
      slices: prepared.slices,
      assets,
      readerModelIds: RUN_READER_MODELS,
      cache: readingCache,
      signal: deadline.callSignal,
      perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      l: tagged({ tag: entry.id, },),
    },);

    /**
     * Semantic and deterministic proof for every source-only slice.
     *
     * BOUGHT BEFORE THE LANES so a known omission is either licensed for the
     * translate lane to fill or remains unfilled and trips the publication
     * guard. The coverage roster searches whole target, independent of pairing;
     * page shortfall or a missing destination supplies second corroboration.
     */
    const translateInsertionAdmission = await decidePassInsertionAdmission({
      client,
      prepared,
      modelIds: RUN_ROSTER,
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
      repairModels: RUN_MODELS,
      translateModels: RUN_TRANSLATE_MODELS,
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

    // A KNOWN GAP IS NOT A SETTLED PAGE. The translate lane records unfilled
    // source passages so a caller can choose whether to retain the archive's
    // omission. The corpus pass has no such choice: publishing that page would
    // knowingly omit source content, so it fails the entry and keeps every
    // bought slice in cache for a later attempt.
    /**
     * Source passages translation could not fill.
     */
    const { unfilled, } = lanes.translate;
    assertPublishableTranslation({
      entryId: entry.id,
      unfilled,
    },);

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
    const contestSlices = await contestDocumentLanes({
      client,
      projected,
      modelIds: RUN_ROSTER,
      frontMatterSlices,
      ...((prepared.identityContext === undefined)
        ? {}
        : { identityContext: prepared.identityContext, }),
      cache: await openLaneContestCache({
        dir: entryCacheDir,
        generation: pipelineDigest,
      },),
      signal: deadline.callSignal,
      perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      overlap,
      l: tagged({ tag: entry.id, },),
    },);

    /**
     * What the roster settled at every slice the contest left a standing text
     * at, which is the third rendering: a wording neither lane produced.
     *
     * BOUNDED BY THE ENTRY'S OWN SIGNAL and nothing narrower. The stage buys a
     * slate, one judging and one gate per slice, each already bounded by
     * `RUN_PER_CALL_TIMEOUT_MS` and by the client's stream guards. Each stable
     * settlement persists when it finishes, while a caller abort blocks that
     * write; under overlap, completion and persistence need not follow slice
     * order. A separate per-settlement ceiling would cut a round the per-call
     * bound already cuts and cost bought work. The entry ceiling is what stops
     * a document that is going nowhere.
     */
    const consolidateSlices = await consolidateDocument({
      client,
      projected,
      contests: contestSlices,
      modelIds: RUN_ROSTER,
      frontMatterSlices,
      lineStructuredSlices: prepared.lineStructuredSliceIndices,
      // THE SAME WINDOW THE TRANSLATE LANE WAS SHOWN, computed from the same
      // slices and the same readings. A producer asked to better a translation
      // should not be shown less of the passage than its translator was, and
      // until today it was shown none of it: the subject field existed, the
      // sheet rendered it, and no caller ever wrote it.
      pictureContextBySlice: slicePictureContexts({
        slices: prepared.slices,
        readings: pictureReadings,
      },),
      // THE WINDOW THE TRANSLATE LANE'S JUDGES GET, computed from the same
      // slices, for the consolidation's judges. Built here rather than in the
      // driver for the reason the picture map is: a window is POSITIONAL, found
      // by walking the prepared array, and the driver holds no prepared slices.
      neighbourContextBySlice: sliceNeighbourContexts({ slices: prepared.slices, },),
      ...((prepared.identityContext === undefined)
        ? {}
        : { identityContext: prepared.identityContext, }),
      cache: await openConsolidateCache({
        dir: entryCacheDir,
        generation: pipelineDigest,
      },),
      signal: deadline.callSignal,
      perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
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
      archiveText,
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
    publishDir,
    sliceCacheDir,
    tip,
    pipelineDigest,
    hardCapMs,
    baseSignal,
  }: {
    readonly client: SyntheticClient;
    readonly entry: CorpusPair;
    readonly artifactsDir: string;
    readonly publishDir: string;
    readonly sliceCacheDir: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly hardCapMs: number;
    readonly baseSignal: AbortSignal;
  },
): Promise<void> {
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
    console.log(`CLEANUP ${entry.id} cache=retained error=${tallyErrorText({ error, },)}`,);
  }
}

//endregion Pass entry
