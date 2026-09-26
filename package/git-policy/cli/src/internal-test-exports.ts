/**
 Transaction internals reachable from the built artifact only so unit tests exercise what consumers load.

 Not part of the authoring API;
 names and shapes change without notice.

 @internal

 @module
 */

import {
  type EventTestExports,
  eventTestExports,
} from './internal-test-exports-events.ts';
import {
  type LandingTestExports,
  landingTestExports,
} from './internal-test-exports-landing.ts';
import {
  type LockTestExports,
  lockTestExports,
} from './internal-test-exports-locks.ts';
import {
  type PushTestExports,
  pushTestExports,
} from './internal-test-exports-push.ts';
import {
  type ReplayTestExports,
  replayTestExports,
} from './internal-test-exports-replay.ts';
import {
  classifyTransactionOwner,
  createTransactionOwnerRecord,
  encodeTransactionOwner,
  parseTransactionOwner,
} from './policy-engine/commit-transaction-owner.ts';
import {
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
} from './policy-engine/commit-transaction-process-identity.ts';
import {
  CommitTransactionRecoveryError,
  recoverCommitTransaction,
} from './policy-engine/commit-transaction-recovery.ts';
import { findTransactionLandedOid, } from './policy-engine/commit-transaction-recovery-reflog.ts';
import {
  inspectRegistryEntry,
  recoverInspectedEntry,
} from './policy-engine/commit-transaction-recovery-scan.ts';
import {
  ensureTransactionRoot,
  isTransactionId,
  LEGACY_TRANSACTION_DIRECTORY_NAME,
  listTransactionEntries,
  OWNER_FILENAME,
  publishTransactionDirectory,
  removeTransactionDirectory,
  TRANSACTION_ROOT_NAME,
} from './policy-engine/commit-transaction-registry.ts';
import { createCommitTransactionWorkspace, } from './policy-engine/commit-transaction-workspace.ts';
import {
  ConfigValidationError,
  validateConfig,
} from './trust/config-validation.ts';
import {
  DEFAULT_CONCURRENCY_CONFIG,
  validateConcurrencyConfig,
} from './trust/config-validation-concurrency.ts';

/**
 Shapes of the transaction internals exposed to built-artifact tests.
 */
export type InternalTestExports =
  & EventTestExports
  & LandingTestExports
  & LockTestExports
  & PushTestExports
  & ReplayTestExports
  & Readonly<{
  /**
   Internal `classifyTransactionOwner`.
   */
  classifyTransactionOwner: typeof classifyTransactionOwner;
  /**
   Internal `CommitTransactionRecoveryError`.
   */
  CommitTransactionRecoveryError: typeof CommitTransactionRecoveryError;
  /**
   Internal `ConfigValidationError`.
   */
  ConfigValidationError: typeof ConfigValidationError;
  /**
   Internal `createCommitTransactionWorkspace`.
   */
  createCommitTransactionWorkspace: typeof createCommitTransactionWorkspace;
  /**
   Internal `createTransactionOwnerRecord`.
   */
  createTransactionOwnerRecord: typeof createTransactionOwnerRecord;
  /**
   Internal `DEFAULT_CONCURRENCY_CONFIG`.
   */
  DEFAULT_CONCURRENCY_CONFIG: typeof DEFAULT_CONCURRENCY_CONFIG;
  /**
   Internal `encodeTransactionOwner`.
   */
  encodeTransactionOwner: typeof encodeTransactionOwner;
  /**
   Internal `ensureTransactionRoot`.
   */
  ensureTransactionRoot: typeof ensureTransactionRoot;
  /**
   Internal `findTransactionLandedOid`.
   */
  findTransactionLandedOid: typeof findTransactionLandedOid;
  /**
   Internal `inspectRegistryEntry`.
   */
  inspectRegistryEntry: typeof inspectRegistryEntry;
  /**
   Internal `isTransactionId`.
   */
  isTransactionId: typeof isTransactionId;
  /**
   Internal `LEGACY_TRANSACTION_DIRECTORY_NAME`.
   */
  LEGACY_TRANSACTION_DIRECTORY_NAME: typeof LEGACY_TRANSACTION_DIRECTORY_NAME;
  /**
   Internal `listTransactionEntries`.
   */
  listTransactionEntries: typeof listTransactionEntries;
  /**
   Internal `OWNER_FILENAME`.
   */
  OWNER_FILENAME: typeof OWNER_FILENAME;
  /**
   Internal `parseTransactionOwner`.
   */
  parseTransactionOwner: typeof parseTransactionOwner;
  /**
   Internal `PROCESS_IDENTITY_ABSENT`.
   */
  PROCESS_IDENTITY_ABSENT: typeof PROCESS_IDENTITY_ABSENT;
  /**
   Internal `publishTransactionDirectory`.
   */
  publishTransactionDirectory: typeof publishTransactionDirectory;
  /**
   Internal `recoverCommitTransaction`.
   */
  recoverCommitTransaction: typeof recoverCommitTransaction;
  /**
   Internal `recoverInspectedEntry`.
   */
  recoverInspectedEntry: typeof recoverInspectedEntry;
  /**
   Internal `removeTransactionDirectory`.
   */
  removeTransactionDirectory: typeof removeTransactionDirectory;
  /**
   Internal `resolveProcessBirthIdentity`.
   */
  resolveProcessBirthIdentity: typeof resolveProcessBirthIdentity;
  /**
   Internal `TRANSACTION_ROOT_NAME`.
   */
  TRANSACTION_ROOT_NAME: typeof TRANSACTION_ROOT_NAME;
  /**
   Internal `validateConcurrencyConfig`.
   */
  validateConcurrencyConfig: typeof validateConcurrencyConfig;
  /**
   Internal `validateConfig`.
   */
  validateConfig: typeof validateConfig;
}>;

/**
 Transaction internals as one plain object, so the single bundled artifact needs no namespace runtime helper.
 */
export const internalTestExports: InternalTestExports = Object.freeze({
  ...eventTestExports,
  ...landingTestExports,
  ...lockTestExports,
  ...pushTestExports,
  ...replayTestExports,
  classifyTransactionOwner,
  CommitTransactionRecoveryError,
  ConfigValidationError,
  createCommitTransactionWorkspace,
  createTransactionOwnerRecord,
  DEFAULT_CONCURRENCY_CONFIG,
  encodeTransactionOwner,
  ensureTransactionRoot,
  findTransactionLandedOid,
  inspectRegistryEntry,
  isTransactionId,
  LEGACY_TRANSACTION_DIRECTORY_NAME,
  listTransactionEntries,
  OWNER_FILENAME,
  parseTransactionOwner,
  PROCESS_IDENTITY_ABSENT,
  publishTransactionDirectory,
  recoverCommitTransaction,
  recoverInspectedEntry,
  removeTransactionDirectory,
  resolveProcessBirthIdentity,
  TRANSACTION_ROOT_NAME,
  validateConcurrencyConfig,
  validateConfig,
},);
