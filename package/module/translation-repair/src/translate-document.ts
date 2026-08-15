import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import { buildLaneSliceTexts, } from './lane-slice-text.ts';
import {
  resumedSliceAgrees,
  resumedSliceDiscardFinding,
} from './resumed-slice.ts';
import type { SliceCache, } from './slice-cache.ts';
import { guardFootnoteAssembly, } from './assembly-integrity.ts';
import {
  assertReplacementsChange,
  deriveShippedIndices,
  orderedChangeSets,
} from './assembly-invariant.ts';
import {
  alignmentRefusalFinding,
  MAX_INCUMBENT_TO_SOURCE_RATIO,
  MIN_PROTECTED_INCUMBENT,
} from './translate-alignment.ts';
import {
  type TranslateDocumentResult,
  type TranslateModels,
  type TranslateSliceRecord,
  TRANSLATE_SLICE_CACHE_VERSION,
} from './translate-document-contract.ts';
import { settleTranslateSlice, } from './translate-slice.ts';

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
// NOTHING BELOW THE DRIVER RAISES THAT ALARM. An abort reaches every exchange
// as a torn-down stream, `runGatherRound` records each one as a lost voice, and
// a stage that heard nothing keeps the incumbent and reports an ordinary
// settled slice. So the abort checks here are not belt-and-braces over a stage
// that would have thrown: they are the only place the collapse is visible, and
// without them a spent entry deadline writes "kept, unjudged" into the cache
// for every slice it never reached.

/**
 * Everything about this run that changes what the models are ASKED, folded into
 * every cache key.
 *
 * Without it a resumed slice could return a record produced under a different
 * roster or a different alignment threshold, and nothing would look wrong: the
 * texts match, so the key matches. Identity context belongs here for the same
 * reason, since it is front-matter-derived prompt content that varies per pair.
 *
 * `perCallTimeoutMs` is deliberately ABSENT. It changes how long a voice has to
 * answer, not what it is asked, and the roster retries to quorum, so the heard
 * set already varies between runs over one key. Including it would make every
 * deadline change discard every settled translation in the corpus.
 *
 * @param models - translator and judge rosters
 *
 * @param identityContext - declared names travelling with every slice
 *
 * @returns Stable string for the key
 *
 * @example
 * ```ts
 * const runShape = translateRunShape({ models, identityContext, },);
 * ```
 */
export function translateRunShape(
  {
    models,
    identityContext,
  }: {
    readonly models: TranslateModels;
    readonly identityContext?: string;
  },
): string {
  return JSON.stringify([
    models.translatorModelIds,
    models.judgeModelIds,
    identityContext ?? '',
    MIN_PROTECTED_INCUMBENT,
    MAX_INCUMBENT_TO_SOURCE_RATIO,
  ],);
}

/**
 * Cross-run key for one slice under the translate lane.
 *
 * @param runShape - what this run asks, from {@link translateRunShape}
 *
 * @param chunkIndex - global slice index
 *
 * @param sourceText - slice original
 *
 * @param incumbentText - translation already there
 *
 * @param lineStructured - whether the enclosing chunk is line-structured
 *
 * @returns Hash keying this slice's record
 *
 * @example
 * ```ts
 * const key = translateSliceKey({ runShape, chunkIndex, sourceText, incumbentText, lineStructured, },);
 * ```
 */
export function translateSliceKey(
  {
    runShape,
    chunkIndex,
    sourceText,
    incumbentText,
    lineStructured,
  }: {
    readonly runShape: string;
    readonly chunkIndex: number;
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly lineStructured: boolean;
  },
): string {
  return hashContent({
    content: JSON.stringify([
      'translate',
      TRANSLATE_SLICE_CACHE_VERSION,
      runShape,
      chunkIndex,
      sourceText,
      incumbentText,
      // Two slices can carry identical text and still be governed differently,
      // because the verdict belongs to the enclosing chunk.
      lineStructured,
    ],),
  },);
}

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
 * @returns Reassembled translation with one settled record per slice
 *
 * @throws {@link Error} when a cached record names another slice, which means
 * the key derivation and the slicing disagree
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
  for (const slice of prepared.slices) {
    /**
     * Global index of this slice, which every record and replacement names.
     */
    const { chunkIndex, } = slice.target;

    /**
     * Cross-run key for it.
     */
    const key = translateSliceKey({
      runShape,
      chunkIndex,
      sourceText: slice.source
        .text,
      incumbentText: slice.target
        .text,
      lineStructured: prepared.lineStructuredSliceIndices
        .has(chunkIndex,),
    },);

    /**
     * Record settled on an earlier run, when this slice is cached.
     */
    const resumed = sliceCache?.resumed
      .get(key,);
    if (resumed !== undefined) {
      if (resumed.chunkIndex !== chunkIndex) {
        throw new Error(
          `cached translate slice ${String(resumed.chunkIndex,)} was loaded for `
            + `slice ${String(chunkIndex,)}: the key derivation and the slicing `
            + 'disagree, so every resumed record is suspect',
        );
      }

      // A record whose flag and text contradict each other is refused HERE
      // rather than at assembly, where the same contradiction fails the whole
      // document after every other slice has been bought. Discarded, this slice
      // simply costs what an uncached one costs.
      if (resumedSliceAgrees({
        changed: resumed.changed,
        decidedText: resumed.outputText,
        incumbentText: slice.target
          .text,
      },)) {
        counted.resumed += 1;
        settled.push(resumed,);
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
    const record = await (async function settleUnderSignal(): Promise<TranslateSliceRecord> {
      try {
        return await settleTranslateSlice({
          client,
          slice,
          prepared,
          models,
          signal,
          perCallTimeoutMs,
          l: tl,
        },);
      }
      catch (error) {
        // An aborted run fails BECAUSE it was aborted; whichever torn-down
        // exchange happened to surface is a symptom. The caller has to tell a
        // spent deadline apart from a provider fault by identity alone, and
        // only one of those is worth retrying the entry over.
        if (!signal.aborted)
          throw error;
        tl.warn(
          `slice ${String(chunkIndex,)}: abandoned by the caller's abort (${String(error,)})`,
        );
        throw signal.reason;
      }
    })();

    // A run stopped part way through a slice does NOT fail loudly on its own:
    // every abandoned exchange reaches the stage as silence, and a stage that
    // heard nothing keeps the incumbent and reports a settled slice. Caching
    // that would record the collapse as finished work, and every later attempt
    // would resume it rather than ask again.
    signal.throwIfAborted();
    if (record.stageResult
      .heardTranslators
      === 0) {
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
    }
    /* oxlint-enable no-await-in-loop */
    settled.push(record,);
  }

  /**
   * Slices whose accepted text differs from the archive's.
   */
  const changed = settled.filter(function isChanged(record,): boolean {
    return record.changed;
  },);

  /**
   * Slices where the guard refused a replacement the judges chose.
   */
  const refused = settled.filter(function wasRefused(record,): boolean {
    return record.disposition === 'refused-alignment';
  },);

  /**
   * Slices no translator answered for, which stand on the incumbent and are
   * deliberately absent from the cache.
   */
  const unheard = settled.filter(function heardNobody(record,): boolean {
    return record.stageResult
      .heardTranslators
      === 0;
  },);
  tl.info(
    `translated ${String(settled.length,)} slices (${String(counted.resumed,)} resumed): `
    + `${String(changed.length,)} changed, ${String(refused.length,)} refused on alignment`,
  );

  /**
   * What this lane wants written, checked before the guard sees it.
   *
   * A RESUMED record is trusted on its slice index alone, so one claiming a
   * change while carrying the archive wording would survive the guard and land
   * in the shipped set beside a document nobody changed. Refused here instead.
   */
  const replacements = changed.map(function toReplacement(record,) {
    return {
      chunkIndex: record.chunkIndex,
      replacementText: record.outputText,
    };
  },);
  assertReplacementsChange({
    slices: prepared.slices,
    replacements,
  },);

  /**
   * Assembly with any replacement withdrawn that the whole document refuses.
   *
   * Runs here rather than inside a slice because everything it checks is a
   * relation BETWEEN slices: a footnote's reference and definition are settled
   * separately, so a candidate that drops or renumbers a marker validates
   * perfectly on its own, and a set that reassembles to the archive text is a
   * fact no single slice can see.
   */
  const guarded = guardFootnoteAssembly({
    targetText: prepared.targetText,
    slices: prepared.slices,
    replacements,
  },);
  if (guarded.revertedChunkIndices
    .length
    > 0) {
    // Deliberately does not name a cause. The guard withdraws for footnote
    // damage, for structural regressions, and for a set that reassembles to the
    // archive text; only its findings say which, and a warning that guessed
    // would send a reader looking for a footnote that is not there.
    tl.warn(
      `withdrew ${
        String(guarded.revertedChunkIndices
          .length,)
      } replacements at assembly; the findings say why`,
    );
  }

  /**
   * Slices the returned document carries a change for, derived from the
   * surviving replacements and checked against the document's own bytes.
   *
   * Derived here rather than mapped by this driver, so the text and the index
   * set cannot disagree about which slices moved.
   */
  const shipped = deriveShippedIndices({
    incumbentText: prepared.targetText,
    assembledText: guarded.assembledText,
    slices: prepared.slices,
    survivingReplacements: guarded.replacements,
  },);

  /**
   * Both index sets, checked against each other and put in document order.
   *
   * The guard returns each in the order it worked, and a reader comparing two
   * lanes wants document order for both.
   */
  const ordered = orderedChangeSets({
    sliceCount: prepared.slices
      .length,
    shipped,
    withdrawn: guarded.revertedChunkIndices,
  },);

  return {
    translatedText: guarded.assembledText,
    sliceCount: prepared.slices
      .length,
    // What SHIPPED, which is not what the judges chose whenever the guard
    // withdrew one of their choices.
    changedSliceCount: guarded.replacements
      .length,
    refusedSliceCount: refused.length,
    withdrawnSliceCount: guarded.revertedChunkIndices
      .length,
    // The same surviving replacements the count above is the size of, named,
    // and checked against the withdrawn set before either is reported.
    shippedChunkIndices: ordered.shipped,
    withdrawnChunkIndices: ordered.withdrawn,
    // Every prepared slice paired with the archive wording it was judged
    // against. Taken from the PREPARATION rather than from the settled records,
    // which are cache values a resumed run may have written under an earlier
    // preparation of the same entry.
    sliceTexts: buildLaneSliceTexts({
      slices: prepared.slices,
      // This lane visits every slice by contract and throws rather than
      // returning a partial document, so a gap is a defect.
      undecided: 'refuse',
      decided: settled.map(function toDecision(record,): {
        readonly chunkIndex: number;
        readonly text: string;
      } {
        return {
          chunkIndex: record.chunkIndex,
          text: record.outputText,
        };
      },),
    },),
    resumedSliceCount: counted.resumed,
    slices: settled,
    findings: [
      ...refusedCacheFindings,
      ...settled.flatMap(function toFindings(record,): readonly string[] {
        return record.findings;
      },),
      ...guarded.findings,
      ...unheard.map(function toUnheardFinding(record,): string {
        return `translate-heard-no-translator chunk ${
          String(record.chunkIndex,)
        }; incumbent stands, slice not cached`;
      },),
    ],
  };
}

/**
 * Names what the alignment guard measured, for callers building a report.
 *
 * @param records - settled slice records
 *
 * @returns Refusal findings in the order the slices appear
 *
 * @example
 * ```ts
 * const refusals = alignmentRefusals({ records: result.slices, },);
 * ```
 */
export function alignmentRefusals(
  { records, }: { readonly records: readonly TranslateSliceRecord[]; },
): readonly string[] {
  return records
    .filter(function wasRefused(record,): boolean {
      return record.disposition === 'refused-alignment';
    },)
    .map(function toFinding(record,): string {
      return alignmentRefusalFinding({
        chunkIndex: record.chunkIndex,
        assessment: record.alignment,
      },);
    },);
}

//endregion Translate document
