/**
 Transaction internals reachable from the built artifact only so unit tests exercise what consumers load.

 Not part of the authoring API;
 names and shapes change without notice.

 @internal

 @module
 */

export {
  prepareTransactionJournal,
  recordRefUpdated,
} from './policy-engine/commit-transaction-journal.ts';
export type { PreparedTransactionJournal, } from './policy-engine/commit-transaction-journal.ts';
export {
  classifyTransactionOwner,
  createTransactionOwnerRecord,
  encodeTransactionOwner,
  parseTransactionOwner,
} from './policy-engine/commit-transaction-owner.ts';
export type { TransactionOwnerRecord, } from './policy-engine/commit-transaction-owner.ts';
export {
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
} from './policy-engine/commit-transaction-process-identity.ts';
export {
  CommitTransactionRecoveryError,
  recoverCommitTransaction,
} from './policy-engine/commit-transaction-recovery.ts';
export type { CommitTransactionRecoveryOutcome, } from './policy-engine/commit-transaction-recovery.ts';
export { findTransactionLandedOid, } from './policy-engine/commit-transaction-recovery-reflog.ts';
export {
  inspectRegistryEntry,
  recoverInspectedEntry,
} from './policy-engine/commit-transaction-recovery-scan.ts';
export {
  ensureTransactionRoot,
  isTransactionId,
  LEGACY_TRANSACTION_DIRECTORY_NAME,
  listTransactionEntries,
  OWNER_FILENAME,
  publishTransactionDirectory,
  removeTransactionDirectory,
  TRANSACTION_ROOT_NAME,
} from './policy-engine/commit-transaction-registry.ts';
export { createCommitTransactionWorkspace, } from './policy-engine/commit-transaction-workspace.ts';
export type { CommitTransactionWorkspace, } from './policy-engine/commit-transaction-workspace.ts';
