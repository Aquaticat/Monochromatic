/**
 * Re-exports monorepo root discovery from `\@monochromatic-dev/module-fs-path`.
 *
 * @see {@link findMonorepoRoot} for the fresh-walk function
 *
 * @see {@link findMonorepoRootCached} for the process-lifetime memoised
 *   variant; prefer it on hot paths
 */

export {
  findMonorepoRoot,
  findMonorepoRootCached,
} from '@monochromatic-dev/module-fs-path/find-monorepo-root';
