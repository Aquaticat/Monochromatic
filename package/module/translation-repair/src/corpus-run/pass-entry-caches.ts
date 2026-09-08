import type { PipelineDigest, } from './pipeline-digest.ts';
import { openPictureReadingCache, } from './reading-cache-store.ts';
import {
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

//endregion Pass entry caches
