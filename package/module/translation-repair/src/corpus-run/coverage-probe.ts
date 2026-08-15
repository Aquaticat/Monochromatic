import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { listCoverageCandidates, } from '../coverage-candidates.ts';
import { runCoverageStage, } from '../coverage-stage.ts';
import { parseDocument, } from '../parse-document.ts';
import {
  createRunClient,
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
// IT DECIDES NOTHING. No slicing, no artifact and no lane reads its output. It
// prints its rows as JSON on standard output and writes nothing, so a caller
// redirects them wherever the measurement is being kept.

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
