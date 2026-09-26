/**
 Owner record of one per-transaction directory and owner liveness classification.

 The owner record is written before the directory is published,
 so recovery can skip a live owner's transaction at every phase,
 including before the prepared journal exists.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
} from './commit-transaction-process-identity.ts';
import {
  CommitTransactionRecoveryError,
  processIsAlive,
} from './commit-transaction-recovery-validation.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Owner record schema; version 2 marks the per-transaction directory layout.
 */
const OWNER_SCHEMA_VERSION = 2;

/**
 Strict owner record decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Durable owner of one transaction directory.
 */
export type TransactionOwnerRecord = Readonly<{
  /**
   Owner record schema version.
   */
  schemaVersion: 2;
  /**
   Transaction ID equal to the directory name.
   */
  transactionId: string;
  /**
   Wrapper process owning the transaction.
   */
  ownerPid: number;
  /**
   Process-birth identity distinguishing the owner from a later process reusing its PID.
   */
  ownerIdentity: string;
  /**
   ISO-8601 creation time ordering dead transactions for recovery.
   */
  createdAt: string;
  /**
   Real index whose lock the transaction holds.
   */
  realIndexPath: string;
  /**
   Filesystem identity containing the owned lock.
   */
  lockFsId: string;
  /**
   Device identity of the owned lock object.
   */
  lockDevice: string;
  /**
   Inode identity of the owned lock object.
   */
  lockInode: string;
}>;

/**
 Whether a recorded owner still runs.
 */
export type TransactionOwnerLiveness = 'alive' | 'dead';

/**
 Builds the current process's owner record for a freshly locked transaction.

 @param transactionId - fresh transaction ID

 @param realIndexPath - locked real index

 @param lockFsId - owned lock filesystem identity

 @param lockDevice - owned lock device identity

 @param lockInode - owned lock inode identity

 @returns owner record for the current process

 @throws {@link TypeError} when the current process birth identity is unavailable

 @example
 ```ts
 await createTransactionOwnerRecord({ transactionId, realIndexPath, lockFsId, lockDevice, lockInode });
 ```
 */
export async function createTransactionOwnerRecord({
  transactionId,
  realIndexPath,
  lockFsId,
  lockDevice,
  lockInode,
}: Readonly<{
  transactionId: string;
  realIndexPath: string;
  lockFsId: string;
  lockDevice: string;
  lockInode: string;
}>,): Promise<TransactionOwnerRecord> {
  /**
   Current wrapper process-birth identity.
   */
  const ownerIdentity = await resolveProcessBirthIdentity(process.pid,);
  if ((typeof ownerIdentity) === 'symbol') {
    if (ownerIdentity !== PROCESS_IDENTITY_ABSENT)
      throw new TypeError('Unknown transaction owner process identity state.',);
    throw new TypeError('Current transaction owner process identity is unavailable.',);
  }
  return {
    schemaVersion: OWNER_SCHEMA_VERSION,
    transactionId,
    ownerPid: process.pid,
    ownerIdentity,
    createdAt: new Date()
      .toISOString(),
    realIndexPath,
    lockFsId,
    lockDevice,
    lockInode,
  };
}

/**
 Encodes an owner record as compact LF-terminated JSON.

 @param owner - owner record

 @returns exact UTF-8 bytes

 @example
 ```ts
 encodeTransactionOwner(owner);
 ```
 */
export function encodeTransactionOwner(owner: TransactionOwnerRecord,): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify({
    schemaVersion: owner.schemaVersion,
    transactionId: owner.transactionId,
    ownerPid: owner.ownerPid,
    ownerIdentity: owner.ownerIdentity,
    createdAt: owner.createdAt,
    realIndexPath: owner.realIndexPath,
    lockFsId: owner.lockFsId,
    lockDevice: owner.lockDevice,
    lockInode: owner.lockInode,
  },)}\n`,);
}

/**
 Parses a required owner record.

 @param bytes - exact owner record bytes

 @returns validated owner record

 @throws {@link CommitTransactionRecoveryError} when any field is missing or mistyped

 @example
 ```ts
 parseTransactionOwner(bytes);
 ```
 */
export function parseTransactionOwner(bytes: Uint8Array,): TransactionOwnerRecord {
  /**
   Untrusted parsed JSON value.
   */
  const value: unknown = JSON.parse(DECODER.decode(bytes,),);
  if (((typeof value) !== 'object') || (value === null)
    || (!('schemaVersion' in value))
    || (value.schemaVersion !== OWNER_SCHEMA_VERSION)
    || (!('transactionId' in value))
    || ((typeof value.transactionId) !== 'string')
    || (!('ownerPid' in value))
    || ((typeof value.ownerPid) !== 'number')
    || (!Number.isSafeInteger(value.ownerPid,))
    || (value.ownerPid < 1)
    || (!('ownerIdentity' in value))
    || ((typeof value.ownerIdentity) !== 'string')
    || (value.ownerIdentity === '')
    || (!('createdAt' in value))
    || ((typeof value.createdAt) !== 'string')
    || (!('realIndexPath' in value))
    || ((typeof value.realIndexPath) !== 'string')
    || (!('lockFsId' in value))
    || ((typeof value.lockFsId) !== 'string')
    || (!('lockDevice' in value))
    || ((typeof value.lockDevice) !== 'string')
    || (!('lockInode' in value))
    || ((typeof value.lockInode) !== 'string'))
    throw new CommitTransactionRecoveryError('Transaction owner record is malformed.',);
  return {
    schemaVersion: OWNER_SCHEMA_VERSION,
    transactionId: value.transactionId,
    ownerPid: value.ownerPid,
    ownerIdentity: value.ownerIdentity,
    createdAt: value.createdAt,
    realIndexPath: value.realIndexPath,
    lockFsId: value.lockFsId,
    lockDevice: value.lockDevice,
    lockInode: value.lockInode,
  };
}

/**
 Classifies a recorded owner as alive only when its PID still names the same process birth.

 @param ownerPid - recorded wrapper PID

 @param ownerIdentity - recorded process-birth identity

 @returns `alive` for the original process; `dead` for an exited or reused PID

 @example
 ```ts
 await classifyTransactionOwner({ ownerPid: process.pid, ownerIdentity });
 ```
 */
export async function classifyTransactionOwner({
  ownerPid,
  ownerIdentity,
}: Readonly<{
  ownerPid: number;
  ownerIdentity: string;
}>,): Promise<TransactionOwnerLiveness> {
  /**
   Tagged liveness logger.
   */
  const rl = tagged({
    tag: classifyTransactionOwner.name,
    l,
  },);
  if (!processIsAlive(ownerPid,)) {
    rl.debug(`owner PID ${String(ownerPid,)} has exited`,);
    return 'dead';
  }
  /**
   Birth identity of the process the PID names now.
   */
  const currentIdentity = await resolveProcessBirthIdentity(ownerPid,);
  if ((typeof currentIdentity) === 'symbol') {
    if (currentIdentity !== PROCESS_IDENTITY_ABSENT)
      throw new CommitTransactionRecoveryError('Unknown transaction owner identity state.',);
    rl.debug(`owner PID ${String(ownerPid,)} exited during identity probe`,);
    return 'dead';
  }
  if (currentIdentity !== ownerIdentity) {
    rl.debug(`owner PID ${String(ownerPid,)} now names a different process`,);
    return 'dead';
  }
  return 'alive';
}
