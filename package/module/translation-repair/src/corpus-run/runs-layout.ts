import { mkdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import { DECLINED_DIR, } from './declined-entries.ts';
import { FIXED_TREE_DIR, } from './publish-fixed.ts';

//region Runs directory layout
// Where a pass puts what it leaves behind, split out of `corpus-pass.ts` at
// its line budget. Every path is under the one runs directory so a throwaway
// run leaves a throwaway tree and nothing carrying corpus wording can reach
// git: runs directories live outside this repository.

/**
 * The directories and files one pass reads and writes under its runs dir.
 *
 * @example
 * ```ts
 * const layout: RunsLayout = await prepareRunsLayout({ runsDir, },);
 * ```
 */
export type RunsLayout = {
  /**
   * Per-entry artifact directory, one JSON per settled entry.
   */
  readonly artifactsDir: string;

  /**
   * Root of the corpus tree the pass publishes its fixed pages into.
   */
  readonly publishDir: string;

  /**
   * Directory of decline records, one per entry the pipeline declined to
   * repair because the archive's note says the page is the author's own
   * English (the owner's rule of 2026-09-08); read into the skip set beside
   * the artifacts, since a declined entry is done for every later pass too.
   */
  readonly declinedDir: string;

  /**
   * Root of per-entry slice caches making large documents resumable.
   */
  readonly sliceCacheDir: string;

  /**
   * Persisted attempt-count map path.
   */
  readonly attemptsPath: string;
};

/**
 * Names every path under a runs dir and creates the two the pass promises to
 * leave behind even when it settles nothing.
 *
 * THE ARTIFACTS DIRECTORY AND THE PUBLISHED TREE ARE CREATED HERE rather than
 * lazily at the first entry, so a pass that settles no entry still leaves the
 * empty tree it promised rather than nothing. The tree sits BESIDE the
 * artifacts, under the same runs directory, so a tree carrying corpus wording
 * inherits the property that keeps that wording safe.
 *
 * @param runsDir - durable, gitignored output root for this run
 *
 * @returns Every path the pass uses
 *
 * @example
 * ```ts
 * const { artifactsDir, publishDir, } = await prepareRunsLayout({ runsDir, },);
 * ```
 */
export async function prepareRunsLayout(
  { runsDir, }: { readonly runsDir: string; },
): Promise<RunsLayout> {
  /**
   * Per-entry artifact directory.
   */
  const artifactsDir = join(
    runsDir,
    'artifacts',
  );
  await mkdir(
    artifactsDir,
    { recursive: true, },
  );
  /**
   * Root of the published tree.
   */
  const publishDir = join(
    runsDir,
    FIXED_TREE_DIR,
  );
  await mkdir(
    publishDir,
    { recursive: true, },
  );
  return {
    artifactsDir,
    publishDir,
    declinedDir: join(
      runsDir,
      DECLINED_DIR,
    ),
    sliceCacheDir: join(
      runsDir,
      'slice-cache',
    ),
    attemptsPath: join(
      runsDir,
      'attempts.json',
    ),
  };
}

//endregion Runs directory layout
