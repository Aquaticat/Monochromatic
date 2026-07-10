/**
 * Private-index Git operations for commit autofix transactions.
 *
 * @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import {
  arrayBuffer,
  text,
} from 'node:stream/consumers';
import {
  ABSENT_GIT_VALUE,
  type LazyPolicyGitFacts,
} from '../api/context-types.ts';
import type {
  CandidateFile,
  CandidateFileMode,
  GitObjectId,
  PolicyPatch,
} from '../api/policy-types.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';

/**
 * Strict Git metadata decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);
/**
 * Private patch file mode.
 */
const PRIVATE_FILE_MODE = 0o600;
/**
 * Git index mode mapping.
 */
const INDEX_MODES: Readonly<Record<string, CandidateFileMode>> = {
  '100644': 'regular',
  '100755': 'executable',
  '120000': 'symlink',
  '160000': 'submodule',
};

/**
 * Private Git operation failure.
 */
export class CommitTransactionGitError extends Error {
  /**
   * Creates transaction failure.
   *
   * @param message - exact safe failure description
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'CommitTransactionGitError';
  }
}

/**
 * Exact Git command output.
 */
export type GitOutput = Readonly<{
  /**
   * Standard output bytes.
   */
  stdout: Uint8Array;
  /**
   * Standard error text.
   */
  stderr: string;
  /**
   * Exact process exit code.
   */
  exitCode: number;
}>;

/**
 * Returns absent landed commit before commit execution.
 *
 * @returns explicit absence sentinel
 */
function absentLandedCommit(): Promise<typeof ABSENT_GIT_VALUE> {
  return Promise.resolve(ABSENT_GIT_VALUE,);
}

/**
 * Returns no push updates during commit checks.
 *
 * @returns empty update list
 */
function emptyPushUpdates(): Promise<readonly never[]> {
  return Promise.resolve([],);
}

/**
 * Runs real Git against optional private index.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param args - exact Git arguments
 *
 * @param indexPath - private index override
 *
 * @param stdio - whether user-facing output inherits
 *
 * @param allowFailure - whether caller handles nonzero status
 *
 * @returns exact captured output
 *
 * @throws CommitTransactionGitError when Git exits nonzero
 *
 * @example
 * ```ts
 * await runTransactionGit({ gitPath: '/usr/bin/git', cwd: '/repo', args: ['status'] });
 * ```
 */
export async function runTransactionGit({
  gitPath,
  cwd,
  args,
  indexPath,
  stdio = 'capture',
  allowFailure = false,
}: Readonly<{
  gitPath: string;
  cwd: string;
  args: readonly string[];
  indexPath?: string;
  stdio?: 'capture' | 'inherit';
  allowFailure?: boolean;
}>,): Promise<GitOutput> {
  /**
   * Environment containing only engine-selected index override.
   */
  const env = indexPath === undefined
    ? process.env
    : {
      ...process.env,
      GIT_INDEX_FILE: indexPath,
    };
  if (stdio === 'inherit') {
    /**
     * User-facing Git child.
     */
    const child = spawn(
      gitPath,
      [...args,],
      {
        cwd,
        env,
        stdio: 'inherit',
      },
    );
    await once(
      child,
      'close',
    );
    if ((child.exitCode !== 0) && (!allowFailure))
      throw new CommitTransactionGitError(`git ${args.join(' ',)} exited ${String(child.exitCode,)}`,);
    return {
      stdout: new Uint8Array(),
      stderr: '',
      exitCode: child.exitCode ?? 1,
    };
  }
  /**
   * Captured Git child.
   */
  const child = spawn(
    gitPath,
    [...args,],
    {
    cwd,
    env,
    stdio: [
      'ignore',
      'pipe',
      'pipe',
    ],
  },
  );
  /**
   * Concurrent stream consumers.
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
   * Captured binary output and diagnostic.
   */
  const [stdout, stderr,] = await output;
  if ((child.exitCode !== 0) && (!allowFailure))
    throw new CommitTransactionGitError(`git ${args.join(' ',)} failed: ${stderr.trim()}`,);
  return {
    stdout: new Uint8Array(stdout,),
    stderr,
    exitCode: child.exitCode ?? 1,
  };
}

/**
 * Loads one index candidate.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param indexPath - private index
 *
 * @param path - repository path
 *
 * @returns immutable lazy candidate
 */
async function loadIndexCandidate({
  gitPath,
  cwd,
  indexPath,
  path,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  path: string;
}>,): Promise<CandidateFile> {
  /**
   * Stage-zero index metadata.
   */
  const metadata = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'ls-files',
      '--stage',
      '--',
      path,
    ],
  },)).stdout,)
    .trim();
  /**
   * Metadata/path separator.
   */
  const tab = metadata.indexOf('\t',);
  /**
   * Metadata fields before path.
   */
  const parts = (tab === (-1) ? metadata : metadata.slice(
    0,
    tab,
  )).split(' ',);
  /**
   * Git mode and object ID.
   */
  const [modeText, oid, stage,] = parts;
  if ((modeText === undefined) || (oid === undefined)
    || (stage !== '0'))
    throw new CommitTransactionGitError(`Private index entry is unavailable for ${path}`,);
  /**
   * Policy mode.
   */
  const mode = INDEX_MODES[modeText];
  if (mode === undefined)
    throw new CommitTransactionGitError(`Unsupported private index mode ${modeText} for ${path}`,);
  return {
    targetId: `pre-commit:${oid}:${path}`,
    path,
    revision: oid,
    mode,
    change: 'modified',
    bytes: async function loadIndexBytes(): Promise<Uint8Array> {
      return (await runTransactionGit({
        gitPath,
        cwd,
        indexPath,
        args: [
          'show',
          `:${path}`,
        ],
      },)).stdout;
    },
  };
}

/**
 * Creates lazy facts backed by current private index bytes.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param indexPath - private index
 *
 * @param paths - candidate paths
 *
 * @returns policy Git facts
 *
 * @example
 * ```ts
 * createPrivateIndexFacts({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index', paths: ['a'] });
 * ```
 */
export function createPrivateIndexFacts({
  gitPath,
  cwd,
  indexPath,
  paths,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  paths: readonly string[];
}>,): LazyPolicyGitFacts {
  return {
    candidates: function candidates(): Promise<readonly CandidateFile[]> {
      return Promise.all(paths.map(function loadPath(path,) {
        return loadIndexCandidate({
          gitPath,
          cwd,
          indexPath,
          path,
        },);
      },),);
    },
    headOid: async function headOid(): Promise<GitObjectId> {
      return DECODER.decode((await runTransactionGit({
        gitPath,
        cwd,
        args: [
          'rev-parse',
          '--verify',
          'HEAD^{commit}',
        ],
      },)).stdout,)
        .trim();
    },
    landedCommitOid: absentLandedCommit,
    pushUpdates: emptyPushUpdates,
  };
}

/**
 * Applies one validated patch to private index.
 *
 * @param workspace - transaction workspace
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - repository directory
 *
 * @param patch - engine-owned patch
 *
 * @param ordinal - stable patch ordinal
 *
 * @throws CommitTransactionGitError for invalid or conflicting patch
 *
 * @example
 * ```ts
 * await applyPrivatePatch({ workspace, gitPath: '/usr/bin/git', cwd: '/repo', patch, ordinal: 0 });
 * ```
 */
export async function applyPrivatePatch({
  workspace,
  gitPath,
  cwd,
  patch,
  ordinal,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  gitPath: string;
  cwd: string;
  patch: PolicyPatch;
  ordinal: number;
}>,): Promise<void> {
  /**
   * Required single-path patch header.
   */
  const requiredHeader = `diff --git a/${patch.path} b/${patch.path}`;
  /**
   * Decoded patch for structural boundary validation.
   */
  const decoded = DECODER.decode(patch.bytes,);
  if ((!decoded.startsWith(`${requiredHeader}\n`,))
    || decoded.includes(
      '\ndiff --git ',
      requiredHeader.length,
    ))
    throw new CommitTransactionGitError(`Patch must contain exactly declared path ${patch.path}`,);
  /**
   * Private patch file.
   */
  const patchPath = join(
    workspace.directory,
    `patch-${String(ordinal,)}.diff`,
  );
  await writeFile(
    patchPath,
    patch.bytes,
    { mode: PRIVATE_FILE_MODE, },
  );
  await runTransactionGit({
    gitPath,
    cwd,
    indexPath: workspace.commitIndexPath,
    args: [
      'apply',
      '--cached',
      '--3way',
      patchPath,
    ],
  },);
}

/**
 * Returns staged paths from private index relative to HEAD.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - repository directory
 *
 * @param indexPath - private index
 *
 * @returns repository paths
 *
 * @example
 * ```ts
 * await listChangedIndexPaths({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index' });
 * ```
 */
export async function listChangedIndexPaths({
  gitPath,
  cwd,
  indexPath,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
}>,): Promise<readonly string[]> {
  /**
   * NUL-delimited changed paths.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'diff',
      '--cached',
      '--name-only',
      '-z',
      'HEAD',
    ],
  },);
  return DECODER.decode(output.stdout,)
    .split('\0',)
    .filter(function nonempty(path,) {
    return path.length > 0;
  },);
}
