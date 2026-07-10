/**
 * Validation and identity checks for transaction recovery.
 *
 * @module
 */
import { resolveFsId, } from '@monochromatic-dev/module-fs-id/ts';
import { lstat, } from 'node:fs/promises';
import { runTransactionGit, } from './commit-transaction-git.ts';
import type {
  OriginalHead,
  PreparedTransactionJournal,
  RefUpdatedMarker,
} from './commit-transaction-journal.ts';

/**
 * Strict journal and Git decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 * Interrupted transaction cannot be recovered automatically.
 */
export class CommitTransactionRecoveryError extends Error {
  /**
   * Creates recovery conflict.
   *
   * @param message - precise preserved-state diagnostic
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'CommitTransactionRecoveryError';
  }
}

/**
 * Parses original HEAD discriminated value.
 *
 * @param value - untrusted journal field
 *
 * @returns validated original HEAD
 */
function parseOriginalHead(value: object,): OriginalHead {
  if ((!('kind' in value))
    || ((value.kind !== 'absent') && (value.kind !== 'oid')))
    throw new CommitTransactionRecoveryError('Prepared transaction original HEAD is malformed.',);
  if (value.kind === 'absent')
    return { kind: 'absent', };
  if ((!('oid' in value)) || ((typeof value.oid) !== 'string'))
    throw new CommitTransactionRecoveryError('Prepared transaction original HEAD is malformed.',);
  return {
    kind: 'oid',
    oid: value.oid,
  };
}

/**
 * Parses required prepared journal shape.
 *
 * @param bytes - exact journal bytes
 *
 * @returns validated prepared journal
 *
 * @example
 * ```ts
 * parsePreparedJournal(bytes);
 * ```
 */
export function parsePreparedJournal(bytes: Uint8Array,): PreparedTransactionJournal {
  /**
   * Untrusted parsed JSON value.
   */
  const value: unknown = JSON.parse(DECODER.decode(bytes,),);
  if (((typeof value) !== 'object') || (value === null)
    || (!('version' in value))
    || (value.version !== 1)
    || (!('state' in value))
    || (value.state !== 'prepared')
    || (!('repositoryRoot' in value))
    || ((typeof value.repositoryRoot) !== 'string')
    || (!('realIndexPath' in value))
    || ((typeof value.realIndexPath) !== 'string')
    || (!('originalHead' in value))
    || ((typeof value.originalHead) !== 'object')
    || (value.originalHead === null)
    || (!('mode' in value))
    || ((value.mode !== 'explicit-path') && (value.mode !== 'index'))
    || (!('selectedPaths' in value))
    || (!Array.isArray(value.selectedPaths))
    || (!value.selectedPaths
      .every(function stringPath(path,) { return (typeof path) === 'string'; },))
    || (!('intendedTreeOid' in value))
    || ((typeof value.intendedTreeOid) !== 'string')
    || (!('lockFsId' in value))
    || ((typeof value.lockFsId) !== 'string')
    || (!('lockDevice' in value))
    || ((typeof value.lockDevice) !== 'string')
    || (!('lockInode' in value))
    || ((typeof value.lockInode) !== 'string'))
    throw new CommitTransactionRecoveryError('Prepared transaction journal is malformed.',);
  /**
   * Validated original head union.
   */
  const originalHead = parseOriginalHead(value.originalHead,);
  return {
    version: 1,
    state: 'prepared',
    repositoryRoot: value.repositoryRoot,
    realIndexPath: value.realIndexPath,
    originalHead,
    mode: value.mode,
    selectedPaths: value.selectedPaths
      .filter(function stringPath(path,): path is string {
      return (typeof path) === 'string';
    },),
    intendedTreeOid: value.intendedTreeOid,
    lockFsId: value.lockFsId,
    lockDevice: value.lockDevice,
    lockInode: value.lockInode,
  };
}

/**
 * Parses required ref-updated marker.
 *
 * @param bytes - exact marker bytes
 *
 * @returns validated marker
 *
 * @example
 * ```ts
 * parseRefUpdated(bytes);
 * ```
 */
export function parseRefUpdated(bytes: Uint8Array,): RefUpdatedMarker {
  /**
   * Untrusted parsed JSON value.
   */
  const value: unknown = JSON.parse(DECODER.decode(bytes,),);
  if (((typeof value) !== 'object') || (value === null)
    || (!('version' in value))
    || (value.version !== 1)
    || (!('state' in value))
    || (value.state !== 'ref-updated')
    || (!('landedOid' in value))
    || ((typeof value.landedOid) !== 'string'))
    throw new CommitTransactionRecoveryError('Ref-updated transaction marker is malformed.',);
  return {
    version: 1,
    state: 'ref-updated',
    landedOid: value.landedOid,
  };
}

/**
 * Tests exact original head equality.
 *
 * @param expected - journal original state
 *
 * @param current - observed current state
 *
 * @returns whether states match exactly
 *
 * @example
 * ```ts
 * headsEqual({ expected: { kind: 'absent' }, current: { kind: 'absent' } });
 * ```
 */
export function headsEqual({
  expected,
  current,
}: Readonly<{
  expected: OriginalHead;
  current: OriginalHead;
}>,): boolean {
  if (expected.kind !== current.kind)
    return false;
  if ((expected.kind === 'absent') || (current.kind === 'absent'))
    return true;
  return expected.oid === current.oid;
}

/**
 * Verifies owned lock identity before recovery mutation.
 *
 * @param journal - prepared journal identity
 *
 * @param lockPath - current real-index lock path
 *
 * @example
 * ```ts
 * await assertOwnedLock({ journal, lockPath: '/repo/.git/index.lock' });
 * ```
 */
export async function assertOwnedLock({
  journal,
  lockPath,
}: Readonly<{
  journal: PreparedTransactionJournal;
  lockPath: string;
}>,): Promise<void> {
  /**
   * Current non-followed lock metadata.
   */
  const metadata = await lstat(
    lockPath,
    { bigint: true, },
  );
  if ((!metadata.isFile()) || metadata.isSymbolicLink())
    throw new CommitTransactionRecoveryError(`Index lock is not a regular owned file: ${lockPath}`,);
  /**
   * Current lock filesystem identity.
   */
  const filesystem = await resolveFsId({
    path: lockPath,
    emitDiagnostics: false,
  },);
  if ((filesystem.value !== journal.lockFsId)
    || (String(metadata.dev,) !== journal.lockDevice)
    || (String(metadata.ino,) !== journal.lockInode))
    throw new CommitTransactionRecoveryError(`Index lock identity changed: ${lockPath}`,);
}

/**
 * Validates current commit as transaction-created result.
 *
 * @param gitPath - resolved Git executable
 *
 * @param cwd - repository root
 *
 * @param oid - current commit OID
 *
 * @param journal - prepared transaction
 *
 * @example
 * ```ts
 * await assertLandedCommit({ gitPath: '/usr/bin/git', cwd: '/repo', oid, journal });
 * ```
 */
export async function assertLandedCommit({
  gitPath,
  cwd,
  oid,
  journal,
}: Readonly<{
  gitPath: string;
  cwd: string;
  oid: string;
  journal: PreparedTransactionJournal;
}>,): Promise<void> {
  /**
   * Exact landed tree.
   */
  const tree = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--verify',
      `${oid}^{tree}`,
    ],
  },)).stdout,)
    .trim();
  if (tree !== journal.intendedTreeOid)
    throw new CommitTransactionRecoveryError('Current commit tree differs from prepared transaction tree.',);
  /**
   * Commit and ordered parent identities.
   */
  const commitAndParents = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-list',
      '--parents',
      '--max-count=1',
      oid,
    ],
  },)).stdout,)
    .trim()
    .split(' ',);
  if (journal.originalHead
    .kind
    === 'absent') {
    if (commitAndParents.length !== 1)
      throw new CommitTransactionRecoveryError('Recovered initial commit unexpectedly has a parent.',);
    return;
  }
  if ((commitAndParents.length !== 2) || (commitAndParents[1]
    !== journal.originalHead
    .oid))
    throw new CommitTransactionRecoveryError('Recovered commit parent differs from prepared original HEAD.',);
}
