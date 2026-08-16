import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { ChunkPair, } from '../chunk-document.ts';
import {
  CorpusReadError,
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { classifyDisplacement, } from '../displacement-class.ts';
import { prepareDocumentPair, } from '../document-preparation.ts';
import { hashContent, } from '../document-node.ts';
import {
  createRunClient,
  readHeadSha,
  resolveRunsDir,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';
import {
  completedArms,
  readTrialLedger,
} from './window-trial-ledger.ts';
import {
  reportWindowTrial,
  TRIAL_ARMS,
} from './window-trial-report.ts';
import {
  controlSlices,
  flaggedSlices,
  type TrialSlice,
} from './window-trial-draw.ts';
import { runPick, } from './window-trial-pick.ts';
import {
  assertWindowReachedJudges,
  witnessSheets,
} from './window-trial-witness.ts';

//region Window trial probe
// `#108`, run end to end: does showing the judges the neighbouring original
// change how often the archive's English is replaced?
//
// SPENDS QUOTA, roughly three judgings plus one slate per drawn slice. Point
// `TRANSLATION_REPAIR_RUNS_DIR` at a throwaway directory.
//
// EVERY PART OF THE READING IS TESTED WITHOUT QUOTA and lives elsewhere: the
// ledger, the draw, the per-slice arms and the report each have their own file
// and their own tests. What is here is composition, the corpus walk, and the two
// checks that can only be made against a live run.

/**
 * Version of this trial's protocol, bumped when what a row MEANS changes.
 *
 * Folded into the protocol digest, so a change here stops a later run resuming
 * rows bought under the older meaning rather than silently pooling them.
 */
const TRIAL_PROTOCOL_VERSION = 1;

/**
 * Controls drawn per entry that contributes any flagged slice.
 *
 * Small on purpose. Controls exist to detect a general context-induced
 * conservatism, which would show across many entries rather than within one, so
 * breadth is worth more here than depth.
 */
const CONTROLS_PER_ENTRY = 1;

/**
 * Refusals in a row that end the run.
 *
 * Small, because slices that genuinely cannot be tried do not cluster: the draw
 * interleaves entries and classes, so several in a row is a provider or a
 * roster, not a run of awkward slices.
 */
const REFUSALS_BEFORE_STOPPING = 5;

/**
 * Digest characters printed in the run's opening line.
 *
 * Enough to tell two protocols apart at a glance in a log, and short enough that
 * the line stays readable; the ledger carries the whole digest either way.
 */
const PROTOCOL_LOG_CHARS = 12;

/**
 * Logger the run writes under.
 */
const l = tagged({ tag: 'window-trial', },);

/**
 * Digest of everything this run buys under.
 *
 * ROSTER, CORPUS PIN, CODE AND PROTOCOL TOGETHER. A trial re-run after any of
 * them moved is asking a different question, and resuming across that boundary
 * would pool two experiments into one tally. The ledger skips on this, so
 * getting it wrong is what silently mixes them.
 *
 * @param headSha - commit the pipeline is running at
 *
 * @returns Digest the ledger keys resumption on
 *
 * @example
 * ```ts
 * const protocol = protocolDigest({ headSha, },);
 * ```
 */
function protocolDigest({ headSha, }: { readonly headSha: string; },): string {
  return hashContent({
    content: JSON.stringify([
      'window-trial',
      TRIAL_PROTOCOL_VERSION,
      RUN_ROSTER,
      RUN_CORPUS_PIN,
      headSha,
    ],),
  },);
}

/**
 * Both sides of one entry, or the fact that it carries only one.
 *
 * @example
 * ```ts
 * const texts: PairTexts = { kind: 'missing', };
 * ```
 */
type PairTexts = {
  /**
   * Entry carries both sides.
   */
  readonly kind: 'read';

  /**
   * Original page.
   */
  readonly source: string;

  /**
   * Translated page.
   */
  readonly target: string;
} | {
  /**
   * Entry carries one side, which is an ordinary state of this corpus.
   */
  readonly kind: 'missing';
};

/**
 * Slices one entry contributes, flagged plus its controls.
 *
 * @param entryId - entry to read
 *
 * @returns Slices to buy and the preparation they index into, empty when the
 * entry cannot be read or the screen flagged nothing
 *
 * @example
 * ```ts
 * const drawn = await drawEntry({ entryId, },);
 * ```
 */
async function drawEntry(
  { entryId, }: { readonly entryId: string; },
): Promise<{
  readonly picks: readonly TrialSlice[];
  readonly slices: readonly ChunkPair[];
}> {
  /**
   * Both sides, absent when this entry carries only one.
   */
  const texts = await readPairTexts({ entryId, },);
  if (texts.kind === 'missing') {
    return {
      picks: [],
      slices: [],
    };
  }

  /**
   * Slices exactly as the lanes would see them.
   */
  const prepared = prepareDocumentPair({
    sourceText: texts.source,
    targetText: texts.target,
  },);

  /**
   * What the screen makes of their sizes.
   */
  const displacement = classifyDisplacement({
    slices: prepared.slices
      .map(function toSizes(slice,) {
        return {
          sourceChars: slice.source
            .text
            .length,
          targetChars: slice.target
            .text
            .length,
        };
      },),
  },);

  /**
   * Flagged slices, deduplicated across overlapping candidates.
   */
  const flagged = flaggedSlices({
    entryId,
    displacement,
  },);
  if (flagged.length === 0) {
    return {
      picks: [],
      slices: prepared.slices,
    };
  }

  return {
    // CONTROLS ONLY FROM ENTRIES THAT CONTRIBUTE FLAGGED SLICES, so the two
    // populations share their documents. A control drawn from an entry the
    // screen never flagged would differ in whatever made that entry clean.
    picks: [
      ...flagged,
      ...controlSlices({
        entryId,
        displacement,
        wanted: CONTROLS_PER_ENTRY,
      },),
    ],
    slices: prepared.slices,
  };
}

/**
 * Reads both sides of one entry.
 *
 * @param entryId - entry to read
 *
 * @returns Both texts, absent when either side is missing
 *
 * @throws Whatever the read threw, when it was not a corpus read failure
 *
 * @example
 * ```ts
 * const texts = await readPairTexts({ entryId, },);
 * ```
 */
async function readPairTexts(
  { entryId, }: { readonly entryId: string; },
): Promise<PairTexts> {
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
    if (!(error instanceof CorpusReadError))
      throw error;
    l.info(`${entryId}: skipped, ${String(error,)}`,);
    return { kind: 'missing', };
  }
}

/**
 * Runs the trial over the pinned corpus.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Where this run's ledger lives.
   */
  const ledgerPath = join(
    await resolveRunsDir(),
    'window-trial',
    'arms.jsonl',
  );

  /**
   * Digest this run buys under.
   */
  const protocol = protocolDigest({ headSha: await readHeadSha(), },);

  /**
   * Arms already bought under it.
   */
  const done = completedArms({
    rows: await readTrialLedger({ path: ledgerPath, },),
    protocol,
  },);
  l.info(
    `protocol ${
      protocol.slice(
        0,
        PROTOCOL_LOG_CHARS,
      )
    }; ${String(done.size,)} arms already bought`,
  );

  /**
   * Client every call goes through.
   */
  const client = createRunClient();

  /**
   * Nothing here aborts the run, so a kill is what stops it.
   */
  const { signal, } = new AbortController();

  /**
   * Wrapper the run buys under until the window is seen on the wire.
   */
  const witness = witnessSheets({ client, },);

  /**
   * Slices bought so far, which the first-slice check reads, and slices that
   * refused.
   *
   * A REFUSAL IS COUNTED AND WALKED PAST, never fatal to the run. A slice can
   * refuse for reasons that are properties of the slice rather than of the
   * trial: no neighbouring section to widen to, or a slice with no incumbent
   * whose judges all declined. Aborting the walk on one of those would stop the
   * run at the same slice on every resumption, and since the refusal is never
   * recorded, no amount of restarting would ever get past it.
   */
  const bought = {
    count: 0,
    refused: 0,
    refusedInARow: 0,
  };

  /**
   * State of the live window check: wide arms bought under the witness, and
   * whether the check has passed and the wrapper been dropped.
   */
  const witnessed = {
    wideArms: 0,
    passed: false,
  };

  for (const entryId of await listCorpusPeople({ pin: RUN_CORPUS_PIN, },)) {
    /* oxlint-disable no-await-in-loop -- entries are walked in order so a kill leaves a prefix */
    /**
     * Slices this entry contributes, with the preparation they index into.
     */
    const drawn = await drawEntry({ entryId, },);
    /* oxlint-enable no-await-in-loop */
    for (const pick of drawn.picks) {
      /* oxlint-disable no-await-in-loop -- arms are bought one slice at a time and appended as they complete */
      /**
       * What this slice yielded: arms it bought, empty when the ledger already
       * held them all, or a refusal the walk steps over.
       */
      const outcome = await runPick({
        client: witnessed.passed ? client : witness.client,
        slices: drawn.slices,
        pick,
        entryId,
        protocol,
        ledgerPath,
        done,
        models: {
          translatorModelIds: RUN_ROSTER,
          judgeModelIds: RUN_ROSTER,
        },
        signal,
        perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
        l,
      },);
      /* oxlint-enable no-await-in-loop */
      if (outcome.kind === 'refused') {
        bought.refused += 1;
        bought.refusedInARow += 1;
        // A REFUSAL IS NOT FREE: the slate is produced before any arm is judged,
        // so a fault that fails every judging still spends a roster of
        // translator calls per slice and leaves an empty ledger. Slices that
        // genuinely cannot be tried are scattered through the draw, so a run of
        // them says the fault is the run's rather than the slices'.
        if (bought.refusedInARow >= REFUSALS_BEFORE_STOPPING)
          throw new Error(
            `${String(bought.refusedInARow,)} slices refused in a row, which is `
              + `a fault in the run rather than in the slices; stopping before `
              + `the rest of the draw is spent producing slates nobody judges`,
          );
        continue;
      }
      bought.refusedInARow = 0;

      /**
       * Arms this call bought.
       */
      const { rows, } = outcome;
      if (rows.length === 0)
        continue;
      bought.count += 1;
      // THE ONE CHECK ONLY A LIVE RUN CAN MAKE, on the earliest slice that
      // bought a wide arm. Resumption can leave that slice owing narrow arms
      // only, so this waits for a wide arm rather than for the first purchase.
      if (!witnessed.passed) {
        witnessed.wideArms += rows
          .filter(function isWide(row,) {
            return row.arm === TRIAL_ARMS.wide;
          },)
          .length;
        if (witnessed.wideArms > 0) {
          assertWindowReachedJudges({
            sheets: witness.sheets,
            expected: witnessed.wideArms * RUN_ROSTER.length,
          },);
          witnessed.passed = true;
          l.info('the window reached every judge of the first wide arm',);
        }
      }
      l.info(
        `${entryId}/${String(pick.chunkIndex,)} (${pick.sliceClass}): ${
          rows.map(function toOutcome(row,) {
            return `${row.arm}=${row.shipped ? 'replaced' : 'kept'}`;
          },)
            .join(' ',)
        }`,
      );
    }
  }

  l.info(
    `bought ${String(bought.count,)} slices this run; ${
      String(bought.refused,)
    } refused`,
  );
  for (const report of reportWindowTrial({
    rows: await readTrialLedger({ path: ledgerPath, },),
    protocol,
  },)) {
    l.info(
      `${report.sliceClass}: ${
        report.arms
          .map(function toRate(rate,) {
            return `${rate.arm} ${String(rate.replaced,)}/${String(rate.trials,)}`;
          },)
          .join(' ',)
      }; wide moved ${String(report.transitions
        .replaceToKeep,)} down and ${
        String(report.transitions
          .keepToReplace,)
      } up, against a band of ${String(report.bandTransitions
        .replaceToKeep,)} down and ${
        String(report.bandTransitions
          .keepToReplace,)
      } up; ${String(report.incomplete,)} incomplete, ${
        String(report.degraded,)
      } dropped for a short panel`,
    );
  }
}

await main();

//endregion Window trial probe
