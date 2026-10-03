import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';

import type { GitWorktreeIdentity, } from '../git-worktree-identity.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import {
  LEGACY_TRANSACTION_DIRECTORY_NAME,
  TRANSACTION_ROOT_NAME,
} from './commit-transaction-registry.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

/**
 Invocation has no worktree transaction directory to recover.
 */
export const RECOVERY_TARGET_NOT_APPLICABLE: unique symbol = Symbol(
  'commit transaction recovery target is not applicable',
);

/**
 Recovery locations of one worktree Git directory.
 */
export type CommitTransactionRecoveryTargets = Readonly<{
  /**
   Single per-index journal directory written by builds before per-transaction journals.
   */
  legacyDirectory: string;
  /**
   Per-transaction directory registry.
   */
  registryRoot: string;
}>;

/**
 Strict Git metadata decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Resolves an absolute Git-reported administrative path.

 @param effectiveCwd - invocation repository location

 @param reportedPath - one nonempty Git output line

 @returns absolute path
 */
function absoluteGitPath({
  effectiveCwd,
  reportedPath,
}: Readonly<{
  effectiveCwd: string;
  reportedPath: string;
}>,): string {
  return isAbsolute(reportedPath,)
    ? reportedPath
    : resolve(
        effectiveCwd,
        reportedPath,
      );
}

/**
 Resolves invocation-specific transaction locations from retained identity or one Git request.
 
 Pre-resolved identity lets known read-only commands reuse worktree classification for recovery
 and forwarding. Other commands ask Git for membership and both transaction paths together.
 
 @param args - Exact wrapper arguments.
 
 @param gitPath - Absolute real-Git executable.
 
 @param identity - Optional identity already resolved before config-free policy execution.
 
 @returns Absolute legacy directory and registry, or not-applicable sentinel.
 
 @throws {@link CommitTransactionRecoveryError} when Git returns incomplete metadata.
 
 @example
 ```ts
 await resolveCommitTransactionTargets({ args: ['status'], gitPath: '/usr/bin/git' });
 ```
 */
export async function resolveCommitTransactionTargets({
  args,
  gitPath,
  identity,
}: Readonly<{
  /**
   Exact wrapper arguments.
   */
  args: readonly string[];
  /**
   Absolute real-Git executable.
   */
  gitPath: string;
  /**
   Optional retained repository identity.
   */
  identity?: GitWorktreeIdentity;
}>,): Promise<CommitTransactionRecoveryTargets | typeof RECOVERY_TARGET_NOT_APPLICABLE> {
  if (identity !== undefined) {
    if ((identity.kind === 'outside-worktree') || (identity.kind === 'bare-repository'))
      return RECOVERY_TARGET_NOT_APPLICABLE;
    return {
      legacyDirectory: join(
        identity.gitDir,
        LEGACY_TRANSACTION_DIRECTORY_NAME,
      ),
      registryRoot: join(
        identity.gitDir,
        TRANSACTION_ROOT_NAME,
      ),
    };
  }

  /**
   Effective invocation repository location.
   */
  const { effectiveCwd, } = parseGlobalOptions(args,);
  /**
   Combined worktree-membership and transaction-paths response.
   */
  const metadata = await runTransactionGit({
    gitPath,
    cwd: effectiveCwd,
    args: [
      'rev-parse',
      '--path-format=absolute',
      '--is-inside-work-tree',
      '--git-path',
      LEGACY_TRANSACTION_DIRECTORY_NAME,
      '--git-path',
      TRANSACTION_ROOT_NAME,
    ],
    allowFailure: true,
  },);
  if (metadata.exitCode !== 0)
    return RECOVERY_TARGET_NOT_APPLICABLE;

  /**
   Fixed-order decoded metadata fields.
   */
  const [
    insideWorktree,
    reportedLegacyDirectory,
    reportedRegistryRoot,
  ] = DECODER.decode(metadata.stdout,)
    .trim()
    .split('\n',);
  if (insideWorktree !== 'true')
    return RECOVERY_TARGET_NOT_APPLICABLE;
  if ((reportedLegacyDirectory === undefined)
    || (reportedLegacyDirectory === '')
    || (reportedRegistryRoot === undefined)
    || (reportedRegistryRoot === '')) {
    throw new CommitTransactionRecoveryError(
      'Git returned incomplete commit transaction recovery metadata.',
    );
  }
  return {
    legacyDirectory: absoluteGitPath({
      effectiveCwd,
      reportedPath: reportedLegacyDirectory,
    },),
    registryRoot: absoluteGitPath({
      effectiveCwd,
      reportedPath: reportedRegistryRoot,
    },),
  };
}
