import {
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  CorpusReadError,
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { isJsonRecord, } from '../json-guard.ts';
import { repairTranslation, } from '../repair-translation.ts';
import {
  createRunClient,
  readHeadSha,
  resolveRunsDir,
  RUN_CORPUS_PIN,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Corpus pass
// Runs the pipeline over every complete zh/en corpus pair at the pinned commit,
// one entry at a time: skips entries that already have an artifact, orders the
// rest fewest-attempts-first, and stops starting new entries at the soft budget
// while a hard ceiling aborts any in-flight exchange. Each settled entry writes
// one JSON artifact and one TALLY line. Run it with `mise run
// //package/module/translation-repair:corpus-pass` (append `-- --plan` for a
// zero-quota setup check).

/**
 * Minutes expressed in milliseconds, for the wall-time budgets.
 */
const MS_PER_MINUTE = 60_000;

/**
 * Minutes of wall time after which no new entry starts.
 */
const SOFT_BUDGET_MINUTES = 25;

/**
 * Minutes of wall time after which every in-flight exchange aborts.
 */
const HARD_CAP_MINUTES = 45;

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
 * Attempt counts keyed by entry id, for fewest-attempts-first ordering.
 */
type AttemptMap = Record<string, number>;

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
 * Reads the persisted attempt map, tolerating a missing or malformed file so a
 * corrupt cache never aborts a run.
 *
 * @param attemptsPath - location of the attempts JSON
 *
 * @returns Entry-id to attempt-count map, empty when absent or unreadable
 *
 * @example
 * ```ts
 * const attempts = await readAttemptMap('/runs/attempts.json',);
 * ```
 */
async function readAttemptMap(attemptsPath: string,): Promise<AttemptMap> {
  try {
    /**
     * Parsed JSON of unknown shape until guarded.
     */
    const parsed: unknown = JSON.parse(await readFile(
      attemptsPath,
      'utf8',
    ),);
    if (!isJsonRecord(parsed,))
      return {};

    return Object.fromEntries(
      Object.entries(parsed,)
        .map(function toCount(
          [id, value,]: readonly [
            string,
            unknown,
          ],
        ): readonly [
          string,
          number,
        ] {
          return [
            id,
            (typeof value) === 'number' ? value : 0,
          ];
        },),
    );
  }
  catch (error) {
    // Missing (ENOENT) or malformed (SyntaxError) cache resets to empty;
    // any other read fault is real and must surface.
    if ((Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      || (error instanceof SyntaxError))
      return {};
    throw error;
  }
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
   * Complete unsettled pairs; a missing side (only `tdor` here) drops out.
   */
  const eligible: CorpusPair[] = [];
  for (const id of people) {
    if (done.has(id,))
      continue;
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
   * Pending entries, fewest attempts first so flaky ones deprioritize.
   */
  const pending = eligible.toSorted(function byAttempts(
    a,
    b,
  ) {
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
   * Aborts every in-flight exchange at the hard ceiling.
   */
  const controller = new AbortController();

  /**
   * Timer arming the hard-ceiling abort; cleared when the loop ends.
   */
  const hardTimer = setTimeout(
    function abortAtCap() {
      controller.abort();
    },
    HARD_CAP_MS,
  );

  for (const entry of pending) {
    /**
     * Wall time elapsed since the loop began.
     */
    const elapsed = Date.now() - start;
    if (elapsed >= SOFT_BUDGET_MS) {
      console.log(`SOFT budget reached after ${String(elapsed,)}ms; not starting new entries`,);
      break;
    }
    if (controller.signal
      .aborted)
      break;

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
     * Start time of this entry, for its duration.
     */
    const t0 = Date.now();
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
        signal: controller.signal,
        perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
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
    }
    catch (error) {
      /**
       * Wall time before this entry failed.
       */
      const durationMs = Date.now() - t0;

      /**
       * Whether the hard-ceiling abort fired.
       */
      const { aborted, } = controller.signal;

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
      if (aborted)
        break;
    }
  }

  clearTimeout(hardTimer,);

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
