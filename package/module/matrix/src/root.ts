/**
 * Re-exports monorepo root discovery from `\@monochromatic-dev/module-fs-path`.
 *
 * @see {@link findMiseMonorepoRoot} for the fresh-walk function
 *
 * @see {@link findMiseMonorepoRootCached} for the process-lifetime memoised
 *   variant; prefer it on hot paths
 */

export {
  findMiseMonorepoRoot,
  findMiseMonorepoRootCached,
} from '@monochromatic-dev/module-fs-path/ts';
