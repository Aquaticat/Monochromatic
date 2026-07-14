/**
 * Durable private-index transaction journal.
 *
 * @module
 */
import {
  lstat,
  open,
  realpath,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  syncDirectory,
  writePrivateFile,
} from '../trust/registry-io.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import {
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
} from './commit-transaction-process-identity.ts';
import type { CommitTransactionWorkspace, } from './commit-transaction-workspace.ts';

/**
 * Journal format version.
 */
const JOURNAL_VERSION = 1;
/**
 * Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);
/**
 * Stable ref-updated marker filename.
 */
export const REF_UPDATED_FILENAME = 'ref-updated.json';
/**
 * Stable index-installed marker filename.
 */
export const INDEX_INSTALLED_FILENAME = 'index-installed';

/**
 * Original ref state before real Git invocation.
 */
export type OriginalHead =
  | Readonly<{ kind: 'absent'; }>
  | Readonly<{
    kind: 'oid';
    oid: string
  }>;

/**
 * Durable prepared transaction metadata.
 */
export type PreparedTransactionJournal = Readonly<{
  /**
   * Journal schema version.
   */
  version: 1;
  /**
   * Wrapper process owning active real-index lock.
   */
  ownerPid: number;
  /**
   * Exact process-birth identity paired with owner PID.
   */
  ownerIdentity: string;
  /**
   * Prepared phase discriminator.
   */
  state: 'prepared';
  /**
   * Canonical repository root.
   */
  repositoryRoot: string;
  /**
   * Exact real index path.
   */
  realIndexPath: string;
  /**
   * Private nonce-bearing reflog action identifying real Git ref update.
   */
  reflogAction: string;
  /**
   * Exact original HEAD state.
   */
  originalHead: OriginalHead;
  /**
   * Exact ordered parents expected on landed commit.
   */
  expectedParentOids: readonly string[];
  /**
   * Commit selection mode.
   */
  mode: 'explicit-path' | 'index';
  /**
   * Concrete selected repository paths.
   */
  selectedPaths: readonly string[];
  /**
   * Exact intended Git tree OID.
   */
  intendedTreeOid: string;
  /**
   * Transaction directory device identity.
   */
  directoryDevice: string;
  /**
   * Transaction directory inode identity.
   */
  directoryInode: string;
  /**
   * Exact original-index artifact device identity.
   */
  originalIndexDevice: string;
  /**
   * Exact original-index artifact inode identity.
   */
  originalIndexInode: string;
  /**
   * Exact post-index artifact device identity.
   */
  postIndexDevice: string;
  /**
   * Exact post-index artifact inode identity.
   */
  postIndexInode: string;
  /**
   * Filesystem identity containing owned lock.
   */
  lockFsId: string;
  /**
   * Device identity of owned lock object.
   */
  lockDevice: string;
  /**
   * Inode identity of owned lock object.
   */
  lockInode: string;
}>;

/**
 * Durable ref-updated phase metadata.
 */
export type RefUpdatedMarker = Readonly<{
  /**
   * Journal schema version.
   */
  version: 1;
  /**
   * Ref-updated phase discriminator.
   */
  state: 'ref-updated';
  /**
   * Exact landed commit OID.
   */
  landedOid: string;
}>;

/**
 * Encodes compact LF-terminated journal JSON.
 *
 * @param value - journal-safe object
 *
 * @returns exact UTF-8 bytes
 *
 * @mutates value - `JSON.stringify` may invoke `toJSON`, getters, or proxy traps.
 */
function encodeJournal(value: object,): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value,)}\n`,);
}

/**
 * Flushes existing private file contents.
 *
 * @param path - exact private snapshot path
 */
async function syncFile(path: string,): Promise<void> {
  /**
   * Read-only file handle used for fsync.
   */
  await using handle = await open(
    path,
    'r',
  );
  await handle.sync();
}

/**
 * Resolves exact current commit or absence.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @returns original HEAD state
 *
 * @example
 * ```ts
 * await resolveCurrentHead({ gitPath: '/usr/bin/git', cwd: '/repo' });
 * ```
 */
export async function resolveCurrentHead({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<OriginalHead> {
  /**
   * Optional exact current commit.
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
   * Decoded exact commit OID.
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

/**
 * Writes prepared journal only after original and intended indexes are durable.
 *
 * @param workspace - owned persistent transaction workspace
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param mode - commit transaction mode
 *
 * @param amend - whether commit replaces current HEAD
 *
 * @param selectedPaths - concrete selected paths
 *
 * @param intendedTreeOid - exact intended tree
 *
 * @returns durable journal value
 *
 * @example
 * ```ts
 * await prepareTransactionJournal({ workspace, gitPath: '/usr/bin/git', cwd: '/repo', mode: 'index', selectedPaths: [], intendedTreeOid });
 * ```
 */
export async function prepareTransactionJournal({
  workspace,
  gitPath,
  cwd,
  mode,
  amend,
  selectedPaths,
  intendedTreeOid,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  gitPath: string;
  cwd: string;
  mode: 'explicit-path' | 'index';
  amend: boolean;
  selectedPaths: readonly string[];
  intendedTreeOid: string;
}>,): Promise<PreparedTransactionJournal> {
  /**
   * Canonical repository root.
   */
  const repositoryRoot = await realpath(DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--show-toplevel',
    ],
  },)).stdout,)
    .trim(),);
  /**
   * Exact original HEAD state.
   */
  const originalHead = await resolveCurrentHead({
    gitPath,
    cwd,
  },);
  /**
   * Existing current commit parent identities.
   */
  const currentParents = originalHead.kind === 'absent'
    ? []
    : DECODER.decode((await runTransactionGit({
      gitPath,
      cwd,
      args: [
        'rev-list',
        '--parents',
        '--max-count=1',
        originalHead.oid,
      ],
    },)).stdout,)
      .trim()
      .split(' ',)
      .slice(1,);
  /**
   * Optional merge parent identity.
   */
  const mergeResult = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      'MERGE_HEAD',
    ],
    allowFailure: true,
  },);
  /**
   * Existing merge parent identities when concluding merge.
   */
  const mergeHeads = mergeResult.exitCode === 0
    ? DECODER.decode(mergeResult.stdout,)
      .trim()
      .split('\n',)
      .filter(function nonempty(oid,) {
      return oid.length > 0;
    },)
    : [];
  /**
   * Exact parents expected from selected commit mode.
   */
  const expectedParentOids = amend
    ? currentParents
    : [
      ...(originalHead.kind === 'oid' ? [originalHead.oid,] : []),
      ...mergeHeads,
    ];
  /**
   * Exact prepared artifact identities.
   */
  const [directoryMetadata, originalIndexMetadata, postIndexMetadata,] = await Promise.all([
    lstat(
      workspace.directory,
      { bigint: true, },
    ),
    lstat(
      workspace.originalIndexPath,
      { bigint: true, },
    ),
    lstat(
      workspace.postIndexPath,
      { bigint: true, },
    ),
  ],);
  /**
   * Current wrapper process-birth identity.
   */
  const ownerIdentity = await resolveProcessBirthIdentity(process.pid,);
  if ((typeof ownerIdentity) === 'symbol') {
    if (ownerIdentity !== PROCESS_IDENTITY_ABSENT)
      throw new TypeError('Unknown transaction owner process identity state.',);
    throw new TypeError('Current transaction owner process identity is unavailable.',);
  }
  /**
   * Durable prepared metadata.
   */
  const journal: PreparedTransactionJournal = {
    version: JOURNAL_VERSION,
    ownerPid: process.pid,
    ownerIdentity,
    state: 'prepared',
    repositoryRoot,
    realIndexPath: workspace.realIndexPath,
    reflogAction: workspace.reflogAction,
    originalHead,
    expectedParentOids,
    mode,
    selectedPaths,
    intendedTreeOid,
    directoryDevice: String(directoryMetadata.dev,),
    directoryInode: String(directoryMetadata.ino,),
    originalIndexDevice: String(originalIndexMetadata.dev,),
    originalIndexInode: String(originalIndexMetadata.ino,),
    postIndexDevice: String(postIndexMetadata.dev,),
    postIndexInode: String(postIndexMetadata.ino,),
    lockFsId: workspace.lockFsId,
    lockDevice: workspace.lockDevice,
    lockInode: workspace.lockInode,
  };
  await Promise.all([
    syncFile(workspace.originalIndexPath,),
    syncFile(workspace.commitIndexPath,),
    syncFile(workspace.postIndexPath,),
  ],);
  await writePrivateFile({
    path: workspace.journalPath,
    bytes: encodeJournal(journal,),
  },);
  await syncDirectory(workspace.directory,);
  return journal;
}

/**
 * Records exact landed commit after real Git advances ref.
 *
 * @param workspace - preserved transaction workspace
 *
 * @param landedOid - exact landed commit
 *
 * @example
 * ```ts
 * await recordRefUpdated({ workspace, landedOid: 'abc' });
 * ```
 */
export async function recordRefUpdated({
  workspace,
  landedOid,
}: Readonly<{
  workspace: CommitTransactionWorkspace;
  landedOid: string;
}>,): Promise<void> {
  /**
   * Durable ref-updated marker path.
   */
  const path = join(
    workspace.directory,
    REF_UPDATED_FILENAME,
  );
  await writePrivateFile({
    path,
    bytes: encodeJournal({
      version: JOURNAL_VERSION,
      state: 'ref-updated',
      landedOid,
    },),
  },);
  await syncDirectory(workspace.directory,);
}

/**
 * Records completed index installation before transaction cleanup.
 *
 * @param workspace - installed transaction workspace
 *
 * @example
 * ```ts
 * await recordIndexInstalled({ workspace });
 * ```
 */
export async function recordIndexInstalled({ workspace, }: Readonly<{
  workspace: CommitTransactionWorkspace;
}>,): Promise<void> {
  await writePrivateFile({
    path: join(
      workspace.directory,
      INDEX_INSTALLED_FILENAME,
    ),
    bytes: new Uint8Array(),
  },);
  await syncDirectory(workspace.directory,);
}
