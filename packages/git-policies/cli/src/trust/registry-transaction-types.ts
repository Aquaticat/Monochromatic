/**
 * Recursive provenance transaction schemas. @module
 */
import { validateTrustRecord, } from './record-validation.ts';
import { TrustStorageError, } from './registry-io.ts';
import type { TrustIdentity, } from './types.ts';

/**
 * One final provenance state.
 */
export type ProvenanceOperation =
  | Readonly<{
    /**
     * Exact record identity.
     */
    identity: TrustIdentity;
    /**
     * Removes installed record.
     */
    action: 'remove';
  }>
  | Readonly<{
    /**
     * Exact record identity.
     */
    identity: TrustIdentity;
    /**
     * Rewrites provenance.
     */
    action: 'update';
    /**
     * Final authorizing roots.
     */
    authorizingRoots: readonly TrustIdentity[];
  }>;
/**
 * Persistent recovery journal.
 */
export type TransactionJournal = Readonly<{
  /**
   * Journal schema.
   */
  schemaVersion: 1;
  /**
   * Process owning active transaction.
   */
  ownerPid: number;
  /**
   * Unique transaction ID.
   */
  transactionId: string;
  /**
   * Deterministically ordered operations.
   */
  operations: readonly ProvenanceOperation[];
}>;

/**
 * Validates identity and authorizers through canonical trust schema.
 *
 * @param identity - unknown operation identity
 *
 * @param authorizingRoots - unknown provenance list
 *
 * @returns validated identity and provenance
 */
function validateOperationFields({
  identity,
  authorizingRoots,
}: Readonly<{
  identity: unknown;
  authorizingRoots: unknown;
}>,): Readonly<{
  identity: TrustIdentity;
  authorizingRoots: readonly TrustIdentity[];
}> {
  /**
   * Synthetic record reuses authoritative identity validation.
   */
  const validated = validateTrustRecord({
    schemaVersion: 1,
    identity,
    repositoryRoot: '/',
    format: 'mjs',
    sources: [{
      canonicalPath: '/',
      snapshotFile: 'snapshots/x',
      size: '0',
      mtimeNanoseconds: '0',
    },],
    executableSnapshotFile: 'snapshots/x',
    executableSize: '0',
    recursiveChildren: false,
    authorizingRoots,
    recordedAt: '2026-01-01T00:00:00.000Z',
  },);
  return {
    identity: validated.identity,
    authorizingRoots: validated.authorizingRoots,
  };
}

/**
 * Validates one unknown operation.
 *
 * @param value - parsed operation
 *
 * @returns validated discriminated operation
 */
function validateOperation(value: unknown,): ProvenanceOperation {
  if (((typeof value) !== 'object') || (value === null)
    || (!('identity' in value))
    || (!('action' in value))
    || ((value.action !== 'remove') && (value.action !== 'update')))
    throw new TrustStorageError('Recursive trust transaction operation is invalid.',);
  if (value.action === 'remove') {
    /**
     * Validated removal identity.
     */
    const fields = validateOperationFields({
      identity: value.identity,
      authorizingRoots: [],
    },);
    return {
      identity: fields.identity,
      action: 'remove',
    };
  }
  if ((!('authorizingRoots' in value)) || (!Array.isArray(value.authorizingRoots)))
    throw new TrustStorageError('Recursive trust update provenance is invalid.',);
  /**
   * Validated update identity and roots.
   */
  const fields = validateOperationFields({
    identity: value.identity,
    authorizingRoots: value.authorizingRoots,
  },);
  return {
    identity: fields.identity,
    action: 'update',
    authorizingRoots: fields.authorizingRoots,
  };
}

/**
 * Parses and validates one journal.
 *
 * @param bytes - UTF-8 journal bytes
 *
 * @returns validated journal
 *
 * @example
 * ```ts
 * parseTransactionJournal('{"schemaVersion":1}');
 * ```
 */
export function parseTransactionJournal(bytes: string,): TransactionJournal {
  /**
   * Parsed JSON retained behind unknown boundary.
   */
  const value: unknown = JSON.parse(bytes,);
  if (((typeof value) !== 'object') || (value === null)
    || (!('schemaVersion' in value))
    || (value.schemaVersion !== 1)
    || (!('ownerPid' in value))
    || ((typeof value.ownerPid) !== 'number')
    || (!Number.isInteger(value.ownerPid))
    || (value.ownerPid < 1)
    || (!('transactionId' in value))
    || ((typeof value.transactionId) !== 'string')
    || (!('operations' in value))
    || (!Array.isArray(value.operations)))
    throw new TrustStorageError('Recursive trust transaction journal is invalid.',);
  /**
   * Unknown operations narrowed independently.
   */
  const operationValues: readonly unknown[] = value.operations;
  return {
    schemaVersion: 1,
    ownerPid: value.ownerPid,
    transactionId: value.transactionId,
    operations: operationValues.map(validateOperation,),
  };
}
