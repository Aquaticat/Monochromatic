import {
  globs,
  reads,
  type TrackedGlob,
} from '../tracker.ts';
import {
  rememberFreshStalenessEntry,
  stalenessKeyForDest,
  stalenessKeyForDestGlob,
} from './staleness.ts';
import type { GlobDestination, } from './write-each-destinations.ts';

/**
 * Returns globally tracked glob expansions in manifest-ready form.
 *
 * @returns Glob expansions observed during the current config execution.
 *
 * @example
 * ```ts
 * const trackedGlobs = currentTrackedGlobs();
 * ```
 */
function currentTrackedGlobs(): readonly TrackedGlob[] {
  return [...globs.entries(),]
    .map(function toTrackedGlob(entry,): TrackedGlob {
      /**
       * Glob pattern and matched paths tuple.
       */
      const [pattern, paths,] = entry;
      return {
        pattern,
        paths,
      };
    },);
}

/**
 * Records staleness metadata for an eager write call.
 *
 * @param dest - Destination file path.
 *
 * @param content - Generated destination content.
 *
 * @example
 * ```ts
 * rememberEagerWrite({ dest: './CLAUDE.md', content: '...' });
 * ```
 */
export function rememberEagerWrite(
  {
    dest,
    content,
    manifestPath,
  }: {
    readonly dest: string;
    readonly content: string;
    readonly manifestPath?: string;
  },
): void {
  /**
   * Manifest entry data shared by default and custom manifest paths.
   */
  const entry = {
    key: stalenessKeyForDest(dest,),
    kind: 'single' as const,
    trackedReads: [...reads,],
    trackedGlobs: currentTrackedGlobs(),
    destinations: [{
      path: dest,
      content,
    },],
  };
  rememberFreshStalenessEntry(manifestPath === undefined
    ? entry
    : {
      manifestPath,
      ...entry,
    },);
}

/**
 * Records staleness metadata for an eager glob mirror rule.
 *
 * @param destGlob - Destination glob pattern.
 *
 * @param destinations - Concrete destinations written by the rule.
 *
 * @example
 * ```ts
 * rememberEagerEach({ destGlob: './out/*.md', destinations });
 * ```
 */
export function rememberEagerEach(
  {
    destGlob,
    destinations,
    manifestPath,
  }: {
    readonly destGlob: string;
    readonly destinations: readonly GlobDestination[];
    readonly manifestPath?: string;
  },
): void {
  /**
   * Manifest entry data shared by default and custom manifest paths.
   */
  const entry = {
    key: stalenessKeyForDestGlob(destGlob,),
    kind: 'each' as const,
    trackedReads: [...reads,],
    trackedGlobs: currentTrackedGlobs(),
    destinations,
  };
  rememberFreshStalenessEntry(manifestPath === undefined
    ? entry
    : {
      manifestPath,
      ...entry,
    },);
}
