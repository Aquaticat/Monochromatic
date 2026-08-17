import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import { assembleTranslation, } from './translate-assemble.ts';
import {
  absenceFinding,
  type IncumbentKind,
} from './translate-absence.ts';
import { attemptTranslateSlice, } from './translate-slice-attempt.ts';
import {
  assertSettledRecordAgrees,
  resumedSliceDiscardFinding,
  sliceRecordAgrees,
} from './slice-record-agreement.ts';
import { assertRostersConfigured, } from './roster-configuration.ts';
import type { SliceCache, } from './slice-cache.ts';
import { armSliceCost, } from './slice-cost-log.ts';
import { guardFootnoteAssembly, } from './assembly-integrity.ts';
import {
  assertReplacementsChange,
  deriveShippedIndices,
  orderedChangeSets,
} from './assembly-invariant.ts';
import {
  translateRunShape,
  translateSliceKey,
} from './translate-slice-key.ts';
import type {
  TranslateDocumentResult,
  TranslateModels,
  TranslateSliceRecord,
  UnfilledSlice,
} from './translate-document-contract.ts';

import {
  assertUnheardKeptIncumbent,
  heardNobody,
  unheardCacheDiscardFinding,
} from './translate-unheard.ts';

//region Translate document
// The lane's document driver: every prepared slice is translated, judged, and
// settled into one record, and the accepted text is assembled back into a whole
// translation.
//
// EVERY SLICE, UNCONDITIONALLY. The repair driver returns early on several
// paths, and those paths are exactly the slices translation exists to recover:
// a fluent but mediocre translation that no critic complains about is never
// repaired and must still be translated. So nothing here decides whether a
// slice is worth visiting.
//
// A run that cannot finish THROWS rather than returning what it has. A result
// reporting unvisited slices as unchanged is indistinguishable from a document
// that needed no translation, and the settled slices are already in the cache
// for the next attempt.
//
// ONE EXCEPTION, and it is not an unvisited slice: a passage the archive never
// translated that this run could not translate either. Nothing was skipped
// there and nothing is claimed; the document keeps the gap it came with, the
// result says `unfilled` and names the passage, and the entry still settles so
// the rest of its slices keep what they cost.
//
// NOTHING BELOW THE DRIVER RAISES THAT ALARM. An abort reaches every exchange
// as a torn-down stream, `runGatherRound` records each one as a lost voice, and
// a stage that heard nothing keeps the incumbent and reports an ordinary
// settled slice. So the abort checks here are not belt-and-braces over a stage
// that would have thrown: they are the only place the collapse is visible, and
// without them a spent entry deadline writes "kept, unjudged" into the cache
// for every slice it never reached.

/**
 * Translates every slice of a prepared document pair and reassembles it.
 *
 * @param client - injected model client
 *
 * @param prepared - slices, governance and declared names, shared with any
 * other lane running over the same document
 *
 * @param models - translator and judge rosters
 *
 * @param signal - entry deadline and caller abort, honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param sliceCache - resumable per-slice cache, absent when a caller wants no
 * resumption
 *
 * @param l - pipeline logger
 *
 * @returns Reassembled translation, its `status`, one settled record per
 * FILLED slice, and every passage this run left missing
 *
 * @throws {@link Error} when the roster cannot seat a stage, or when the caller
 * aborts while this lane is buying
 *
 * @throws Whatever `signal.reason` carries, once the caller aborts with slices
 * still unbought; nothing settled under that abort is cached
 *
 * @example
 * ```ts
 * const { translatedText, slices, } = await translateDocument({ client, prepared, models, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function translateDocument(
  {
    client,
    prepared,
    models,
    signal,
    perCallTimeoutMs,
    sliceCache,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly prepared: PreparedDocumentPair;
    readonly models: TranslateModels;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly sliceCache?: SliceCache<TranslateSliceRecord>;
    readonly l: Logger;
  }>,
): Promise<TranslateDocumentResult> {
  // FIRST, before the run shape and before the cache lookup: a fully cached
  // document must not make an invalid configuration valid. A stage with nobody
  // in it settles exactly like one whose voices all failed, and only one of
  // those is the operator's to fix.
  assertRostersConfigured({
    lane: 'translate',
    roles: {
      translatorModelIds: models.translatorModelIds,
      judgeModelIds: models.judgeModelIds,
    },
  },);

  /**
   * Logger tagged with this driver.
   */
  const tl = tagged({
    tag: translateDocument.name,
    l,
  },);

  /**
   * What this run asks, folded into every key.
   */
  const runShape = translateRunShape({
    models,
    ...((prepared.identityContext === undefined)
      ? {}
      : { identityContext: prepared.identityContext, }),
  },);

  /**
   * Settled records in document order, plus how many were resumed.
   */
  const settled: TranslateSliceRecord[] = [];

  /**
   * Slices this run did not have to buy.
   */
  const counted = { resumed: 0, };

  /**
   * Cached records refused for contradicting themselves, named in the result so
   * a recomputed slice is distinguishable from one that was never cached.
   */
  const refusedCacheFindings: string[] = [];

  /**
   * Records this run settled, by the key they answer.
   *
   * WITHIN one run, for the same reason the cache holds them across runs: two
   * slices carrying identical source, incumbent and governance ask one
   * question, and since version 2 the key says so. Without this, a COLD run
   * would ask the models twice, keep two different answers and persist both
   * under one key, while the next WARM run resumed a single record for both
   * slices, so the same document settled differently depending on whether a
   * cache existed. No such pair occurs in the 92 pinned documents; this is what
   * keeps the two paths agreeing when one does.
   */
  const settledByKey = new Map<string, TranslateSliceRecord>();

  /**
   * Slices with no translation in the archive that this run could not fill.
   *
   * Kept as a list rather than counted, because every later reader needs to
   * know WHICH passages are still missing: the document ships with the gap the
   * archive already had, and nothing else in the result says so.
   */
  const unfilled: UnfilledSlice[] = [];

  /**
   * What those slices reported before giving up, plus one sentence per slice
   * naming it and why.
   *
   * FLAT, and kept beside the structured entries rather than instead of them.
   * A corpus-wide count of voice loss reads this list; a reader asking which
   * passage a finding belongs to reads the entry. Neither answers the other's
   * question, and deriving one from the other would lose that.
   */
  const unfilledFindings: string[] = [];
  for (const slice of prepared.slices) {
    /**
     * Global index of this slice, which every record and replacement names.
     */
    const { chunkIndex, } = slice.target;

    /**
     * What this slice cost, reported however this loop body is left.
     */
    using cost = armSliceCost({
      l: tl,
      lane: 'translate',
      chunkIndex,
      sourceChars: slice.source
        .text
        .length,
    },);

    /**
     * Whether the archive holds a translation for this slice at all, which
     * decides both what its key answers and what a fruitless round means.
     */
    const incumbentKind: IncumbentKind = isInsertionChunk(slice.target,)
      ? 'absent'
      : 'present';

    /**
     * Cross-run key for it.
     */
    const key = translateSliceKey({
      runShape,
      sourceText: slice.source
        .text,
      incumbentText: slice.target
        .text,
      incumbentKind,
      lineStructured: prepared.lineStructuredSliceIndices
        .has(chunkIndex,),
    },);

    /**
     * Record an earlier RUN settled for this question, which is what the
     * resumed count reports.
     */
    const cached = sliceCache?.resumed
      .get(key,);

    /**
     * Record already settled for this exact question, whether by an earlier run
     * or earlier in this one. An in-run repeat is deliberately not counted as
     * resumed: nothing was recovered from disk, and reporting it as a cache hit
     * would overstate what resumption is buying.
     */
    const resumed = cached ?? settledByKey.get(key,);
    if (resumed !== undefined) {
      // A record whose flag and text contradict each other is refused HERE
      // rather than at assembly, where the same contradiction fails the whole
      // document after every other slice has been bought. Discarded, this slice
      // simply costs what an uncached one costs.
      // NEVER WRITTEN BY THIS DRIVER, which refuses to cache a slice no
      // translator answered for. One in the cache came from an older build, and
      // resuming it would settle a slice that reports the archive standing by
      // default without anybody having asked again.
      if (heardNobody({ record: resumed, },)) {
        /**
         * Why this slice is being asked again rather than resumed.
         */
        const unheard = unheardCacheDiscardFinding({ chunkIndex, },);
        tl.warn(unheard,);
        refusedCacheFindings.push(unheard,);
      }
      else if (sliceRecordAgrees({
        changed: resumed.changed,
        decidedText: resumed.outputText,
        incumbentText: slice.target
          .text,
      },)) {
        if (cached !== undefined)
          counted.resumed += 1;
        // RE-STAMPED with the index this run asked under, rather than trusting
        // the one the record was computed with. Since version 2 the key is the
        // texts and the run shape, so an identical slice sitting elsewhere in
        // the document legitimately answers here, and its own index would name
        // the wrong slice in every replacement and issue record built from it.
        settled.push({
          ...resumed,
          chunkIndex,
        },);
        cost.left({ exit: 'resumed', },);
        continue;
      }

      /**
       * Why this slice was recomputed, which a cache miss would not explain.
       */
      const discarded = resumedSliceDiscardFinding({
        lane: 'translate',
        chunkIndex,
        changed: resumed.changed,
      },);
      tl.warn(discarded,);
      refusedCacheFindings.push(discarded,);
    }

    // Checked here rather than at the top of the iteration, so a document whose
    // every slice is already cached still finishes: what a stopped run cannot
    // do is BUY the slices it is missing.
    signal.throwIfAborted();

    /* oxlint-disable no-await-in-loop -- sequential by design: aggregate concurrency beyond one stream per model collapses throughput on this plan, and the stage already fans out per model inside the slice */
    /**
     * Fresh record for this slice, translated and judged.
     */
    const attempt = await attemptTranslateSlice({
      client,
      slice,
      prepared,
      models,
      signal,
      perCallTimeoutMs,
      l: tl,
    },);

    // A run stopped part way through a slice does NOT fail loudly on its own:
    // every abandoned exchange reaches the stage as silence, and a stage that
    // heard nothing keeps the incumbent and reports a settled slice. Caching
    // that would record the collapse as finished work, and every later attempt
    // would resume it rather than ask again.
    signal.throwIfAborted();
    if (attempt.kind === 'unfilled') {
      // ONE SLICE RATHER THAN THE ENTRY. The archive has no wording here, so
      // there is nothing to fall back on and nothing to write; what the
      // document keeps is the gap it already had. Every other slice is still
      // worth what it cost, and the next run asks again, because nothing is
      // cached for a slice that produced nothing.
      tl.warn(
        `slice ${String(chunkIndex,)}: no translation in the archive and none produced (${
          attempt.reason
        }); the passage stays missing and the slice is NOT cached`,
      );
      unfilled.push({
        chunkIndex,
        reason: attempt.reason,
        findings: attempt.findings,
      },);
      unfilledFindings.push(
        ...attempt.findings,
        `${absenceFinding({ reason: attempt.reason, },)} chunk ${String(chunkIndex,)}`,
      );
      cost.left({ exit: 'unfilled', },);
      continue;
    }

    /**
     * Record this round settled.
     */
    const { record, } = attempt;

    // Checked on the way OUT of the stage as well as on the way back in from
    // the cache, and before the write either way, so nothing contradicting
    // itself is ever stored. The stage derives `changed` from its own text
    // today, which makes this vacuous by construction; what it pins is that it
    // keeps doing so.
    assertSettledRecordAgrees({
      lane: 'translate',
      chunkIndex,
      changed: record.changed,
      decidedText: record.outputText,
      incumbentText: slice.target
        .text,
    },);
    // WHAT HEARING NOBODY HAS TO MEAN, checked before the record is kept. The
    // branch below rests on it, and so does every wording built from this
    // record afterwards.
    assertUnheardKeptIncumbent({
      chunkIndex,
      record,
      incumbentText: slice.target
        .text,
    },);
    if (heardNobody({ record, },)) {
      tl.warn(
        `slice ${String(chunkIndex,)}: no translator was heard, so the incumbent `
          + 'stands for this run and the slice is NOT cached',
      );
    }
    else {
      await sliceCache?.persist({
        key,
        serialized: JSON.stringify(
          record,
          undefined,
          2,
        ),
      },);

      // MEMOIZED EXACTLY WHERE IT IS PERSISTED, which is the point of the
      // memoization: a warm run can only resume what reached the cache, so an
      // in-run twin must reuse only what a warm run would have found. Doing it
      // unconditionally reused a record this driver deliberately refused to
      // store, and broke the cold-warm agreement it exists to keep.
      settledByKey.set(
        key,
        record,
      );
    }
    /* oxlint-enable no-await-in-loop */
    settled.push(record,);
  }

  // ASSEMBLED ELSEWHERE, because everything past this point is derived from
  // what the loop settled: which slices moved, what the whole document
  // refuses, and what a reader is told about each. Nothing after this line
  // buys anything, and keeping it here put two jobs in one file.
  return assembleTranslation({
    prepared,
    settled,
    unfilled,
    resumedSliceCount: counted.resumed,
    findings: [
      ...refusedCacheFindings,
      ...unfilledFindings,
    ],
    l: tl,
  },);
}

//endregion Translate document
