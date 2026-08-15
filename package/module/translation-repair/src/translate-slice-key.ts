import { hashContent, } from './document-node.ts';
import {
  MAX_INCUMBENT_TO_SOURCE_RATIO,
  MIN_PROTECTED_INCUMBENT,
} from './translate-alignment.ts';
import {
  type TranslateModels,
  TRANSLATE_SLICE_CACHE_VERSION,
} from './translate-document-contract.ts';

//region Translate slice key
// What makes two runs' translate slices the SAME slice, for cache purposes.
//
// Split from the driver for the same two reasons `repair-slice-key.ts` was: the
// key is the one piece of a driver that can be tested without a client, and a
// reader of the driver does not want the cache reasoning in the middle of it.
// The two lanes cache into one directory, so their key derivations are meant to
// be read side by side.

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

//endregion Translate slice key
