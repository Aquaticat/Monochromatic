import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';


import {
  listCorpusPeople,
} from '../corpus-source.ts';
import {
  graceOverrideNote,
  resolveStragglerGraceMs,
} from '../grace-override.ts';
import { STRAGGLER_GRACE_MS, } from '../stage-round.ts';
import {
  type AttemptMap,
  readAttemptMap,
} from './attempt-store.ts';
import {
  countSettledPerBand,
  rankWithinBands,
  smallBandIds,
} from './band-order.ts';
import { readOnlyIds, } from './entry-filter.ts';
import { collectEligiblePairs, } from './pass-eligibility.ts';
import type { EntryOutcome, } from './pass-entry-contract.ts';
import {
  settleEntry,
} from './pass-entry.ts';
import { FIXED_TREE_DIR, } from './publish-fixed.ts';
import {
  assertArtifactsPlaceable,
  assertBuildGenerationResumable,
} from './pass-generation-guard.ts';
import { assertResumableSchemaGeneration, } from './pass-schema-guard.ts';
import {
  countSettled,
  artifactBackedIds,
} from './pass-settled.ts';
import { digestPipeline, } from './pipeline-digest.ts';
import {
  capOutlastsOneCall,
  capTooTightNote,
  HARD_CAP_VAR,
  resolveHardCapMinutes,
} from './cap-override.ts';
import { runAttemptQueue, } from './entry-attempt-queue.ts';
import { countCachedSlices, } from './entry-reattempt.ts';
import { lockRunsDir, } from './runs-lock.ts';
import { listResumableEntries, } from './slice-cache-store.ts';
import {
  createRunClient,
  readHeadSha,
  resolveRunsDir,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import {
  assertRequiredProvidersReady,
  readRequiredProviders,
} from './required-providers.ts';

//region Corpus pass
// Runs the pipeline over every complete zh/en corpus pair at the pinned commit,
// one entry at a time: skips entries that already have an artifact, orders the
// rest to resume cached progress first, then interleave the size bands by
// within-band rank so coverage fills evenly (then fewest-attempts-first), and
// stops starting new entries at the soft budget while a per-entry hard ceiling
// aborts an entry that overruns. Each settled
// entry writes one JSON artifact and one TALLY line. Run it with `mise run
// //package/module/translation-repair:corpus-pass` (append `-- --plan` for a
// zero-quota setup check).

/**
 * Minutes expressed in milliseconds, for the wall-time budgets.
 */
const MS_PER_MINUTE = 60_000;

/**
 * Minutes of wall time after which no new entry starts.
 *
 * Was 25, which throttled the whole accumulation to about one entry per launch.
 * The interaction that caused it: `BANDS` puts the large band first within a
 * rank, so a run starts a large entry, that entry alone runs past 25 minutes,
 * and this check then refuses to start anything else. Runs 010 and 011 both
 * show exactly that, one settling a single entry and one settling none.
 *
 * A long budget lets a run chain several entries instead. It is scheduling
 * only: it changes when a run stops starting work, never what the pipeline
 * finds, so unlike the per-call deadline it can move without splitting the pool
 * into incomparable cohorts. The per-entry hard cap still bounds any single
 * runaway, and slice-level resumability means an entry cut by that cap resumes
 * on the next run rather than restarting.
 *
 * Raised from 240 alongside the hard cap, and for the same measured reason.
 * Recall run 001 spent 252 minutes settling SEVEN of nine entries under a
 * four-hour budget and recorded the other two as skipped, coverage 0.778. The
 * ensemble and the naturalness lane only make each entry slower, so holding
 * 240 would have shrunk that further. Twelve hours leaves room for a full
 * nine-entry pass.
 *
 * A skipped entry is lost coverage in the verdict, not saved money: the plan
 * is flat rate, quota regenerates faster than runs spend, and the user
 * confirmed cost does not matter.
 *
 * Raised from 720 because twelve hours could not clear the corpus in ONE
 * invocation, and every extra invocation was fragmenting the pool. Measured
 * from artifact mtimes across an evening: about 27 minutes per entry over a
 * clean stretch and about 53 averaged over a whole span including stalls. At
 * 92 pending entries that is 41 to 81 hours, so a twelve-hour budget settles
 * roughly 13 to 26 and stops, and reaching the full corpus needs four to seven
 * resumes. Each resume re-reads HEAD, so under a policy of restarting whenever
 * a fix lands, each one stamped a new commit: that is precisely how one
 * directory came to hold 22 entries across four tips.
 *
 * Three days covers the pessimistic rate with room to spare. It is not a
 * prediction that a run will take three days; `assertResumableGeneration` is
 * what protects the pool now, and this only stops the BUDGET from being the
 * thing that forces a fragmenting resume.
 */
const SOFT_BUDGET_MINUTES = 4_320;

/**
 * Minutes of wall time ONE entry may run before its exchanges abort.
 * Per entry, not per run: the ceiling was previously armed once for the
 * whole loop, so an entry that started near the soft budget got only the
 * remaining sliver, and Arita (12 slices, ~68 min) could never finish. A
 * fresh timer per entry gives each its full budget regardless of start
 * time. Entries far larger than the cap clears (aiyysk 77 slices,
 * hulicaijia 65, ...) still exceed any single-run ceiling and need
 * slice-level resumability, tracked separately.
 *
 * Raised from 90 on measurement rather than on feel. Recall run 001 timed
 * seven entries end to end: per-slice rate ran 3.25 min at best, 5.56 at the
 * median, and 8.56 at the worst, and its longest entry took 74.7 minutes for
 * 12 slices. The old 90 was therefore ALREADY marginal before this branch
 * changed anything: at the worst observed rate a 12-slice entry needs 103
 * minutes and would have been cut. The measured median also confirms the
 * ~5.5 min/slice figure the old comment claimed.
 *
 * That rate is PRE-ENSEMBLE. It predates per-envelope judge rounds, the
 * chunk-level round, and the whole naturalness lane, every one of which only
 * adds. How much they add is unmeasured, so this is a bound against runaway
 * rather than a tuned value: 180 clears 21 slices even at the worst observed
 * rate, and 32 at the median.
 *
 * Cost is not the constraint being traded here. The plan is flat rate and
 * quota regenerates faster than runs spend, and the user confirmed cost does
 * not matter, so the thing a low cap actually costs is entries covered per
 * run. Slice-level resumability means a capped entry resumes next run, so a
 * generous cap risks wall time and never work.
 */
const HARD_CAP_MINUTES = 420;

// RAISED FROM 180 TO 420 on 2026-08-17, on `#114`'s measurement rather than on
// the reasoning above, which had only a bound against runaway to offer. `#114`
// timed the two-lane shape end to end and found 4 to 6 entries hitting the
// 180-minute cap, all of them clearing at 7 hours. Every argument in the
// paragraph above points the same way: cost is not the constraint, slice-level
// resumability means a capped entry resumes rather than dies, so the cap buys
// nothing except a shorter run and costs entries covered by it.

/**
 * Soft budget in milliseconds.
 */
const SOFT_BUDGET_MS = SOFT_BUDGET_MINUTES * MS_PER_MINUTE;

/**
 * Hard ceiling in milliseconds, after any environment override.
 *
 * OVERRIDABLE so the re-attempt queue can be exercised against an entry that
 * fits in one run: the queue only does anything to an entry the cap CUTS, and
 * the shipped ceiling means the smallest such entry needs thirteen hours.
 * `cap-override.ts` carries why an unreadable override throws.
 */
const HARD_CAP_MS = resolveHardCapMinutes({ fallback: HARD_CAP_MINUTES, },)
  * MS_PER_MINUTE;

/**
 * Complete zh/en pairs present at the pinned commit; the run target.
 */
const CORPUS_PAIR_TARGET = 92;

/**
 * Entry ids previewed on the `--plan` line.
 */
const PLAN_PREVIEW_COUNT = 5;

/**
 * Runs one accumulation pass over the corpus, writing artifacts and TALLY lines.
 * Reads config and the API key from the environment; performs model calls unless
 * `--plan` is passed, which verifies setup at zero quota and returns.
 *
 * @throws {@link Error} when the API key env var is unset
 *
 * @example
 * ```ts
 * await runCorpusPass();
 * ```
 */
async function runCorpusPass(): Promise<void> {
  /**
   * Note naming the straggler window when it is not the built-in one.
   *
   * RESOLVED FIRST, before the lock and before anything is read, so an
   * unreadable override refuses the pass before it claims a directory or
   * spends anything. Printed after START, where the cap note is.
   */
  const graceNote = graceOverrideNote({
    effectiveMs: resolveStragglerGraceMs({ fallback: STRAGGLER_GRACE_MS, },),
    builtInMs: STRAGGLER_GRACE_MS,
  },);

  /**
   * Durable, gitignored output root for this run.
   */
  const runsDir = await resolveRunsDir();

  // Taken before anything is read, and held for the whole pass. Two passes
  // sharing one directory overwrite each other attempt counts, delete each
  // other cached slices whenever their pipelines differ, and the later write of
  // any entry replaces the earlier one, all of it looking like ordinary output.
  /**
   * Exclusive claim on this runs directory, released when the pass returns.
   */
  await using _lock = await lockRunsDir({ runsDir, },);

  /**
   * Per-entry artifact directory.
   */
  const artifactsDir = join(
    runsDir,
    'artifacts',
  );
  await mkdir(
    artifactsDir,
    { recursive: true, },
  );

  /**
   * Root of the corpus tree this pass publishes its fixed pages into.
   *
   * BESIDE THE ARTIFACTS, under the same runs directory, so a tree carrying
   * corpus wording inherits the property that keeps that wording safe: runs
   * directories live outside this repository and are never committed. It also
   * means a throwaway run publishes into a throwaway tree rather than over
   * anything real.
   *
   * CREATED HERE rather than lazily at the first page, so a pass that settles
   * no entry still leaves the empty tree it promised rather than nothing.
   */
  const publishDir = join(
    runsDir,
    FIXED_TREE_DIR,
  );
  await mkdir(
    publishDir,
    { recursive: true, },
  );

  /**
   * Root of per-entry slice caches making large documents resumable.
   */
  const sliceCacheDir = join(
    runsDir,
    'slice-cache',
  );

  /**
   * Persisted attempt-count map path.
   */
  const attemptsPath = join(
    runsDir,
    'attempts.json',
  );

  /**
   * Pipeline tip recorded into every artifact.
   */
  const tip = await readHeadSha();

  /**
   * Identity of the built pipeline this invocation is running, taken over the
   * directory the runner was loaded from.
   *
   * `tip` cannot answer this and never could: it moves for a documentation
   * commit that changes nothing that runs, and stays put across an uncommitted
   * edit that changes everything. Every corpus-run task builds before it runs
   * and runs its built file, so the files beside this one ARE the pipeline.
   */
  const {
    digest: pipelineDigest,
    fileCount,
  } = await digestPipeline({ dir: import.meta.dirname, },);

  // Before anything is settled: a resume builds again, so if anything that runs
  // changed since the entries already here were written, continuing would stamp
  // a second pipeline into one pool and every reader that computes a rate would
  // then refuse the lot.
  /**
   * What every placeable artifact records, read once for both guards.
   *
   * THE THREE REFUSALS RUN IN ORDER OF HOW LITTLE CHOICE THE OPERATOR HAS.
   * First an artifact nothing can place, which no opt-in is an opinion about.
   * Then the SHAPE, which no commit can reconcile. Only then the BUILD, whose
   * refusal is overridable and whose message says so; running that one first
   * offered an operator an opt-in that the shape check then refused anyway, so
   * the advice was a lie and the second run logged a resume that never
   * happened.
   */
  const generationCensus = await assertArtifactsPlaceable({ artifactsDir, },);
  await assertResumableSchemaGeneration({ artifactsDir, },);
  assertBuildGenerationResumable({
    census: generationCensus,
    digest: pipelineDigest,
  },);

  /**
   * Entry ids already carrying an artifact this pass.
   */
  const done = await artifactBackedIds({ artifactsDir, },);

  /**
   * Attempt counts from prior runs, or empty on the first.
   */
  const attempts: AttemptMap = await readAttemptMap(attemptsPath,);

  /**
   * Every person id at the pinned commit.
   */
  const people = await listCorpusPeople({ pin: RUN_CORPUS_PIN, },);

  /**
   * Entry ids this invocation is restricted to, empty when unrestricted.
   */
  const onlyIds = readOnlyIds({ argv: process.argv, },);
  if (onlyIds.size > 0) {
    /**
     * Chosen ids in a stable order, so two runs of one selection log alike.
     */
    const chosen = [...onlyIds,]
      .toSorted()
      .join(',',);

    console.log(
      `ONLY ${chosen} (ordering is bypassed; run `
        + 'this into a throwaway TRANSLATION_REPAIR_RUNS_DIR so a hand-picked '
        + 'entry never enters a pool later draws treat as natural accumulation)',
    );
  }

  /**
   * Encoder measuring page-source byte size once per entry.
   */
  const sizer = new TextEncoder();

  /**
   * Complete unsettled pairs, already-settled sizes (ordering needs these:
   * ranking runs over the REMAINING entries, so without knowing what each band
   * already settled every run would restart each band at rank zero), and the
   * entries missing a side at the pin.
   *
   * ONLY A MISSING OBJECT DROPS OUT, and it is printed. Any other read
   * failure propagates: until 2026-08-26 every read failure read as the
   * expected missing side, so a clone that had gone away shrank the corpus
   * to nothing without a line saying so.
   */
  const {
    eligible,
    settled,
    incomplete,
  } = await collectEligiblePairs({
    ids: (onlyIds.size === 0)
      ? people
      : people.filter(function isChosen(candidate,): boolean {
        return onlyIds.has(candidate,);
      },),
    done,
    pin: RUN_CORPUS_PIN,
  },);
  for (const gap of incomplete)
    console.log(`INCOMPLETE ${gap.id}: ${gap.side} page absent at the pin (${gap.detail})`,);

  /**
   * Every eligible entry reduced to its id and page-source byte size, measured
   * once so ordering never re-encodes text on a compare.
   */
  const sized = eligible.map(function toSized(entry,) {
    return {
      id: entry.id,
      sourceBytes: sizer.encode(entry.sourceText,)
        .length,
    };
  },);

  /**
   * Ids whose page source is under the small-band cut.
   */
  const smallIds = smallBandIds({ entries: sized, },);

  /**
   * Each entry's rank within its own size band, so ordering interleaves the
   * bands instead of draining one before starting the next. Rationale for
   * interleaving lives in `band-order.ts`.
   */
  const bandRank = rankWithinBands({
    entries: sized,
    settledPerBand: countSettledPerBand({ entries: settled, },),
  },);

  /**
   * Ids with cached slices from an earlier aborted run. These resume first so
   * an in-flight large document finishes before a fresh entry starts, rather
   * than every large entry taking one partial attempt while none settles.
   *
   * NO PROGRESS GUARANTEE IS CLAIMED HERE, and one used to be: this said a
   * cap-abort always completes at least one new slice, which is false. An abort
   * can land before the first persistence, and the slices a lane deliberately
   * leaves uncached, the unfilled and the unheard, produce no cache entry
   * however long they took. What actually bounds it is that a stuck entry
   * surfaces: `repairChunk` degrades and persists rather than throwing on a
   * lost quorum, the translate lane's refusal counter bounds its retries within
   * a slice, and an entry that keeps failing writes a repeated same-entry ERROR
   * line across runs, which is read by inspection.
   */
  const resumableIds = await listResumableEntries({ dir: sliceCacheDir, },);

  /**
   * Pending entries: cached progress resumes first, then the bands interleave
   * by within-band rank so coverage fills evenly, then the larger band leads
   * within one rank (a large entry may need a second run, so starting it
   * earlier costs nothing), then fewest attempts first so flaky ones
   * deprioritize.
   */
  const pending = eligible.toSorted(function byResumeThenBandThenAttempts(
    a,
    b,
  ) {
    /**
     * Negative when only `a` has cached progress (so it resumes first),
     * positive when only `b` does; zero when neither or both do.
     */
    const resumeDelta = Number(resumableIds.has(b.id,),)
      - Number(resumableIds.has(a.id,),);
    if (resumeDelta !== 0)
      return resumeDelta;
    /**
     * Difference in within-band rank. Interleaving on this fills every band
     * at the same pace, so the tenth entry of each band arrives at roughly
     * the same time rather than one band starving.
     */
    const rankDelta = (bandRank.get(a.id,) ?? 0) - (bandRank.get(b.id,) ?? 0);
    if (rankDelta !== 0)
      return rankDelta;

    /**
     * Within one rank, the larger band goes first: a large entry may need a
     * second run to settle, so starting it earlier costs nothing and lets it
     * resume sooner.
     */
    const bandDelta = Number(smallIds.has(a.id,),)
      - Number(smallIds.has(b.id,),);
    if (bandDelta !== 0)
      return bandDelta;
    return (attempts[a.id] ?? 0) - (attempts[b.id] ?? 0);
  },);

  console.log(
    `START tip=${tip} pipeline=${pipelineDigest} files=${String(fileCount,)} pending=${String(pending.length,)} done=${String(done.size,)} soft=${String(SOFT_BUDGET_MS,)}ms hard=${String(HARD_CAP_MS,)}ms`,
  );

  // A run must never hide which ceiling it ran under: an artifact settled below
  // a lowered cap is not comparable with one settled under the shipped one.
  if (HARD_CAP_MS !== (HARD_CAP_MINUTES * MS_PER_MINUTE)) {
    console.log(
      `CAP OVERRIDDEN by ${HARD_CAP_VAR}: entries run under ${
        String(HARD_CAP_MS / MS_PER_MINUTE,)
      } minutes rather than the built-in ${String(HARD_CAP_MINUTES,)}`,
    );
  }

  // Nor which straggler window, for the same reason: rounds under a longer
  // window hear voices the shipped window cuts, and their artifacts are not
  // comparable with ones settled under it.
  if (graceNote !== '')
    console.log(graceNote,);

  if (!capOutlastsOneCall({
    capMs: HARD_CAP_MS,
    perCallMs: RUN_PER_CALL_TIMEOUT_MS,
  },)) {
    console.log(capTooTightNote({
      capMs: HARD_CAP_MS,
      perCallMs: RUN_PER_CALL_TIMEOUT_MS,
    },),);
  }

  /**
   * Providers validation or performance arm explicitly requires wet.
   */
  const requiredProviders = readRequiredProviders({ argv: process.argv, },);
  await assertRequiredProvidersReady({
    required: requiredProviders,
    signal: new AbortController().signal,
  },);
  if (requiredProviders.length > 0) {
    console.log(`REQUIRED-PROVIDERS ${requiredProviders.join(',',)} status=wet`,);
  }

  /**
   * Shared client using measured production provider concurrency.
   */
  const client = createRunClient({
    promptPayloadDir: join(
      runsDir,
      'prompt-payloads',
    ),
  },);

  if (process.argv
    .includes('--plan',)) {
    console.log(
      `PLAN ok tip=${tip} pipeline=${pipelineDigest} client=constructed pending=${String(pending.length,)} first=${
        pending
          .slice(
            0,
            PLAN_PREVIEW_COUNT,
          )
          .map(function toPlanId(entry,) {
            return entry.id;
          },)
          .join(',',)
      }`,
    );
    return;
  }

  /**
   * Wall-clock start of the processing loop.
   */
  const start = Date.now();

  /**
   * Shared base signal each entry's deadline forwards from; the driver
   * never aborts it, so only a per-entry timeout ever fires.
   */
  const neverAbort = new AbortController().signal;

  await runAttemptQueue({
    pending,

    cachedCountFor: function cachedCountFor({ entry, },): Promise<number> {
      return countCachedSlices({
        dir: join(
          sliceCacheDir,
          entry.id,
        ),
      },);
    },

    stopBeforeNext: function stopBeforeNext(): boolean {
      /**
       * Wall time elapsed since the loop began.
       */
      const elapsed = Date.now() - start;

      if (elapsed < SOFT_BUDGET_MS)
        return false;
      console.log(`SOFT budget reached after ${String(elapsed,)}ms; not starting new entries`,);
      return true;
    },

    attempt: async function attempt({ entry, },): Promise<EntryOutcome> {
      attempts[entry.id] = (attempts[entry.id] ?? 0) + 1;
      // Persisted before the attempt so a crash still records that it happened.
      await writeFile(
        attemptsPath,
        `${JSON.stringify(
          attempts,
          undefined,
          2,
        )}\n`,
      );

      return settleEntry({
        client,
        entry,
        artifactsDir,
        publishDir,
        sliceCacheDir,
        tip,
        pipelineDigest,
        hardCapMs: HARD_CAP_MS,
        baseSignal: neverAbort,
      },);
    },
  },);

  /**
   * Artifacts present after this run, against the pair target.
   */
  const total = await countSettled({ artifactsDir, },);

  /**
   * New artifacts written this run: every settled entry adds one, and only
   * not-yet-done entries were eligible.
   */
  const processed = total - done.size;
  console.log(
    `DONE processed=${String(processed,)} of pending=${String(pending.length,)}; artifacts=${String(total,)}/${String(CORPUS_PAIR_TARGET,)} elapsed=${String(Date.now() - start,)}ms`,
  );
}

if (import.meta.main)
  await reportingRefusals({
    what: 'corpus-pass',
    run: runCorpusPass,
  },);

//endregion Corpus pass
