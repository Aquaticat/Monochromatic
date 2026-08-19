import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  type ImageReading,
  readImageAsset,
} from './image-reading-stage.ts';
import { readingsCorroborate, } from './reading-corroboration.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Image reading pair
// READING ONE PICTURE TWICE, and letting the two readers decide whether either
// reading may be used.
//
// WHY A SECOND READER IS THE CHECK. What a reading has to earn is not
// plausibility but IDENTITY: is this a reading of the picture we sent. Nothing
// in one reading answers that, and the archive's own transcript cannot answer
// it either, for the two reasons `reading-corroboration.ts` records. Two models
// shown the same picture, neither shown the other's answer, agree about what it
// says when they can read it and do not when they cannot.
//
// THEY ARE NOT JUDGING EACH OTHER. Neither reader sees the other's reading and
// neither is asked whether it is sensible. Both are asked the same question
// about the same picture, blind, and the two answers are compared mechanically.
// A model judging a model is another failure surface; two witnesses are not.
//
// AN UNCORROBORATED READING IS UNAVAILABLE, not usable-with-a-caveat. This
// follows the rule the whole reading stage is built on: falling back costs
// nothing that exists today, since the passage is protected and left alone,
// while trusting a wrong reading licenses replacing a human's transcription
// with something derived from a misreading. A caveat travelling downstream is a
// caveat somebody has to remember.
//
// A FAILING READER COSTS ITS OWN READING AND NOTHING ELSE. Reading is the only
// stage in the pipeline whose output nothing requires, so it is also the only
// one that must never be able to fail an entry. It could, until the first real
// CLI run said so: `wangzihao980`, six pictures gathered, one reader looping on
// `picture1.webp` until the client's runaway guard ended the call, and the
// entry finishing `status=ERROR` with `processed=0`. Both lanes were lost to a
// transcription nobody needed. `Promise.allSettled` plus an explicit abort
// check is the containment; the abort still travels, because a stop is not a
// failure to absorb.
//
// WHAT THAT COSTS, measured rather than glossed. Of the 191 distinct assets a
// source-side reference names, 146 fit both readers, 31 fit only the larger
// context and 14 fit neither. So 31 pictures can never be corroborated and are
// refused here. They keep exactly the protections they have today, which for
// every transcript in the corpus is already a guard: the split, the alignment
// ratio, or the quote count.

/**
 * Decimal places an agreement figure is logged to.
 *
 * THREE, because the measured gap runs from 0.129 to 0.643 and two places would
 * round several distinct readings to the same line.
 */
const LOGGED_OVERLAP_PLACES = 3;

/**
 * One model's reading of one picture.
 *
 * @example
 * ```ts
 * const reading: ModelReading = { modelId: 'hf:moonshotai/Kimi-K3', text: '喵。', };
 * ```
 */
export type ModelReading = {
  /**
   * Model that produced it.
   */
  readonly modelId: SyntheticModelId;

  /**
   * What it transcribed.
   */
  readonly text: string;
};

/**
 * What reading one picture with the whole sub-roster produced.
 *
 * @example
 * ```ts
 * const paired: PairedReading = { kind: 'corroborated', readings, overlap: 0.97, };
 * ```
 */
export type PairedReading = {
  /**
   * Both readers read the picture and agree about what it says.
   */
  readonly kind: 'corroborated';

  /**
   * Every reading, labelled by its model, in roster order.
   *
   * BOTH RATHER THAN THE LONGER ONE. Corroboration establishes that the two
   * describe the same picture, not that they describe the same AMOUNT of it: on
   * `Mio/photo7.webp` one reader returned 178 characters and the other 590. The
   * shorter vouches for what it carries and the longer carries more, so a stage
   * shown both learns more than one shown either.
   */
  readonly readings: readonly ModelReading[];

  /**
   * How far above the threshold they agreed, recorded so a run can be read for
   * how close its corroborations ran.
   */
  readonly overlap: number;
} | {
  /**
   * No reading may be used, for a reason a finding can name.
   */
  readonly kind: 'unavailable';

  /**
   * Which of the ways it failed, so a reader can tell a picture nobody could
   * send from one the readers disagreed about.
   */
  readonly reason:
    | 'no-reader-available'
    | 'one-reader-only'
    | 'readers-disagree';

  /**
   * Why each reader produced nothing usable, in roster order, empty for a reader
   * that did produce one.
   */
  readonly perReader: readonly string[];

  /**
   * Agreement measured between the readings, when there were two to compare.
   * Absent when there were not, so a zero never reads as disagreement that was
   * actually a missing reading.
   */
  readonly overlap?: number;
};

/**
 * Reads one picture with every reader and settles whether either reading is
 * usable.
 *
 * @param client - transport to the provider
 *
 * @param readerModelIds - vision sub-roster, asked in this order
 *
 * @param bytes - picture as read from disk
 *
 * @param assetName - its file name, which carries the media type
 *
 * @param signal - abort honoured for every exchange
 *
 * @param perCallTimeoutMs - deadline bounding each exchange
 *
 * @param l - lane logger
 *
 * @returns Corroborated readings, or why none may be used
 *
 * @throws {@link DOMException} when `signal` aborts, since a run told to stop
 * must not settle a document on the readings that beat the stop. Every other
 * failure a reader raises is contained as an unavailable reading for that
 * reader alone
 *
 * @example
 * ```ts
 * const paired = await readImagePair({ client, readerModelIds, bytes, assetName, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function readImagePair(
  {
    client,
    readerModelIds,
    bytes,
    assetName,
    signal,
    perCallTimeoutMs,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly readerModelIds: readonly SyntheticModelId[];
    readonly bytes: Uint8Array;
    readonly assetName: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  },
): Promise<PairedReading> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: readImagePair.name,
    l,
  },);

  /**
   * How each reader's exchange ended, asked concurrently.
   *
   * CONCURRENTLY BECAUSE THE LIMITER IS PER MODEL. Different models hold
   * different slots, so asking them in sequence would double a reading's
   * latency for nothing.
   */
  const settled = await Promise.allSettled(readerModelIds.map(async function ask(modelId,): Promise<{
    readonly modelId: SyntheticModelId;
    readonly reading: ImageReading;
  }> {
    return {
      modelId,
      reading: await readImageAsset({
        client,
        modelId,
        bytes,
        assetName,
        signal,
        perCallTimeoutMs,
        l,
      },),
    };
  },),);

  // The entry's own abort has to stay a FAILURE rather than become two
  // unreadable pictures. `allSettled` swallows every ask a teardown rejected,
  // so a stop arriving mid-reading would otherwise return `no-reader-available`
  // and let the document settle without the readings the run was told to stop
  // gathering. This is the guard `runStageRound` places after its own
  // `allSettled`, for the same reason.
  signal.throwIfAborted();

  /**
   * What every reader made of the picture, with a reader that failed outright
   * carrying its failure rather than taking the others down with it.
   *
   * A READING IS EVIDENCE, NEVER A GATE, so a reader that throws costs its own
   * reading and nothing else. Measured on `wangzihao980` before this changed:
   * one reader looped on `picture1.webp`, the client's runaway guard ended the
   * call, `Promise.all` rejected, and the rejection travelled through
   * `readDocumentPictures` into `settleEntry`. The entry finished
   * `status=ERROR` with `processed=0`, so BOTH LANES were lost to a
   * transcription nobody needed. Nothing downstream reads a picture as
   * required, which is what makes containing it here correct rather than
   * merely convenient.
   */
  const outcomes: readonly {
    readonly modelId: SyntheticModelId;
    readonly reading: ImageReading;
  }[] = settled.map(function contained(
    result,
    index,
  ): {
    readonly modelId: SyntheticModelId;
    readonly reading: ImageReading;
  } {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    /**
     * Reader whose exchange threw, taken by position because a rejected
     * settlement carries no label of its own.
     */
    const modelId = readerModelIds[index];
    if (modelId === undefined) {
      throw new Error(
        `readImagePair settled ${String(settled.length,)} readers for ${assetName} `
          + `and then could not name the one at index ${String(index,)}`,
      );
    }
    rl.warn(
      `${assetName}: ${modelId} failed outright, so it contributes no reading (${
        String(result.reason,)
      })`,
    );
    return {
      modelId,
      reading: {
        kind: 'unavailable',
        reason: 'reader-failed',
      },
    };
  },);

  /**
   * Readings that arrived, labelled by model.
   */
  const readings: readonly ModelReading[] = outcomes
    .filter(function arrived({ reading, },): boolean {
      return reading.kind === 'read';
    },)
    .map(function labelled(
      {
        modelId,
        reading,
      },
    ): ModelReading {
      return {
        modelId,
        // Narrowed by the filter above, which a predicate cannot tell the
        // compiler; the alternative is a type guard for a two-line map.
        text: (reading.kind === 'read') ? reading.text : '',
      };
    },);

  /**
   * Why each reader produced nothing, empty for one that did.
   */
  const perReader: readonly string[] = outcomes.map(function reason(
    {
      modelId,
      reading,
    },
  ): string {
    return (reading.kind === 'unavailable')
      ? `${modelId}: ${reading.reason}`
      : '';
  },);

  if (readings.length < 2) {
    /**
     * Which shortfall this is, since one reading and none are different
     * situations for anyone reading the finding.
     */
    const reason = (readings.length === 1) ? 'one-reader-only' : 'no-reader-available';
    rl.warn(
      `${assetName}: ${String(readings.length,)} of ${
        String(readerModelIds.length,)
      } readers produced a reading, so nothing is corroborated (${
        perReader.filter(function stated(entry,): boolean {
          return entry !== '';
        },)
          .join('; ',)
      })`,
    );
    return {
      kind: 'unavailable',
      reason,
      perReader,
    };
  }

  /**
   * First two readings, which is the whole roster today and the first two of a
   * larger one.
   */
  const [
    left,
    right,
  ] = readings;
  if ((left === undefined) || (right === undefined)) {
    throw new Error(
      `readImagePair counted ${String(readings.length,)} readings for ${assetName} `
        + `and then could not index two of them`,
    );
  }

  /**
   * Whether they describe the same picture.
   */
  const verdict = readingsCorroborate({
    left: left.text,
    right: right.text,
  },);
  if (verdict.kind === 'disagree') {
    rl.warn(
      `${assetName}: ${left.modelId} and ${right.modelId} disagree about what it says, `
        + `overlap ${verdict
          .overlap
          .toFixed(LOGGED_OVERLAP_PLACES,)}`,
    );
    return {
      kind: 'unavailable',
      reason: 'readers-disagree',
      perReader,
      overlap: verdict.overlap,
    };
  }

  rl.info(
    `${assetName}: corroborated by ${String(readings.length,)} readers at overlap ${
      verdict
        .overlap
        .toFixed(LOGGED_OVERLAP_PLACES,)
    }`,
  );
  return {
    kind: 'corroborated',
    readings,
    overlap: verdict.overlap,
  };
}

//endregion Image reading pair
