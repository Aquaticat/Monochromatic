import {
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { armCallDeadline, } from '../call-deadline.ts';
import {
  CorpusReadError,
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import {
  type AttemptMap,
  readAttemptMap,
} from './attempt-store.ts';
import {
  countSettledPerBand,
  rankWithinBands,
  type SizedEntry,
  smallBandIds,
} from './band-order.ts';
import { repairTranslation, } from '../repair-translation.ts';
import {
  discardSliceCache,
  listResumableEntries,
  openSliceCache,
} from './slice-cache-store.ts';
import {
  createRunClient,
  readHeadSha,
  resolveRunsDir,
  RUN_CALL_CONFIG,
  RUN_CORPUS_PIN,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

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
 */
const SOFT_BUDGET_MINUTES = 720;

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
const HARD_CAP_MINUTES = 180;

/**
 * Soft budget in milliseconds.
 */
const SOFT_BUDGET_MS = SOFT_BUDGET_MINUTES * MS_PER_MINUTE;

/**
 * Hard ceiling in milliseconds.
 */
const HARD_CAP_MS = HARD_CAP_MINUTES * MS_PER_MINUTE;

/**
 * Complete zh/en pairs present at the pinned commit; the run target.
 */
const CORPUS_PAIR_TARGET = 92;

/**
 * Characters of an error message kept in a TALLY line.
 */
const ERROR_MESSAGE_CAP = 200;

/**
 * Entry ids previewed on the `--plan` line.
 */
const PLAN_PREVIEW_COUNT = 5;

/**
 * One eligible corpus pair with its text loaded.
 */
type CorpusPair = {
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
 * Whether a directory entry name is one of our artifact files.
 *
 * @param name - directory entry name
 *
 * @returns True for `*.json` artifacts
 *
 * @example
 * ```ts
 * const artifacts = names.filter(isArtifactFile,);
 * ```
 */
function isArtifactFile(name: string,): boolean {
  return name.endsWith('.json',);
}

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
   * Durable, gitignored output root for this run.
   */
  const runsDir = await resolveRunsDir();

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
   * Entry ids already carrying an artifact this pass.
   */
  const done = new Set(
    (await readdir(artifactsDir,))
      .filter(isArtifactFile,)
      .map(function toId(name,) {
        return name.slice(
          0,
          -'.json'.length,
        );
      },),
  );

  /**
   * Attempt counts from prior runs, or empty on the first.
   */
  const attempts: AttemptMap = await readAttemptMap(attemptsPath,);

  /**
   * Every person id at the pinned commit.
   */
  const people = await listCorpusPeople({ pin: RUN_CORPUS_PIN, },);

  /**
   * Encoder measuring page-source byte size once per entry.
   */
  const sizer = new TextEncoder();

  /**
   * Complete unsettled pairs; a missing side (only `tdor` here) drops out.
   */
  const eligible: CorpusPair[] = [];

  /**
   * Already-settled entries reduced to their sizes. Ordering needs these:
   * ranking runs over the REMAINING entries, so without knowing what each band
   * already settled every run would restart each band at rank zero and hand
   * itself to the same band forever.
   */
  const settled: SizedEntry[] = [];
  for (const id of people) {
    try {
      /**
       * Original zh page text for this entry.
       */
      /* oxlint-disable-next-line no-await-in-loop -- corpus reads are sequential git shows; the list is small and this runs once at setup */
      const sourceText = await readCorpusFile({
        pin: RUN_CORPUS_PIN,
        relPath: `people/${id}/page.md`,
      },);

      /**
       * Page-source size deciding this entry's band.
       */
      const sourceBytes = sizer.encode(sourceText,)
        .length;
      if (done.has(id,)) {
        settled.push({
          id,
          sourceBytes,
        },);
        continue;
      }

      /**
       * Translated en page text for this entry.
       */
      /* oxlint-disable-next-line no-await-in-loop -- pairs with its source read above; ordering is intentional */
      const targetText = await readCorpusFile({
        pin: RUN_CORPUS_PIN,
        relPath: `people/${id}/page.en.md`,
      },);
      eligible.push({
        id,
        sourceText,
        targetText,
      },);
    }
    catch (error) {
      // A missing side (only `tdor` at this commit) is an expected non-pair;
      // any other read failure is a real fault and must surface.
      if (!(error instanceof CorpusReadError))
        throw error;
    }
  }

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
   * `repairChunk` degrades-and-persists (no throw on a lost quorum) and a
   * cap-abort always completes at least one new slice, so resume-first cannot
   * livelock on a stuck slice; a deterministic slice throw would surface as a
   * repeated same-entry ERROR across runs and is handled by inspection.
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
    `START tip=${tip} pending=${String(pending.length,)} done=${String(done.size,)} soft=${String(SOFT_BUDGET_MS,)}ms hard=${String(HARD_CAP_MS,)}ms`,
  );

  /**
   * Shared client; per-model concurrency defaults to one.
   */
  const client = createRunClient();

  if (process.argv
    .includes('--plan',)) {
    console.log(
      `PLAN ok tip=${tip} client=constructed pending=${String(pending.length,)} first=${
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

  for (const entry of pending) {
    /**
     * Wall time elapsed since the loop began.
     */
    const elapsed = Date.now() - start;
    if (elapsed >= SOFT_BUDGET_MS) {
      console.log(`SOFT budget reached after ${String(elapsed,)}ms; not starting new entries`,);
      break;
    }

    attempts[entry.id] = (attempts[entry.id] ?? 0) + 1;
    /* oxlint-disable-next-line no-await-in-loop -- attempt count persists before each attempt so a crash still records it; sequential by design */
    await writeFile(
      attemptsPath,
      `${JSON.stringify(
        attempts,
        undefined,
        2,
      )}\n`,
    );

    /**
     * Per-entry slice-cache directory; earlier runs' finished slices live
     * here so a large document resumes instead of restarting.
     */
    const entryCacheDir = join(
      sliceCacheDir,
      entry.id,
    );

    /**
     * Cross-run cache resuming finished slices and persisting new ones as
     * each slice completes.
     */
    /* oxlint-disable-next-line no-await-in-loop -- per-entry setup, sequential by design */
    const sliceCache = await openSliceCache({ dir: entryCacheDir, },);

    /**
     * Start time of this entry, for its duration.
     */
    const t0 = Date.now();

    /**
     * Per-entry hard-cap deadline. Disposal at the loop-iteration end
     * defuses the timer and detaches its listener; the repo bans
     * try/finally, so cleanup rides on `using` instead.
     */
    using deadline = armCallDeadline({
      signal: neverAbort,
      timeoutMs: HARD_CAP_MS,
      label: entry.id,
    },);
    try {
      /**
       * Repair result for this entry.
       */
      /* oxlint-disable-next-line no-await-in-loop -- entries run sequentially by design: aggregate concurrency beyond one stream per model collapses throughput on this plan */
      const result = await repairTranslation({
        client,
        sourceText: entry.sourceText,
        targetText: entry.targetText,
        models: RUN_MODELS,
        signal: deadline.callSignal,
        perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
        sliceCache,
      },);

      /**
       * Wall time this entry took.
       */
      const durationMs = Date.now() - t0;

      /**
       * Accepted issues among all adjudicated.
       */
      const accepted = result.issues
        .filter(function isAccepted(record,) {
        return record.issue
          .status
          === 'accepted';
      },);

      /**
       * Accepted issues the checkers confirmed fixed.
       */
      const resolved = accepted.filter(function isResolved(record,) {
        return record.resolved;
      },);

      /**
       * Rich artifact for later grading; corpus-derived, hence gitignored.
       */
      const artifact = {
        id: entry.id,
        tip,
        corpusSha: RUN_CORPUS_PIN.commitSha,
        callConfig: RUN_CALL_CONFIG,
        status: result.status,
        durationMs,
        timestamp: new Date().toISOString(),
        sourceChars: entry.sourceText
          .length,
        targetChars: entry.targetText
          .length,
        issueCount: result.issues
          .length,
        acceptedCount: accepted.length,
        resolvedCount: resolved.length,
        findings: result.findings,
        issues: result.issues,
        repairedText: result.repairedText,
      };
      /* oxlint-disable-next-line no-await-in-loop -- one artifact written per entry, sequential by design */
      await writeFile(
        join(
          artifactsDir,
          `${entry.id}.json`,
        ),
        `${JSON.stringify(
          artifact,
          undefined,
          2,
        )}\n`,
      );
      console.log(
        `TALLY ${entry.id} status=${result.status} issues=${String(result.issues
          .length,)} accepted=${String(accepted.length,)} resolved=${String(resolved.length,)} findings=${String(result.findings
            .length,)} ms=${String(durationMs,)}`,
      );

      // The entry settled, so its slice cache is spent; drop it to keep the
      // cache directory bounded to in-flight large documents.
      /* oxlint-disable-next-line no-await-in-loop -- per-entry cleanup, sequential by design */
      await discardSliceCache({ dir: entryCacheDir, },);
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
    }
  }

  /**
   * Artifacts present after this run, against the pair target.
   */
  const total = (await readdir(artifactsDir,)).filter(isArtifactFile,)
    .length;

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
  await runCorpusPass();

//endregion Corpus pass
