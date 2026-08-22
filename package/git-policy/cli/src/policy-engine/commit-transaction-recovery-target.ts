import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';

import type { GitWorktreeIdentity, } from '../git-worktree-identity.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';
import { TRANSACTION_DIRECTORY_NAME, } from './commit-transaction-workspace.ts';

/** Invocation has no worktree transaction directory to recover. */
export const RECOVERY_TARGET_NOT_APPLICABLE: unique symbol = Symbol(
  'commit transaction recovery target is not applicable',
);

/** Strict Git metadata decoder. */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 * Resolves invocation-specific transaction directory from retained identity or one Git request.
 *
 * Pre-resolved identity lets known read-only commands reuse worktree classification for recovery
 * and forwarding. Other commands ask Git for membership and transaction path together.
 *
 * @param args - Exact wrapper arguments.
 *
 * @param gitPath - Absolute real-Git executable.
 *
 * @param identity - Optional identity already resolved before config-free policy execution.
 *
 * @returns Absolute transaction directory or not-applicable sentinel.
 *
 * @throws {@link CommitTransactionRecoveryError} when Git returns incomplete metadata.
 *
 * @example
 * ```ts
 * await resolveCommitTransactionDirectory({ args: ['status'], gitPath: '/usr/bin/git' });
 * ```
 */
export async function resolveCommitTransactionDirectory({
  args,
  gitPath,
  identity,
}: Readonly<{
  /** Exact wrapper arguments. */
  args: readonly string[];
  /** Absolute real-Git executable. */
  gitPath: string;
  /** Optional retained repository identity. */
  identity?: GitWorktreeIdentity;
}>,): Promise<string | typeof RECOVERY_TARGET_NOT_APPLICABLE> {
  if (identity !== undefined) {
    if ((identity.kind === 'outside-worktree') || (identity.kind === 'bare-repository'))
      return RECOVERY_TARGET_NOT_APPLICABLE;
    return join(
      identity.gitDir,
      TRANSACTION_DIRECTORY_NAME,
    );
  }

  /** Effective invocation repository location. */
  const { effectiveCwd, } = parseGlobalOptions(args,);
  /** Combined worktree-membership and transaction-path response. */
  const metadata = await runTransactionGit({
    gitPath,
    cwd: effectiveCwd,
    args: [
      'rev-parse',
      '--path-format=absolute',
      '--is-inside-work-tree',
      '--git-path',
      TRANSACTION_DIRECTORY_NAME,
    ],
    allowFailure: true,
  },);
  if (metadata.exitCode !== 0)
    return RECOVERY_TARGET_NOT_APPLICABLE;

  /** Fixed-order decoded metadata fields. */
  const [
    insideWorktree,
    reportedDirectory,
  ] = DECODER.decode(metadata.stdout,)
    .trim()
    .split('\n',);
  if (insideWorktree !== 'true')
    return RECOVERY_TARGET_NOT_APPLICABLE;
  if ((reportedDirectory === undefined) || (reportedDirectory === '')) {
    throw new CommitTransactionRecoveryError(
      'Git returned incomplete commit transaction recovery metadata.',
    );
  }
  return isAbsolute(reportedDirectory,)
    ? reportedDirectory
    : resolve(
        effectiveCwd,
        reportedDirectory,
      );
}
