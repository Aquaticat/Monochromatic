import type { PipelineDigest, } from './pipeline-digest.ts';
import { openPictureReadingCache, } from './reading-cache-store.ts';
import { tallyErrorText, } from './tally-error-text.ts';
import {
  discardSliceCache,
  openRefineSliceCache,
  openSliceCache,
  openTranslateSliceCache,
} from './slice-cache-store.ts';

//region Pass entry caches
// The four stores one entry resumes from, opened together, split out of
// `pass-entry.ts` at its line budget. Each lives in its own namespace under the
// entry's cache directory so one entry's caches are retired together and no
// lane can resume another's slices.

/**
 * Every cache one entry's stages read and write.
 *
 * @example
 * ```ts
 * const caches: EntryCaches = await openEntryCaches({ entryCacheDir, pipelineDigest, },);
 * ```
 */
export type EntryCaches = {
  /**
   * Repair lane's cross-run cache, resuming finished slices and persisting new
   * ones as each completes.
   */
  readonly sliceCache: Awaited<ReturnType<typeof openSliceCache>>;

  /**
   * Translate lane's own cache.
   */
  readonly translateSliceCache: Awaited<ReturnType<typeof openTranslateSliceCache>>;

  /**
   * Naturalness lane's own cache.
   *
   * SEPARATE FROM THE REPAIR LANE'S because it runs AFTER that lane has
   * persisted every slice, so its answers cannot ride in a record written
   * before it was asked. Without it a resumed entry replayed the accuracy pass
   * from disk and then rebought the whole rewrite, publishing different text
   * on identical inputs.
   */
  readonly refineSliceCache: Awaited<ReturnType<typeof openRefineSliceCache>>;

  /**
   * Store for what this entry's pictures were read as.
   *
   * ITS OWN NAMESPACE beside the two lanes', because a reading is neither
   * lane's slice: it is evidence keyed by the picture, gathered before either
   * lane runs and shown to one of them.
   */
  readonly readingCache: Awaited<ReturnType<typeof openPictureReadingCache>>;
};

/**
 * Opens every cache one entry resumes from, generation-stamped by the built
 * pipeline so a changed pipeline cannot resume foreign slices.
 *
 * @param entryCacheDir - this entry's own cache directory
 *
 * @param pipelineDigest - identity of the built pipeline
 *
 * @returns The four caches
 *
 * @example
 * ```ts
 * const { sliceCache, readingCache, } = await openEntryCaches({ entryCacheDir, pipelineDigest, },);
 * ```
 */
export async function openEntryCaches(
  {
    entryCacheDir,
    pipelineDigest,
  }: {
    readonly entryCacheDir: string;
    readonly pipelineDigest: PipelineDigest;
  },
): Promise<EntryCaches> {
  return {
    sliceCache: await openSliceCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },),
    translateSliceCache: await openTranslateSliceCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },),
    refineSliceCache: await openRefineSliceCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },),
    readingCache: await openPictureReadingCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },),
  };
}

/**
 * Retires a settled entry's caches without changing its already recorded outcome.
 *
 * @param entryId - settled entry named by cleanup diagnostics
 *
 * @param dir - entry-owned cache directory
 *
 * @example
 * ```ts
 * await retireSettledEntryCache({ entryId, dir, });
 * ```
 */
export async function retireSettledEntryCache(
  { entryId, dir, }: { readonly entryId: string; readonly dir: string; },
): Promise<void> {
  try {
    // The entry settled, so its slice cache is spent; drop it to keep the cache
    // directory bounded to in-flight large documents. AFTER the artifact write,
    // never before: a discard that ran first would turn a failed write into a
    // full re-buy of every slice.
    await discardSliceCache({ dir, },);
  }
  catch (error) {
    // A CLEANUP LINE, NEVER A SECOND TALLY. The artifact is already on disk, so
    // this entry IS settled; the old shape ran the discard inside the same try
    // as the pipeline, so a failed unlink logged `TALLY status=ERROR` after the
    // success line and every reader counting statuses saw one entry as both.
    // What is left behind is a stale cache directory, which costs disk and
    // nothing else: the next run skips the entry on its artifact.
    console.log(`CLEANUP ${entryId} cache=retained error=${tallyErrorText({ error, },)}`,);
  }
}

//endregion Pass entry caches
