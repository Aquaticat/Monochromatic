/**
 * Manual-push candidate descriptors for pushed trees and per-commit deltas.
 *
 * @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  arrayBuffer,
  text,
} from 'node:stream/consumers';
import type {
  CandidateFile,
  CandidateFileMode,
} from '../api/policy-types.ts';
import { ManualPushProbeError, } from './manual-push-probe.ts';
import { parseRawDiffRecords, } from './raw-diff-records.ts';

/**
 * Git tree modes mapped to policy modes.
 */
const TREE_MODES: Readonly<Record<string, CandidateFileMode>> = {
  '100644': 'regular',
  '100755': 'executable',
  '120000': 'symlink',
  '160000': 'submodule',
};
/**
 * Strict decoder for Git metadata and paths.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 * Candidate metadata separated from batched object content.
 */
export type ManualPushCandidateDescriptor = Readonly<{
  /**
   * Invocation-local candidate identity.
   */
  targetId: string;
  /**
   * Repository-relative finding path.
   */
  path: CandidateFile['path'];
  /**
   * Exact Git object identity.
   */
  revision: string;
  /**
   * Candidate Git mode.
   */
  mode: CandidateFileMode;
  /**
   * Change classification toward the pushed destination.
   */
  change: CandidateFile['change'];
  /**
   * Content source resolved after every descriptor is known.
   */
  content: Readonly<{
    /**
     * Git blob content discriminator.
     */
    kind: 'blob';
    /**
     * Blob object ID requested from batch reader.
     */
    oid: string;
  }> | Readonly<{
    /**
     * Already-materialized content discriminator.
     */
    kind: 'inline';
    /**
     * Exact inline bytes.
     */
    bytes: Uint8Array;
  }>;
}>;

/**
 * Creates push-domain error for malformed raw diff output.
 *
 * @param message - safe failure explanation
 *
 * @returns manual-push probe failure
 */
function pushedDiffError(message: string,): Error {
  return new ManualPushProbeError(message,);
}

/**
 * Runs real Git and returns exact stdout bytes.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param args - exact Git arguments
 *
 * @returns exact stdout bytes
 *
 * @example
 * ```ts
 * await runGitBytes({ gitPath: '/usr/bin/git', cwd: '/repo', args: ['rev-parse', 'HEAD'] });
 * ```
 */
export async function runGitBytes({
  gitPath,
  cwd,
  args,
}: Readonly<{
  gitPath: string;
  cwd: string;
  args: readonly string[];
}>,): Promise<Uint8Array> {
  /**
   * Child process with binary stdout.
   */
  const child = spawn(
    gitPath,
    [...args,],
    {
      cwd,
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );
  /**
   * Concurrent output consumers.
   */
  const output = Promise.all([
    arrayBuffer(child.stdout,),
    text(child.stderr,),
  ],);
  await once(
    child,
    'close',
  );
  /**
   * Settled stdout and stderr.
   */
  const [stdout, stderr,] = await output;
  if (child.exitCode !== 0)
    throw new ManualPushProbeError(`git ${args.join(' ',)} failed: ${stderr.trim()}`,);
  return new Uint8Array(stdout,);
}

/**
 * Parses complete recursive tree into immutable candidates.
 *
 * Serves directly pushed tree objects, whose complete content is newly
 * published; pushed commits go through {@link commitDeltaCandidates}.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param treeish - commit or tree object
 *
 * @param targetPrefix - invocation-local target prefix
 *
 * @returns complete tree candidate descriptors
 *
 * @example
 * ```ts
 * await treeCandidates({ gitPath: '/usr/bin/git', cwd: '/repo', treeish: 'abc', targetPrefix: 'manual-push:origin:refs/trees/x:abc' });
 * ```
 */
export async function treeCandidates({
  gitPath,
  cwd,
  treeish,
  targetPrefix,
}: Readonly<{
  gitPath: string;
  cwd: string;
  treeish: string;
  targetPrefix: string;
}>,): Promise<readonly ManualPushCandidateDescriptor[]> {
  /**
   * NUL-delimited recursive tree records.
   */
  const records = DECODER.decode(await runGitBytes({
    gitPath,
    cwd,
    args: [
      'ls-tree',
      '--full-tree',
      '-r',
      '-z',
      treeish,
    ],
  },),)
    .split('\0',)
    .filter(function isRecord(record,) {
      return record.length > 0;
    },);
  return records.map(function toCandidate(record,): ManualPushCandidateDescriptor {
    /**
     * Metadata and path separator.
     */
    const pathSeparator = record.indexOf('\t',);
    if (pathSeparator === (-1))
      throw new ManualPushProbeError('Manual-push tree entry lacks path separator.',);
    /**
     * Space-delimited tree metadata.
     */
    const metadata = record.slice(
      0,
      pathSeparator,
    )
      .split(' ',);
    /**
     * Required Git tree fields.
     */
    const [modeText, objectType, objectOid,] = metadata;
    if ((modeText === undefined) || (objectType === undefined)
      || (objectOid === undefined))
      throw new ManualPushProbeError('Manual-push tree metadata is incomplete.',);
    /**
     * Policy mode.
     */
    const mode = TREE_MODES[modeText];
    if (mode === undefined)
      throw new ManualPushProbeError(`Unsupported manual-push tree mode: ${modeText}`,);
    if ((objectType !== 'blob') && (objectType !== 'commit'))
      throw new ManualPushProbeError(`Unsupported manual-push object type: ${objectType}`,);
    /**
     * Repository-relative path.
     */
    const path = record.slice(pathSeparator + 1,);
    return {
      targetId: `${targetPrefix}:${objectOid}:${path}`,
      path,
      revision: objectOid,
      mode,
      // A directly pushed tree object publishes its complete content.
      change: 'added',
      content: mode === 'submodule'
        ? {
          kind: 'inline',
          bytes: new TextEncoder().encode(objectOid,),
        }
        : {
          kind: 'blob',
          oid: objectOid,
        },
    };
  },);
}

/**
 * Parses one pushed commit's own delta into immutable candidates.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param commitOid - newly reachable pushed commit
 *
 * @param targetPrefix - invocation-local target prefix
 *
 * @returns content-bearing delta candidate descriptors
 *
 * @example
 * ```ts
 * await commitDeltaCandidates({ gitPath: '/usr/bin/git', cwd: '/repo', commitOid: 'abc', targetPrefix: 'manual-push:origin:refs/heads/main:abc' });
 * ```
 */
export async function commitDeltaCandidates({
  gitPath,
  cwd,
  commitOid,
  targetPrefix,
}: Readonly<{
  gitPath: string;
  cwd: string;
  commitOid: string;
  targetPrefix: string;
}>,): Promise<readonly ManualPushCandidateDescriptor[]> {
  /**
   * Raw NUL-delimited change records against every parent.
   */
  const deltaBytes = await runGitBytes({
    gitPath,
    cwd,
    args: [
      'diff-tree',
      '--root',
      '--no-commit-id',
      '-r',
      '-z',
      '-m',
      commitOid,
    ],
  },);
  /**
   * Retained content-bearing pushed change records.
   */
  const records = parseRawDiffRecords({
    text: DECODER.decode(deltaBytes,),
    createError: pushedDiffError,
  },);
  return records.map(function toDescriptor(record,): ManualPushCandidateDescriptor {
    return {
      targetId: `${targetPrefix}:${record.oid}:${record.path}`,
      path: record.path,
      revision: record.oid,
      mode: record.mode,
      change: record.change,
      content: record.mode === 'submodule'
        ? {
          kind: 'inline',
          bytes: new TextEncoder().encode(record.oid,),
        }
        : {
          kind: 'blob',
          oid: record.oid,
        },
    };
  },);
}
