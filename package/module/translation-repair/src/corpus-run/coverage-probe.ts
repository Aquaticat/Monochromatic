import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { listCoverageCandidates, } from '../coverage-candidates.ts';
import { runCoverageStage, } from '../coverage-stage.ts';
import { parseDocument, } from '../parse-document.ts';
import { digestPipeline, } from './pipeline-digest.ts';
import { persistProbeRun, } from './probe-store.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';

//region Coverage probe
// PROTOTYPE for question 28: can a roster tell a passage the translation merged
// from one it never rendered.
//
// WHAT IT MEASURES AND WHY IT IS WORTH QUOTA. `#106` established that neither
// aligner produces evidence of absence, at either scale, and that the
// deterministic substitutes are exhausted: heading Latin, section length and
// distinctive body tokens were each measured and none of them separates a
// translated passage from an absent one when the two sides share no characters.
// What is left is semantic. This asks the semantic question directly, over the
// passages the aligners actually refuse, and records what came back so the
// answer to question 28 rests on a measurement rather than on an expectation.
//
// IT DECIDES NOTHING. No slicing, no artifact and no lane reads its output.
//
// IT DOES KEEP ITS ANSWERS, which it did not always. It used to print rows to
// standard output and write nothing, on the reasoning that a caller would
// redirect them wherever the measurement was being kept. Nobody did, and both
// scales were probed on 2026-08-16 at real quota cost: `#106` records that
// those numbers "survive only in session transcripts". Every run now lands in
// the runs directory under `coverage-probe/` as well, carrying the corpus pin,
// the roster and the pipeline digest that produced it.
//
// AND THAT REDIRECT WOULD NOT HAVE WORKED ANYWAY, which is worth knowing
// because it is why the file is the answer rather than better discipline.
// Measured at the boundary on 2026-08-17: this module's tagged logger writes to
// STANDARD OUTPUT, the same stream the rows JSON goes to, and it logs a line
// per candidate as it goes. So `coverage-probe > rows.json` yields progress
// lines wrapped around a JSON document, which no parser accepts. The rows have
// never been recoverable that way for any run that actually probed anything.
//
// STANDARD OUTPUT IS OTHERWISE UNCHANGED and gains only the line saying where
// the file went, so nothing a caller does today breaks.

/**
 * How many candidates one invocation asks about by default.
 *
 * Small on purpose: the first run of anything that spends quota should be
 * readable in full before a larger one is bought.
 *
 * COUNTED IN ATTEMPTS RATHER THAN IN ROWS, because a cap on successes lets a
 * failing roster spend without bound and hides the failures from the count a
 * reader checks.
 */
const DEFAULT_CANDIDATE_CAP = 12;

/**
 * Both sides of one entry, or the fact that it has only one.
 */
type PairRead = {
  /**
   * Both files were there.
   */
  readonly kind: 'read';

  /**
   * Original document text.
   */
  readonly source: string;

  /**
   * Translation document text.
   */
  readonly target: string;
} | {
  /**
   * One side is absent, which is an incomplete entry rather than a fault.
   */
  readonly kind: 'missing';
};

/**
 * One candidate's question and what came back.
 */
type ProbeRow = {
  /**
   * Corpus entry the passage belongs to.
   */
  readonly entryId: string;

  /**
   * Whether a whole section or one block was refused.
   */
  readonly scale: string;

  /**
   * Where the passage sits, for reading beside the censuses.
   */
  readonly where: string;

  /**
   * Passage length, since a long one is a different question from a line.
   */
  readonly sourceChars: number;

  /**
   * What the roster concluded.
   */
  readonly kind: string;

  /**
   * Voices that anchored full coverage in the document.
   */
  readonly anchoredFull: number;

  /**
   * Voices that anchored partial coverage.
   */
  readonly anchoredPartial: number;

  /**
   * Voices reporting nothing renders it.
   */
  readonly absent: number;

  /**
   * Voices whose quote was not in the document.
   */
  readonly unanchored: number;

  /**
   * Voices heard at all.
   */
  readonly heard: number;

  /**
   * Models asked, which the verdict threshold is taken over.
   */
  readonly asked: number;

  /**
   * Quotes claimed and not found, kept because a near miss and an invention are
   * different failures that the counts alone cannot tell apart.
   */
  readonly unanchoredQuotes: readonly string[];

  /**
   * Anchored quotes, so a reader can check the verdict against the archive.
   */
  readonly evidence: readonly string[];

  /**
   * Roster degradation findings, empty when quorum was met.
   */
  readonly findings: readonly string[];
};

/**
 * Reads the entry filter and cap from the command line.
 *
 * @returns Entry ids to probe, empty for every entry, and the candidate cap
 *
 * @example
 * ```ts
 * const { onlyIds, cap, } = readArguments();
 * ```
 */
function readArguments(): {
  readonly onlyIds: readonly string[];
  readonly cap: number;
} {
  /**
   * Arguments after the script path.
   */
  const args = process.argv
    .slice(2,);

  /**
   * Entry ids named after `--only`, comma separated.
   */
  const onlyAt = args.indexOf('--only',);

  /**
   * Cap named after `--cap`.
   */
  const capAt = args.indexOf('--cap',);

  /**
   * Cap as written, when one was named.
   */
  const capText = (capAt === (-1)) ? '' : (args[capAt + 1] ?? '');

  /**
   * Cap as a number, falling back when it is not one.
   */
  const cap = (capText === '')
    ? Number.NaN
    : Math.trunc(Number(capText,),);
  return {
    onlyIds: (onlyAt === (-1))
      ? []
      : (args[onlyAt + 1] ?? '')
        .split(',',)
        .filter(function isNamed(id,): boolean {
          return id !== '';
        },),
    cap: Number.isNaN(cap,) ? DEFAULT_CANDIDATE_CAP : cap,
  };
}

/**
 * Asks the roster about every unpaired passage it is given, up to the cap.
 *
 * READS THAT FAIL ARE SKIPPED AND LOGGED rather than thrown, since an entry
 * with only one side is an ordinary state of this corpus. That also swallows an
 * unreadable clone, which shows up as every entry skipping.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Logger tagged for this probe.
   */
  const log = tagged({ tag: 'coverage-probe', },);

  /**
   * When this run began, read before any work so the record dates the run
   * rather than the moment it happened to finish.
   */
  const startedAt = new Date().toISOString();

  /**
   * Digest over built output, which is the only identity that moves when the
   * code moves but the commit does not.
   *
   * READ AT THE START, not at the end. A long run gives a developer plenty of
   * time to rebuild, and `rendering-audit-settled` was caught doing exactly
   * that: `dist` was rebuilt while a run was in flight, so the digest it was
   * about to stamp described a build that had never probed anything. Node loads
   * the code once, at startup; the identity that answers for a run is the one
   * present THEN.
   */
  const { digest: pipelineDigest, } = await digestPipeline({ dir: import.meta.dirname, },);

  /**
   * Entry filter and candidate cap.
   */
  const {
    onlyIds,
    cap,
  } = readArguments();

  /**
   * Client for every exchange.
   */
  const client = createRunClient();

  /**
   * Abort shared by every call, never fired: each exchange has its own deadline.
   */
  const controller = new AbortController();

  /**
   * Rows accumulated across candidates, one per ATTEMPT: a candidate whose call
   * failed keeps a row saying so, since a measurement that drops its failures
   * reports a success rate of one.
   */
  const rows: ProbeRow[] = [];

  /**
   * Entries to walk, filtered when the caller named some.
   */
  const entryIds = (await listCorpusPeople({ pin: RUN_CORPUS_PIN, },))
    .filter(function isWanted(entryId,): boolean {
      return (onlyIds.length === 0) || onlyIds.includes(entryId,);
    },);
  /* oxlint-disable no-await-in-loop -- Sequential on purpose: this probe exists
     to be read while it runs, and a fan-out over entries would interleave the
     progress of several documents into one stream. */
  for (const entryId of entryIds) {
    if (rows.length >= cap)
      break;

    /**
     * Both sides at the pin, or nothing when this entry lacks one.
     */
    const texts = await (async function readPair(): Promise<PairRead> {
      try {
        return {
          kind: 'read',
          source: await readCorpusFile({
            pin: RUN_CORPUS_PIN,
            relPath: `people/${entryId}/page.md`,
          },),
          target: await readCorpusFile({
            pin: RUN_CORPUS_PIN,
            relPath: `people/${entryId}/page.en.md`,
          },),
        };
      }
      catch (error) {
        log.info(`${entryId}: skipped, ${String(error,)}`,);
        return { kind: 'missing', };
      }
    })();
    if (texts.kind === 'missing')
      continue;

    /**
     * Translation, parsed once and used both as the searched text and as what
     * every quote is anchored against.
     */
    const target = parseDocument({ text: texts.target, },);

    /**
     * Passages this entry's aligners refuse.
     */
    const candidates = listCoverageCandidates({
      source: parseDocument({ text: texts.source, },),
      target,
    },);
    if (candidates.length === 0)
      continue;

    log.info(`${entryId}: ${String(candidates.length,)} unpaired passages`,);
    for (const candidate of candidates) {
      if (rows.length >= cap)
        break;

      /**
       * Where this passage sits, in the same terms the censuses print.
       */
      const where = (candidate.scale === 'section')
        ? `section ${String(candidate.sourceIndex,)}`
        : `pair ${String(candidate.pairIndex,)} block ${String(candidate.sourceIndex,)}`;
      try {
        /**
         * What the roster concluded about it.
         */
        const answer = await runCoverageStage({
          client,
          modelIds: RUN_ROSTER,
          sourcePassage: candidate.sourceText,
          translation: target,
          signal: controller.signal,
          exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
          l: log,
        },);
        rows.push({
          entryId,
          scale: candidate.scale,
          where,
          sourceChars: candidate.sourceText
            .length,
          kind: answer.verdict
            .kind,
          anchoredFull: answer.verdict
            .anchoredFull,
          anchoredPartial: answer.verdict
            .anchoredPartial,
          absent: answer.verdict
            .absent,
          unanchored: answer.verdict
            .unanchored,
          heard: answer.verdict
            .heard,
          asked: answer.verdict
            .asked,
          unanchoredQuotes: answer.verdict
            .unanchoredQuotes,
          evidence: answer.verdict
            .evidence,
          findings: answer.findings,
        },);
        /**
         * Verdict of this candidate, read once for the progress line.
         */
        const { verdict, } = answer;
        log.info(
          `${entryId} ${where}: ${verdict.kind} (full ${String(verdict.anchoredFull,)}, `
            + `partial ${String(verdict.anchoredPartial,)}, absent ${String(verdict.absent,)}, `
            + `unanchored ${String(verdict.unanchored,)}, `
            + `heard ${String(verdict.heard,)} of ${String(verdict.asked,)})`,
        );
      }
      catch (error) {
        // Reported rather than fatal, the same way the translate probe learned
        // to be: one slow call must not cost every later candidate.
        rows.push({
          entryId,
          scale: candidate.scale,
          where,
          sourceChars: candidate.sourceText
            .length,
          kind: 'failed',
          anchoredFull: 0,
          anchoredPartial: 0,
          absent: 0,
          unanchored: 0,
          heard: 0,
          asked: RUN_ROSTER.length,
          evidence: [],
          unanchoredQuotes: [],
          findings: [String(error,),],
        },);
        log.info(`${entryId} ${where}: FAILED ${String(error,)}`,);
      }
    }
  }
  /* oxlint-enable no-await-in-loop */


  /**
   * Where this run was kept, said out loud so the answers are findable without
   * searching a runs directory for them.
   */
  const keptAt = await persistProbeRun({
    runsDir: await resolveRunsDir(),
    probeName: 'coverage-probe',
    run: {
      startedAt,
      finishedAt: new Date().toISOString(),
      pipelineDigest,
      roster: RUN_ROSTER,
      subject: {
        // THE COMMIT, not the whole pin: the pin also carries a local clone
        // directory, which names this machine rather than the corpus and is
        // worth nothing to a later reader holding the file.
        corpusPin: RUN_CORPUS_PIN.commitSha,
        entriesWalked: entryIds,
        entriesRequested: onlyIds,
        candidateCap: cap,
      },
      rows,
    },
  },);
  log.info(`kept ${String(rows.length,)} rows at ${keptAt}`,);

  // STANDARD OUTPUT STAYS. Redirecting it is the workflow this probe shipped
  // with, and removing it would trade one lost measurement for another.
  console.log(JSON.stringify(
    { rows, },
    undefined,
    2,
  ),);
}

// Guarded so this runs only when INVOKED, never as an import side effect: for a
// probe that spends quota, loading the library would otherwise buy model calls.
if (import.meta.main)
  await main();

//endregion Coverage probe
