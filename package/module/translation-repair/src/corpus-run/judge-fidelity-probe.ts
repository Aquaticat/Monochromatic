import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { deriveOmissionSeeds, } from '../derive-seeds.ts';
import { prepareDocumentPair, } from '../document-preparation.ts';
import {
  type FidelityDirection,
  type FidelityTrial,
  runFidelityTrial,
} from '../judge-fidelity.ts';
import { applySeededErrors, } from '../seeded-error.ts';
import {
  createRunClient,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';

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
 * How many trials one invocation runs by default.
 *
 * COUNTED IN ATTEMPTS, not in successes, so a failing roster cannot spend
 * without bound while the count a reader checks stays small.
 */
const DEFAULT_TRIAL_CAP = 16;

/**
 * Shortest English slice worth damaging.
 *
 * Below this a deleted sentence is most of the passage, which asks a far easier
 * question than the one production faces.
 */
const MIN_SLICE_CHARS = 400;

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
 * One English slice with a sentence removed, or the fact that none can be.
 */
type DamageAttempt = {
  /**
   * A sentence came out.
   */
  readonly kind: 'damaged';

  /**
   * Slice text after the deletion.
   */
  readonly damagedText: string;

  /**
   * Characters the deletion removed.
   */
  readonly deletedChars: number;
} | {
  /**
   * Every sentence of this slice is too short or occurs more than once, so no
   * deletion can be applied unambiguously. An ordinary property of a slice
   * rather than a failure.
   */
  readonly kind: 'undamageable';
};

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
  readonly sliceIndex: number;

  /**
   * Which side held the clean text.
   */
  readonly direction: FidelityDirection;

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
   * Judges that picked the deletion.
   */
  readonly forDamaged: number;

  /**
   * Characters the deletion removed.
   */
  readonly deletedChars: number;

  /**
   * Reasons in roster order, kept because a judge that names coverage and still
   * picks the deletion is a different failure from one that never mentions it.
   */
  readonly reasons: readonly string[];
};

/**
 * Reads `--only` and `--cap` from the command line.
 *
 * @returns Entry ids to trial, empty for every entry, and the trial cap
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
    cap: Number.isNaN(cap,) ? DEFAULT_TRIAL_CAP : cap,
  };
}

/**
 * Builds the damaged twin of one English slice.
 *
 * @param cleanText - slice English as the archive holds it
 *
 * @returns Damaged text and what was removed, or that no sentence of this slice
 * can be deleted unambiguously
 *
 * @example
 * ```ts
 * const damaged = damageSlice({ cleanText, },);
 * ```
 */
function damageSlice(
  { cleanText, }: { readonly cleanText: string; },
): DamageAttempt {
  /**
   * Deletion seeds this slice admits, longest sentence first.
   */
  const seeds = deriveOmissionSeeds({
    text: cleanText,
    maxSeeds: 1,
  },);

  /**
   * Seed to apply, absent when every sentence is ambiguous or too short.
   */
  const seed = seeds.at(0,);
  if (seed === undefined)
    return { kind: 'undamageable', };

  /**
   * Slice with that sentence removed.
   */
  const seeded = applySeededErrors({
    text: cleanText,
    specs: [seed,],
  },);
  if (seeded.seededText === cleanText)
    return { kind: 'undamageable', };
  return {
    kind: 'damaged',
    damagedText: seeded.seededText,
    deletedChars: seed.needle
      .length,
  };
}

/**
 * Runs constructed comparisons past the production judges, up to the cap.
 *
 * READS THAT FAIL ARE SKIPPED AND LOGGED rather than thrown, since an entry with
 * only one side is an ordinary state of this corpus.
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
   * Rows accumulated across trials, one per attempt.
   */
  const rows: FidelityRow[] = [];

  /**
   * Entries to walk, filtered when the caller named some.
   */
  const entryIds = (await listCorpusPeople({ pin: RUN_CORPUS_PIN, },))
    .filter(function isWanted(entryId,): boolean {
      return (onlyIds.length === 0) || onlyIds.includes(entryId,);
    },);
  /* oxlint-disable no-await-in-loop -- Sequential on purpose: this probe exists
     to be read while it runs, and a fan-out would interleave several entries
     into one stream. */
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
     * Slices exactly as the lanes would see them.
     */
    const prepared = prepareDocumentPair({
      sourceText: texts.source,
      targetText: texts.target,
    },);
    for (const [
      sliceIndex,
      slice,
    ] of prepared.slices
      .entries()) {
      if (rows.length >= cap)
        break;

      /**
       * English this slice carries, absent on an insertion anchor.
       */
      const cleanText = slice.target
        .text;
      if ((cleanText === undefined) || (cleanText.length < MIN_SLICE_CHARS))
        continue;

      /**
       * Damaged twin, or the fact that no sentence can be deleted unambiguously.
       */
      const damaged = damageSlice({ cleanText, },);
      if (damaged.kind === 'undamageable')
        continue;

      for (const arrangement of ARRANGEMENTS) {
        if (rows.length >= cap)
          break;

        /**
         * Comparison with a known right answer.
         */
        const trial: FidelityTrial = {
          trialId: `${entryId}/${String(sliceIndex,)}`,
          direction: arrangement.direction,
          sourceText: slice.source
            .text,
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
            sliceIndex,
            direction: outcome.direction,
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
            deletedChars: damaged.deletedChars,
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
  await main();

//endregion Judge fidelity probe
