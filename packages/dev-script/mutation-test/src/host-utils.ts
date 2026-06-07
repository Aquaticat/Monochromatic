/**
 * Host-side utility barrel for mutation orchestration.
 *
 * @example
 * ```ts
 * import { findRepoRoot, runBounded } from './host-utils.ts';
 * ```
 */

export { runBounded, } from './bounded-queue.ts';
export { findRepoRoot, } from './host-repo.ts';
export {
  defaultWorkerCount,
  memoryBytes,
} from './host-resources.ts';
export {
  reportNameForSource,
  resolveRequestedSources,
} from './host-source.ts';
