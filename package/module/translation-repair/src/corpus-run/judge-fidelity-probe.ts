import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  alterSharedNumber,
  type DamageAttempt,
  deleteOneSentence,
  donorTextsFor,
  type FidelityDamageKind,
  insertBorrowedSentence,
} from '../fidelity-damage.ts';
import { neighbouringSource, } from '../fidelity-window.ts';
import {
  type FidelityDirection,
  type FidelityTrial,
  runFidelityTrial,
} from '../judge-fidelity.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';
import {
  carveSettled,
  listSettledEntryIds,
  recipeLabel,
} from './settled-carve.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import { digestPipeline, } from './pipeline-digest.ts';
import { persistProbeRun, } from './probe-store.ts';
import { readRunnerClosure, } from './runner-closure.ts';
import {
  DAMAGE_KINDS,
  readFidelityArguments,
} from './judge-fidelity-args.ts';

//region Judge fidelity probe
// `#84`: before the translate-and-select shape decides a corpus, can its judges
// tell a faithful rendering from one that says less.
//
// THE ANSWER IS CONSTRUCTED RATHER THAN OBSERVED. Each trial takes a real slice
// of the archive, deletes one whole sentence from its English with
// `applySeededErrors`, and puts the two texts on the ballot the production stage
// uses, with the production task and criteria. One candidate states everything
// the other does minus a sentence, so coverage is the only ground it can lose
// on, and coverage is the first criterion the sheet names.
//
// EVERY PAIR IS RUN FOUR WAYS: the clean text as the incumbent and as the
// proposal, each with the clean text listed first and second. A judge that
// prefers the incumbent scores half, a judge that prefers position one scores
// half, and only a judge that reads scores all four.
//
// IT DECIDES NOTHING. No lane, cache or artifact reads its output; it prints
// rows as JSON on standard output for a caller to keep.

/**
 * Shortest English slice worth damaging.
 *
 * Below this a deleted sentence is most of the passage, which asks a far easier
 * question than the one production faces.
 */
const MIN_SLICE_CHARS = 400;

/**
 * Damaged pairs taken from any one entry.
 *
 * ONE, so a cap spreads across entries instead of exhausting the first. Walking
 * an entry's slices in order until the cap is reached samples one document's
 * prose, one translator's habits and one subject, and reports it as a rate over
 * the archive. The same bias was recorded against the coverage probe and is
 * cheaper to avoid here than to caveat later.
 */
const PAIRS_PER_ENTRY = 1;

/**
 * Ballot arrangements every pair is run through.
 */
const ARRANGEMENTS: readonly {
  readonly direction: FidelityDirection;
  readonly cleanFirst: boolean;
}[] = [
  {
    direction: 'preserve',
    cleanFirst: true,
  },
  {
    direction: 'preserve',
    cleanFirst: false,
  },
  {
    direction: 'replace',
    cleanFirst: true,
  },
  {
    direction: 'replace',
    cleanFirst: false,
  },
];

/**
 * One trial and what came back.
 */
type FidelityRow = {
  /**
   * Corpus entry the slice belongs to.
   */
  readonly entryId: string;

  /**
   * Slice within that entry's preparation.
   */
  readonly slicePosition: number;

  /**
   * Which side held the clean text.
   */
  readonly direction: FidelityDirection;

  /**
   * Which constructed defect the damaged candidate carried.
   */
  readonly damageKind: FidelityDamageKind;

  /**
   * Whether the clean text was listed first.
   */
  readonly cleanFirst: boolean;

  /**
   * What the roster chose, or that it declined.
   */
  readonly verdict: string;

  /**
   * Whether that is the right answer.
   */
  readonly correct: boolean;

  /**
   * Judges that picked the clean text.
   */
  readonly forClean: number;

  /**
   * Judges that picked the damaged text.
   */
  readonly forDamaged: number;

  /**
   * Characters the edit removed or added.
   */
  readonly changedChars: number;

  /**
   * What the edit did, so two runs can be compared on the SAME damage without
   * recovering it from whatever the judges happened to quote.
   */
  readonly damageDetail: string;

  /**
   * Reasons in roster order, kept because a judge that names coverage and still
   * picks the damaged text is a different failure from one that never mentions
   * it.
   */
  readonly reasons: readonly string[];
};

/**
 * Runs constructed comparisons past the production judges, up to the cap.
 *
 * OVER SETTLED ENTRIES ONLY, carved through the recipe each artifact records.
 * The trials ask how the judges read a slice as the lanes see it, and the lanes
 * see slices the roster shell carved; an entry the pass never settled has no
 * such slicing, and the bare deterministic carve this used to run is a
 * different instrument, not a cheaper approximation.
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
  const log = tagged({ tag: 'judge-fidelity-probe', },);

  /**
   * Entry filter and trial cap.
   */
  const {
    onlyIds,
    cap,
    damageKinds,
    withContext,
  } = readFidelityArguments();

  /**
   * Client for every exchange.
   */
  const client = createRunClient();

  /**
   * Abort shared by every call, never fired: each exchange has its own deadline.
   */
  const controller = new AbortController();

  /**
   * Rows accumulated across trials, one per attempt.
   */
  const rows: FidelityRow[] = [];

  /**
   * When this run started, for the kept record.
   */
  const startedAt = new Date().toISOString();

  /**
   * Digest of the pipeline these trials ran under.
   */
  const { digest: pipelineDigest, } = await digestPipeline({ dir: import.meta.dirname, },);

  /**
   * Chunks this entry imports, read at run start.
   */
  const runnerClosure = await readRunnerClosure({ entryPath: process.argv[1] ?? '', },);

  /**
   * Runs directory whose settled artifacts name the population.
   */
  const runsDir = await resolveRunsDir();

  /**
   * Settled entries to walk, filtered when the caller named some.
   */
  const entryIds = (await listSettledEntryIds({ runsDir, },))
    .filter(function isWanted(entryId,): boolean {
      return (onlyIds.length === 0) || onlyIds.includes(entryId,);
    },);
  log.info(`settled entries to walk: ${String(entryIds.length,)}`,);
  /* oxlint-disable no-await-in-loop -- Sequential on purpose: this probe exists
     to be read while it runs, and a fan-out would interleave several entries
     into one stream. */
  for (const entryId of entryIds) {
    if (rows.length >= cap)
      break;

    /**
     * Slices as the lanes saw them, rebuilt through the artifact's recipe.
     */
    const carve = await carveSettled({
      entryId,
      runsDir,
      cloneDir: RUN_CORPUS_PIN.cloneDir,
    },);
    if (carve.kind !== 'settled') {
      log.info(`${entryId}: skipped, ${carve.kind} artifact records no recipe`,);
      continue;
    }
    log.info(`${entryId}: carved from its settled artifact (${recipeLabel({ recipe: carve.recipe, },)})`,);

    /**
     * Slicing to draw trials from.
     */
    const { prepared, } = carve;
    /**
     * Damaged pairs taken from this entry so far.
     */
    let pairsHere = 0;
    for (const [
      slicePosition,
      slice,
    ] of prepared.slices
      .entries()) {
      if ((rows.length >= cap) || (pairsHere >= PAIRS_PER_ENTRY))
        break;

      /**
       * English this slice carries, EMPTY on an insertion anchor, which the
       * length floor excludes along with every slice too short to damage.
       */
      const cleanText = slice.target
        .text;
      if (cleanText.length < MIN_SLICE_CHARS)
        continue;

      /**
       * Every defect this slice admits, in the order the caller asked for.
       *
       * A slice that admits neither is skipped without counting against the
       * per-entry pair budget, so an entry whose first long slice cannot be
       * damaged is still sampled further down.
       */
      const attempts = damageKinds
        .map(function toAttempt(damageKind,): DamageAttempt {
          if (damageKind === 'deletion')
            return deleteOneSentence({ cleanText, },);
          if (damageKind === 'alteration') {
            return alterSharedNumber({
              cleanText,
              sourceText: slice.source
                .text,
            },);
          }
          return insertBorrowedSentence({
            cleanText,
            donorTexts: donorTextsFor({
              slices: prepared.slices,
              slicePosition,
            },),
          },);
        },)
        .filter(function wasBuilt(attempt,): attempt is Extract<DamageAttempt, { kind: 'damaged'; }> {
          if (attempt.kind === 'damaged')
            return true;
          log.info(`${entryId}/${String(slicePosition,)}: ${attempt.reason}`,);
          return false;
        },);
      if (attempts.length === 0)
        continue;
      pairsHere += 1;

      for (const damaged of attempts) {
        for (const arrangement of ARRANGEMENTS) {
          if (rows.length >= cap)
            break;

          /**
           * Comparison with a known right answer.
           */
          const trial: FidelityTrial = {
            trialId: `${entryId}/${String(slicePosition,)}/${damaged.damageKind}`,
            direction: arrangement.direction,
            damageKind: damaged.damageKind,
            sourceText: slice.source
              .text,
            contextText: withContext
              ? neighbouringSource({
                slices: prepared.slices,
                slicePosition,
              },)
              : '',
            cleanText,
            damagedText: damaged.damagedText,
            cleanFirst: arrangement.cleanFirst,
          };
          try {
            /**
             * What the judges made of it.
             */
            const outcome = await runFidelityTrial({
              client,
              trial,
              judgeModelIds: RUN_ROSTER,
              signal: controller.signal,
              perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
              l: log,
            },);
            rows.push({
              entryId,
              slicePosition,
              direction: outcome.direction,
              damageKind: outcome.damageKind,
              cleanFirst: outcome.cleanFirst,
              verdict: outcome.verdict,
              correct: outcome.correct,
              forClean: outcome.ballots
                .filter(function pickedClean(ballot,) {
                  return ballot.picked === 'clean';
                },)
                .length,
              forDamaged: outcome.ballots
                .filter(function pickedDamaged(ballot,) {
                  return ballot.picked === 'damaged';
                },)
                .length,
              changedChars: damaged.changedChars,
              damageDetail: damaged.damageDetail,
              reasons: outcome.ballots
                .map(function toReason(ballot,) {
                  return `${ballot.modelId}: ${ballot.picked} ${ballot.reason}`;
                },),
            },);
          }
          catch (error) {
            log.info(`${trial.trialId} (${arrangement.direction}): failed, ${String(error,)}`,);
          }
        }
      }
    }
  }
  /* oxlint-enable no-await-in-loop */

  /**
   * Trials the roster got right.
   */
  const correct = rows.filter(function wasRight(row,) {
    return row.correct;
  },);
  log.info(
    `fidelity: ${String(correct.length,)} of ${String(rows.length,)} trials chose the complete text`,
  );
  // PER DEFECT AS WELL AS OVERALL, because the two answer different questions
  // and a combined figure hides the one that matters: a roster reading length
  // scores every deletion trial and no insertion trial.
  for (const damageKind of DAMAGE_KINDS) {
    /**
     * Trials built with this defect.
     */
    const ofKind = rows.filter(function isKind(row,) {
      return row.damageKind === damageKind;
    },);
    if (ofKind.length === 0)
      continue;
    /**
     * Trials of this defect the roster got right.
     */
    const rightOfKind = ofKind.filter(function wasRight(row,) {
      return row.correct;
    },);
    log.info(
      `fidelity ${damageKind}: ${String(rightOfKind.length,)} of ${
        String(ofKind.length,)
      } chose the complete text`,
    );
  }
  /**
   * Where the rows were kept, so the standard output below is a convenience
   * and not the record: these rows carry judge prose quoting candidates.
   */
  const keptAt = await persistProbeRun({
    runsDir,
    probeName: 'judge-fidelity-probe',
    run: {
      startedAt,
      finishedAt: new Date().toISOString(),
      pipelineDigest,
      runnerClosure,
      roster: RUN_ROSTER,
      subject: {
        corpusPin: RUN_CORPUS_PIN.commitSha,
        entriesWalked: entryIds,
        entriesRequested: onlyIds,
        trialCap: cap,
        damageKinds,
        withContext,
      },
      rows,
    },
  },);
  log.info(`kept ${String(rows.length,)} rows at ${keptAt}`,);

  // STANDARD OUTPUT STAYS, as an artifact: it quotes model prose about
  // candidates, so it is redirected to a file and never pasted (README).
  process.stdout
    .write(`${
      JSON.stringify(
        { rows, },
        undefined,
        2,
      )
    }\n`,);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'judge-fidelity-probe',
    run: main,
  },);

//endregion Judge fidelity probe
