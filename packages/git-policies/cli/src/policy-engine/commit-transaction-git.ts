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
import type {
  GitObjectId,
  PolicyPatch,
} from '../api/policy-types.ts';
import { validatePolicyPatch, } from './commit-transaction-patch.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';

/**
 * Private workspace fields required for patch application.
 */
export type PrivatePatchWorkspace = Readonly<Pick<
  CommitTransactionWorkspace,
  'directory' | 'commitIndexPath'
>>;

/**
 * Private patch file mode.
 */
const PRIVATE_FILE_MODE = 0o600;
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
 * @param environment - transaction-owned environment additions
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
  environment = {},
}: Readonly<{
  gitPath: string;
  cwd: string;
  args: readonly string[];
  indexPath?: string;
  stdio?: 'capture' | 'inherit';
  allowFailure?: boolean;
  environment?: Readonly<Record<string, string>>;
}>,): Promise<GitOutput> {
  /**
   * Environment containing only engine-selected index override.
   */
  const env = {
    ...process.env,
    ...environment,
    ...(indexPath === undefined ? {} : { GIT_INDEX_FILE: indexPath, }),
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
 * @param candidateRevision - exact candidate blob revision
 *
 * @param ordinal - stable patch ordinal
 *
 * @mutates patch through writeFile native-boundary access to patch.bytes
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
  candidateRevision,
  ordinal,
}: Readonly<{
  workspace: PrivatePatchWorkspace;
  gitPath: string;
  cwd: string;
  patch: PolicyPatch;
  candidateRevision: GitObjectId;
  ordinal: number;
}>,): Promise<void> {
  validatePolicyPatch({
    patch,
    expectedRevision: candidateRevision,
  },);
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
