import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { PreparedDocumentPair, } from './document-preparation.ts';
import type { SliceCache, } from './slice-cache.ts';
import { spliceSlices, } from './splice-slices.ts';
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
      counted.resumed += 1;
      settled.push(resumed,);
      continue;
    }

    /* oxlint-disable no-await-in-loop -- sequential by design: aggregate concurrency beyond one stream per model collapses throughput on this plan, and the stage already fans out per model inside the slice */
    /**
     * Fresh record for this slice, translated and judged.
     */
    const record = await settleTranslateSlice({
      client,
      slice,
      prepared,
      models,
      signal,
      perCallTimeoutMs,
      l: tl,
    },);
    await sliceCache?.persist({
      key,
      serialized: JSON.stringify(
        record,
        undefined,
        2,
      ),
    },);
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
  tl.info(
    `translated ${String(settled.length,)} slices (${String(counted.resumed,)} resumed): `
    + `${String(changed.length,)} changed, ${String(refused.length,)} refused on alignment`,
  );

  return {
    translatedText: spliceSlices({
      targetText: prepared.targetText,
      slices: prepared.slices,
      replacements: changed.map(function toReplacement(record,) {
        return {
          chunkIndex: record.chunkIndex,
          replacementText: record.outputText,
        };
      },),
    },),
    sliceCount: prepared.slices
      .length,
    changedSliceCount: changed.length,
    refusedSliceCount: refused.length,
    resumedSliceCount: counted.resumed,
    slices: settled,
    findings: settled.flatMap(function toFindings(record,): readonly string[] {
      return record.findings;
    },),
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
