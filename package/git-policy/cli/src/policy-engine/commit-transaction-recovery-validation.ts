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
    || (!('ownerPid' in value))
    || ((typeof value.ownerPid) !== 'number')
    || (!Number.isSafeInteger(value.ownerPid,))
    || (!('ownerIdentity' in value))
    || ((typeof value.ownerIdentity) !== 'string')
    || (!('state' in value))
    || (value.state !== 'prepared')
    || (!('repositoryRoot' in value))
    || ((typeof value.repositoryRoot) !== 'string')
    || (!('realIndexPath' in value))
    || ((typeof value.realIndexPath) !== 'string')
    || (!('reflogAction' in value))
    || ((typeof value.reflogAction) !== 'string')
    || (!value.reflogAction
      .startsWith('cli-git:transaction:',))
    || (!('originalHead' in value))
    || ((typeof value.originalHead) !== 'object')
    || (value.originalHead === null)
    || (!('expectedParentOids' in value))
    || (!Array.isArray(value.expectedParentOids))
    || (!value.expectedParentOids
      .every(function stringOid(oid,) { return (typeof oid) === 'string'; },))
    || (!('mode' in value))
    || ((value.mode !== 'explicit-path') && (value.mode !== 'index'))
    || (!('selectedPaths' in value))
    || (!Array.isArray(value.selectedPaths))
    || (!value.selectedPaths
      .every(function stringPath(path,) { return (typeof path) === 'string'; },))
    || (!('intendedTreeOid' in value))
    || ((typeof value.intendedTreeOid) !== 'string')
    || (!('directoryDevice' in value))
    || ((typeof value.directoryDevice) !== 'string')
    || (!('directoryInode' in value))
    || ((typeof value.directoryInode) !== 'string')
    || (!('originalIndexDevice' in value))
    || ((typeof value.originalIndexDevice) !== 'string')
    || (!('originalIndexInode' in value))
    || ((typeof value.originalIndexInode) !== 'string')
    || (!('postIndexDevice' in value))
    || ((typeof value.postIndexDevice) !== 'string')
    || (!('postIndexInode' in value))
    || ((typeof value.postIndexInode) !== 'string')
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
    ownerPid: value.ownerPid,
    ownerIdentity: value.ownerIdentity,
    state: 'prepared',
    repositoryRoot: value.repositoryRoot,
    realIndexPath: value.realIndexPath,
    reflogAction: value.reflogAction,
    originalHead,
    expectedParentOids: value.expectedParentOids
      .filter(function stringOid(oid,): oid is string {
      return (typeof oid) === 'string';
    },),
    mode: value.mode,
    selectedPaths: value.selectedPaths
      .filter(function stringPath(path,): path is string {
      return (typeof path) === 'string';
    },),
    intendedTreeOid: value.intendedTreeOid,
    directoryDevice: value.directoryDevice,
    directoryInode: value.directoryInode,
    originalIndexDevice: value.originalIndexDevice,
    originalIndexInode: value.originalIndexInode,
    postIndexDevice: value.postIndexDevice,
    postIndexInode: value.postIndexInode,
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
 * Validates latest HEAD reflog entry as transaction-owned ref movement.
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
 * await assertTransactionReflog({ gitPath: '/usr/bin/git', cwd: '/repo', oid, journal });
 * ```
 */
export async function assertTransactionReflog({
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
   * Latest reflog identity and subject separated without text ambiguity.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'reflog',
      'show',
      '--max-count=1',
      '--format=%H%x00%gs',
      'HEAD',
    ],
    allowFailure: true,
  },);
  if (result.exitCode !== 0)
    throw new CommitTransactionRecoveryError('Transaction ref movement lacks durable reflog provenance.',);
  /**
   * Exact latest reflog output without terminal LF.
   */
  const output = DECODER.decode(result.stdout,)
    .endsWith('\n',)
    ? DECODER.decode(result.stdout,)
      .slice(
        0,
        -1,
      )
    : DECODER.decode(result.stdout,);
  /**
   * Unambiguous identity/subject separator.
   */
  const separator = output.indexOf('\0',);
  if ((separator === (-1))
    || (output.slice(
      0,
      separator,
    ) !== oid)
    || (!output.slice(separator + 1,)
      .startsWith(`${journal.reflogAction}:`,)))
    throw new CommitTransactionRecoveryError('Current HEAD reflog does not identify prepared transaction.',);
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
  /**
   * Ordered landed parent identities.
   */
  const landedParents = commitAndParents.slice(1,);
  if ((landedParents.length
    !== journal.expectedParentOids
    .length)
    || (!landedParents.every(function parentMatches(
      parent,
      index,
    ) {
      return parent === journal.expectedParentOids[index];
    },)))
    throw new CommitTransactionRecoveryError('Recovered commit parents differ from prepared transaction.',);
}
