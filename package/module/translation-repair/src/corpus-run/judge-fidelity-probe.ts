import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { prepareDocumentPair, } from '../document-preparation.ts';
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
 * Defects built for every pair when the caller names none.
 *
 * DELETION FIRST, since it is the reading already recorded and the one an
 * insertion result is compared against.
 */
const DAMAGE_KINDS: readonly FidelityDamageKind[] = [
  'deletion',
  'insertion',
  'alteration',
];

/**
 * Defects each `--damage` spelling asks for.
 *
 * BOTH BY DEFAULT, because either fixture alone leaves a habit unmeasured: the
 * deletion cannot separate reading from preferring length, and the insertion
 * alone would not say the roster sees an omission at all. An unlisted spelling
 * reads as absent and the caller is told, rather than silently running
 * something it did not ask for.
 */
const DAMAGE_BY_NAME: Readonly<Record<string, readonly FidelityDamageKind[]>> = {
  '': DAMAGE_KINDS,
  deletion: ['deletion',],
  insertion: ['insertion',],
  alteration: ['alteration',],
};

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
   * Reasons in roster order, kept because a judge that names coverage and still
   * picks the damaged text is a different failure from one that never mentions
   * it.
   */
  readonly reasons: readonly string[];
};

/**
 * Reads `--only`, `--cap` and `--damage` from the command line.
 *
 * @returns Entry ids to trial, empty for every entry, the trial cap, and which
 * defects to build
 *
 * @example
 * ```ts
 * const { onlyIds, cap, damageKinds, } = readArguments();
 * ```
 */
function readArguments(): {
  readonly onlyIds: readonly string[];
  readonly cap: number;
  readonly damageKinds: readonly FidelityDamageKind[];
  readonly withContext: boolean;
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

  /**
   * Defect named after `--damage`, absent for both.
   */
  const damageAt = args.indexOf('--damage',);

  /**
   * Defect as written, when one was named.
   */
  const damageText = (damageAt === (-1)) ? '' : (args[damageAt + 1] ?? '');

  /**
   * Defects that spelling asks for, absent when it names none this probe builds.
   */
  const damageKinds = DAMAGE_BY_NAME[damageText];
  if (damageKinds === undefined)
    throw new Error(`--damage takes deletion, insertion or alteration, not ${damageText}`,);
  return {
    // `#107`: whether the sheet also carries the neighbouring sections' original,
    // which is the one thing that differs between a narrow run and a wide one.
    withContext: args.includes('--context',),
    damageKinds,
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
    damageKinds,
    withContext,
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
    /**
     * Damaged pairs taken from this entry so far.
     */
    let pairsHere = 0;
    for (const [
      sliceIndex,
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
              sliceIndex,
            },),
          },);
        },)
        .filter(function wasBuilt(attempt,): attempt is Extract<DamageAttempt, { kind: 'damaged'; }> {
          if (attempt.kind === 'damaged')
            return true;
          log.info(`${entryId}/${String(sliceIndex,)}: ${attempt.reason}`,);
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
            trialId: `${entryId}/${String(sliceIndex,)}/${damaged.damageKind}`,
            direction: arrangement.direction,
            damageKind: damaged.damageKind,
            sourceText: slice.source
              .text,
            contextText: withContext
              ? neighbouringSource({
                slices: prepared.slices,
                sliceIndex,
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
              sliceIndex,
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
