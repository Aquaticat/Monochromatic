/**
 Legacy single-journal transaction format, recovered read-only from directories earlier builds retained.
 
 @module
 */
import { runTransactionGit, } from './commit-transaction-git.ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);
/**
 Stable ref-updated marker filename.
 */
export const REF_UPDATED_FILENAME = 'ref-updated.json';
/**
 Stable index-installed marker filename.
 */
export const INDEX_INSTALLED_FILENAME = 'index-installed';

/**
 Original ref state before real Git invocation.
 */
export type OriginalHead =
  | Readonly<{ kind: 'absent'; }>
  | Readonly<{
    kind: 'oid';
    oid: string
  }>;

/**
 Durable prepared transaction metadata.
 */
export type PreparedTransactionJournal = Readonly<{
  /**
   Journal schema version.
   */
  version: 1;
  /**
   Wrapper process owning active real-index lock.
   */
  ownerPid: number;
  /**
   Exact process-birth identity paired with owner PID.
   */
  ownerIdentity: string;
  /**
   Prepared phase discriminator.
   */
  state: 'prepared';
  /**
   Canonical repository root.
   */
  repositoryRoot: string;
  /**
   Exact real index path.
   */
  realIndexPath: string;
  /**
   Private nonce-bearing reflog action identifying real Git ref update.
   */
  reflogAction: string;
  /**
   Exact original HEAD state.
   */
  originalHead: OriginalHead;
  /**
   Exact ordered parents expected on landed commit.
   */
  expectedParentOids: readonly string[];
  /**
   Commit selection mode.
   */
  mode: 'explicit-path' | 'index';
  /**
   Concrete selected repository paths, including paths policies added.
   */
  selectedPaths: readonly string[];
  /**
   Tracked paths policies added, whose worktree copies receive the landed bytes after the index is installed.
   */
  addedPaths: readonly AddedPathRecord[];
  /**
   Selected newline corrections whose matching worktree copies receive the settled bytes.
   */
  selectedWorktreePaths?: readonly AddedPathRecord[];
  /**
   Present for normalization without a commit; absence means legacy commit transaction.
   */
  operation?: 'normalize-only';
  /**
   Exact intended Git tree OID.
   */
  intendedTreeOid: string;
  /**
   Transaction directory device identity.
   */
  directoryDevice: string;
  /**
   Transaction directory inode identity.
   */
  directoryInode: string;
  /**
   Exact original-index artifact device identity.
   */
  originalIndexDevice: string;
  /**
   Exact original-index artifact inode identity.
   */
  originalIndexInode: string;
  /**
   Exact post-index artifact device identity.
   */
  postIndexDevice: string;
  /**
   Exact post-index artifact inode identity.
   */
  postIndexInode: string;
  /**
   Filesystem identity containing owned lock.
   */
  lockFsId: string;
  /**
   Device identity of owned lock object.
   */
  lockDevice: string;
  /**
   Inode identity of owned lock object.
   */
  lockInode: string;
}>;

/**
 Durable ref-updated phase metadata.
 */
export type RefUpdatedMarker = Readonly<{
  /**
   Journal schema version.
   */
  version: 1;
  /**
   Ref-updated phase discriminator.
   */
  state: 'ref-updated';
  /**
   Exact landed commit OID.
   */
  landedOid: string;
}>;

/**
 Resolves exact current commit or absence.
 
 @param gitPath - resolved Git executable
 
 @param cwd - effective repository directory
 
 @returns original HEAD state
 
 @example
 ```ts
 await resolveCurrentHead({ gitPath: '/usr/bin/git', cwd: '/repo' });
 ```
 */
export async function resolveCurrentHead({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<OriginalHead> {
  /**
   Optional exact current commit.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      'HEAD^{commit}',
    ],
    allowFailure: true,
  },);
  if (result.exitCode !== 0)
    return { kind: 'absent', };
  /**
   Decoded exact commit OID.
   */
  const oid = DECODER.decode(result.stdout,)
    .trim();
  if (oid.length === 0)
    throw new TypeError('Git returned empty current commit identity.',);
  return {
    kind: 'oid',
    oid,
  };
}
