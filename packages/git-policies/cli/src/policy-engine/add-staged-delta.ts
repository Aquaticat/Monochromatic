/**
 * Exact staged-entry delta between one private index state and its successor.
 *
 * @module
 */
import {
  CommitTransactionGitError,
  runTransactionGit,
} from './commit-transaction-git.ts';

/**
 * Strict Git metadata decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 * Complete per-path index records joined across conflict stages.
 */
export type IndexRecordMap = ReadonlyMap<string, string>;

/**
 * Captures complete per-path index records for exact state comparison.
 *
 * Unmerged paths contribute one record per conflict stage, so conflict
 * resolution surfaces as a record change like any other staging operation.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param indexPath - private index
 *
 * @returns per-path joined stage records
 *
 * @example
 * ```ts
 * await captureIndexRecords({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index' });
 * ```
 */
export async function captureIndexRecords({
  gitPath,
  cwd,
  indexPath,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
}>,): Promise<IndexRecordMap> {
  /**
   * NUL-delimited complete stage records.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'ls-files',
      '--stage',
      '-z',
    ],
  },);
  /**
   * Per-path record accumulator across conflict stages.
   */
  const byPath = new Map<string, string>();
  for (const record of DECODER.decode(output.stdout,)
    .split('\0',)
    .filter(function nonempty(stageRecord,) {
      return stageRecord.length > 0;
    },)) {
    /**
     * Metadata/path separator.
     */
    const tab = record.indexOf('\t',);
    if (tab === (-1))
      throw new CommitTransactionGitError('Private index stage record lacks path separator.',);
    /**
     * Mode, object ID, and stage metadata.
     */
    const metadata = record.slice(
      0,
      tab,
    );
    /**
     * Repository-relative staged path.
     */
    const path = record.slice(tab + 1,);
    /**
     * Previously accumulated records for the same path.
     */
    const existing = byPath.get(path,);
    byPath.set(
      path,
      existing === undefined ? metadata : `${existing}\n${metadata}`,
    );
  }
  return byPath;
}

/**
 * Returns HEAD-present subset of candidate paths.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param paths - literal repository paths
 *
 * @returns paths present in HEAD tree, empty on unborn HEAD
 */
async function headPresentPaths({
  gitPath,
  cwd,
  paths,
}: Readonly<{
  gitPath: string;
  cwd: string;
  paths: readonly string[];
}>,): Promise<ReadonlySet<string>> {
  /**
   * Recursive HEAD listing scoped to literal candidate paths.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'ls-tree',
      '-r',
      '-z',
      '--name-only',
      'HEAD',
      '--',
      // Literal magic keeps glob characters in index paths from expanding.
      ...paths.map(function literalPathspec(path,) {
        return `:(literal)${path}`;
      },),
    ],
    allowFailure: true,
  },);
  if (output.exitCode !== 0)
    return new Set();
  return new Set(DECODER.decode(output.stdout,)
    .split('\0',)
    .filter(function nonempty(path,) {
      return path.length > 0;
    },),);
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- ReadonlyMap carries only read methods, yet the repo config keeps treatMethodsAsReadonly disabled to expose real mutable maps. See docs/troubleshooting/oxlint-prefer-readonly-authoring-identity.md. */
/**
 * Returns exactly the paths whose staged records this operation changed.
 *
 * Paths absent from both the successor index and HEAD carry no scannable
 * state (the operation merely unstaged a never-committed file) and are
 * dropped.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param indexPath - private index after the staging operation
 *
 * @param before - complete records captured before the staging operation
 *
 * @returns repository paths staged, restaged, or deletion-staged by the operation
 *
 * @example
 * ```ts
 * await stagedDeltaPaths({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index', before: new Map() });
 * ```
 */
export async function stagedDeltaPaths({
  gitPath,
  cwd,
  indexPath,
  before,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  before: IndexRecordMap;
}>,): Promise<readonly string[]> {
  /**
   * Complete records after the staging operation.
   */
  const after = await captureIndexRecords({
    gitPath,
    cwd,
    indexPath,
  },);
  /**
   * Paths whose complete stage records differ across the operation.
   */
  const changed = [...new Set([
    ...before.keys(),
    ...after.keys(),
  ],),].filter(function recordDiffers(path,) {
    return before.get(path,) !== after.get(path,);
  },);
  /**
   * Changed paths the operation removed from the index entirely.
   */
  const removed = changed.filter(function isRemoved(path,) {
    return !after.has(path,);
  },);
  if (removed.length === 0)
    return changed;
  /**
   * Removed paths that still exist in HEAD as staged deletions.
   */
  const headPaths = await headPresentPaths({
    gitPath,
    cwd,
    paths: removed,
  },);
  return changed.filter(function isScannable(path,) {
    return after.has(path,) || headPaths.has(path,);
  },);
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
