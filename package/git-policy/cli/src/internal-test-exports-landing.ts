/**
 Concurrent-commit preparation and landing internals reachable from the built artifact for unit tests.

 Not part of the authoring API;
 names and shapes change without notice.

 @internal

 @module
 */
import {
  combineConfigParameters,
  computeHookDispatchPlan,
  globalConfigOverrides,
  quoteConfigParameter,
} from './hook-dispatch/hook-dispatch-plan.ts';
import {
  HOOK_DISPATCH_PROGRAM,
  hookEntryProgram,
} from './hook-dispatch/hook-dispatch-program.ts';
import { writeHookShim, } from './hook-dispatch/hook-shim-writer.ts';
import {
  formatPreparationLease,
  hasValidInheritedLease,
} from './hook-dispatch/preparation-lease.ts';
import {
  acquireOwnerLock,
  OwnerLockError,
  parseOwnerLockRecord,
  readOwnerLockRecord,
} from './owner-lock/owner-lock.ts';
import {
  landingReflogMessage,
  landingReflogPrefix,
  landTransaction,
} from './policy-engine/commit-landing.ts';
import { landingFindingResult, } from './policy-engine/commit-landing-findings.ts';
import { computeLandingPostIndex, } from './policy-engine/commit-landing-index.ts';
import {
  acquireRealIndexLock,
  IndexLockBusyError,
  lockPidPath,
} from './policy-engine/commit-landing-index-lock.ts';
import {
  migrateShadowObjects,
  removeTransactionKeeps,
  transactionKeepMessage,
} from './policy-engine/commit-landing-objects.ts';
import {
  NativeCommitFailedError,
  readPreparedCommit,
  runNativePreparation,
  splitCommitInvocation,
  withoutAllFlag,
} from './policy-engine/commit-preparation-native.ts';
import {
  baseRevision,
  captureInvocation,
  shadowRepositoryPath,
} from './policy-engine/commit-transaction-capture.ts';
import {
  parseIndexLockRecord,
  parseLandingRecord,
  parsePreparedRecord,
  parsePreparingRecord,
  parseRefUpdatedRecord,
} from './policy-engine/commit-transaction-journal-parse.ts';
import {
  indexLockRecordFilename,
  JOURNAL_SCHEMA_VERSION,
  landingRecordFilename,
  postIndexFilename,
  PREPARED_FILENAME,
  PREPARING_FILENAME,
  preLandingIndexFilename,
  REF_UPDATED_RECORD_FILENAME,
  writeIndexInstalledMarker,
  writeJournalRecord,
} from './policy-engine/commit-transaction-journal-states.ts';
import { isRegistryLockName, } from './policy-engine/commit-transaction-registry.ts';
import {
  formatShadowConfig,
  quoteGitConfigValue,
} from './shadow-repository/shadow-config.ts';
import { isPrivateShadowEntry, } from './shadow-repository/shadow-links.ts';
import {
  formatPackedRefs,
  listRealRefs,
} from './shadow-repository/shadow-refs.ts';
import {
  createShadowRepository,
  removeShadowRepository,
} from './shadow-repository/shadow-repository.ts';

/**
 Shapes of the preparation and landing internals exposed to built-artifact tests.
 */
export type LandingTestExports = Readonly<{
  /**
   Internal `acquireOwnerLock`.
   */
  acquireOwnerLock: typeof acquireOwnerLock;
  /**
   Internal `acquireRealIndexLock`.
   */
  acquireRealIndexLock: typeof acquireRealIndexLock;
  /**
   Internal `baseRevision`.
   */
  baseRevision: typeof baseRevision;
  /**
   Internal `captureInvocation`.
   */
  captureInvocation: typeof captureInvocation;
  /**
   Internal `combineConfigParameters`.
   */
  combineConfigParameters: typeof combineConfigParameters;
  /**
   Internal `computeHookDispatchPlan`.
   */
  computeHookDispatchPlan: typeof computeHookDispatchPlan;
  /**
   Internal `computeLandingPostIndex`.
   */
  computeLandingPostIndex: typeof computeLandingPostIndex;
  /**
   Internal `createShadowRepository`.
   */
  createShadowRepository: typeof createShadowRepository;
  /**
   Internal `formatPackedRefs`.
   */
  formatPackedRefs: typeof formatPackedRefs;
  /**
   Internal `formatPreparationLease`.
   */
  formatPreparationLease: typeof formatPreparationLease;
  /**
   Internal `formatShadowConfig`.
   */
  formatShadowConfig: typeof formatShadowConfig;
  /**
   Internal `globalConfigOverrides`.
   */
  globalConfigOverrides: typeof globalConfigOverrides;
  /**
   Internal `hasValidInheritedLease`.
   */
  hasValidInheritedLease: typeof hasValidInheritedLease;
  /**
   Internal `HOOK_DISPATCH_PROGRAM`.
   */
  HOOK_DISPATCH_PROGRAM: typeof HOOK_DISPATCH_PROGRAM;
  /**
   Internal `hookEntryProgram`.
   */
  hookEntryProgram: typeof hookEntryProgram;
  /**
   Internal `IndexLockBusyError`.
   */
  IndexLockBusyError: typeof IndexLockBusyError;
  /**
   Internal `indexLockRecordFilename`.
   */
  indexLockRecordFilename: typeof indexLockRecordFilename;
  /**
   Internal `isPrivateShadowEntry`.
   */
  isPrivateShadowEntry: typeof isPrivateShadowEntry;
  /**
   Internal `isRegistryLockName`.
   */
  isRegistryLockName: typeof isRegistryLockName;
  /**
   Internal `JOURNAL_SCHEMA_VERSION`.
   */
  JOURNAL_SCHEMA_VERSION: typeof JOURNAL_SCHEMA_VERSION;
  /**
   Internal `landingFindingResult`.
   */
  landingFindingResult: typeof landingFindingResult;
  /**
   Internal `landingRecordFilename`.
   */
  landingRecordFilename: typeof landingRecordFilename;
  /**
   Internal `landingReflogMessage`.
   */
  landingReflogMessage: typeof landingReflogMessage;
  /**
   Internal `landingReflogPrefix`.
   */
  landingReflogPrefix: typeof landingReflogPrefix;
  /**
   Internal `landTransaction`.
   */
  landTransaction: typeof landTransaction;
  /**
   Internal `listRealRefs`.
   */
  listRealRefs: typeof listRealRefs;
  /**
   Internal `lockPidPath`.
   */
  lockPidPath: typeof lockPidPath;
  /**
   Internal `migrateShadowObjects`.
   */
  migrateShadowObjects: typeof migrateShadowObjects;
  /**
   Internal `NativeCommitFailedError`.
   */
  NativeCommitFailedError: typeof NativeCommitFailedError;
  /**
   Internal `OwnerLockError`.
   */
  OwnerLockError: typeof OwnerLockError;
  /**
   Internal `parseIndexLockRecord`.
   */
  parseIndexLockRecord: typeof parseIndexLockRecord;
  /**
   Internal `parseLandingRecord`.
   */
  parseLandingRecord: typeof parseLandingRecord;
  /**
   Internal `parseOwnerLockRecord`.
   */
  parseOwnerLockRecord: typeof parseOwnerLockRecord;
  /**
   Internal `parsePreparedRecord`.
   */
  parsePreparedRecord: typeof parsePreparedRecord;
  /**
   Internal `parsePreparingRecord`.
   */
  parsePreparingRecord: typeof parsePreparingRecord;
  /**
   Internal `parseRefUpdatedRecord`.
   */
  parseRefUpdatedRecord: typeof parseRefUpdatedRecord;
  /**
   Internal `postIndexFilename`.
   */
  postIndexFilename: typeof postIndexFilename;
  /**
   Internal `PREPARED_FILENAME`.
   */
  PREPARED_FILENAME: typeof PREPARED_FILENAME;
  /**
   Internal `PREPARING_FILENAME`.
   */
  PREPARING_FILENAME: typeof PREPARING_FILENAME;
  /**
   Internal `preLandingIndexFilename`.
   */
  preLandingIndexFilename: typeof preLandingIndexFilename;
  /**
   Internal `quoteConfigParameter`.
   */
  quoteConfigParameter: typeof quoteConfigParameter;
  /**
   Internal `quoteGitConfigValue`.
   */
  quoteGitConfigValue: typeof quoteGitConfigValue;
  /**
   Internal `readOwnerLockRecord`.
   */
  readOwnerLockRecord: typeof readOwnerLockRecord;
  /**
   Internal `readPreparedCommit`.
   */
  readPreparedCommit: typeof readPreparedCommit;
  /**
   Internal `REF_UPDATED_RECORD_FILENAME`.
   */
  REF_UPDATED_RECORD_FILENAME: typeof REF_UPDATED_RECORD_FILENAME;
  /**
   Internal `removeShadowRepository`.
   */
  removeShadowRepository: typeof removeShadowRepository;
  /**
   Internal `removeTransactionKeeps`.
   */
  removeTransactionKeeps: typeof removeTransactionKeeps;
  /**
   Internal `runNativePreparation`.
   */
  runNativePreparation: typeof runNativePreparation;
  /**
   Internal `shadowRepositoryPath`.
   */
  shadowRepositoryPath: typeof shadowRepositoryPath;
  /**
   Internal `splitCommitInvocation`.
   */
  splitCommitInvocation: typeof splitCommitInvocation;
  /**
   Internal `transactionKeepMessage`.
   */
  transactionKeepMessage: typeof transactionKeepMessage;
  /**
   Internal `withoutAllFlag`.
   */
  withoutAllFlag: typeof withoutAllFlag;
  /**
   Internal `writeHookShim`.
   */
  writeHookShim: typeof writeHookShim;
  /**
   Internal `writeIndexInstalledMarker`.
   */
  writeIndexInstalledMarker: typeof writeIndexInstalledMarker;
  /**
   Internal `writeJournalRecord`.
   */
  writeJournalRecord: typeof writeJournalRecord;
}>;

/**
 Preparation and landing internals as one plain object, merged into the package's test export object.
 */
export const landingTestExports: LandingTestExports = {
  acquireOwnerLock,
  acquireRealIndexLock,
  baseRevision,
  captureInvocation,
  combineConfigParameters,
  computeHookDispatchPlan,
  computeLandingPostIndex,
  createShadowRepository,
  formatPackedRefs,
  formatPreparationLease,
  formatShadowConfig,
  globalConfigOverrides,
  hasValidInheritedLease,
  HOOK_DISPATCH_PROGRAM,
  hookEntryProgram,
  IndexLockBusyError,
  indexLockRecordFilename,
  isPrivateShadowEntry,
  isRegistryLockName,
  JOURNAL_SCHEMA_VERSION,
  landingFindingResult,
  landingRecordFilename,
  landingReflogMessage,
  landingReflogPrefix,
  landTransaction,
  listRealRefs,
  lockPidPath,
  migrateShadowObjects,
  NativeCommitFailedError,
  OwnerLockError,
  parseIndexLockRecord,
  parseLandingRecord,
  parseOwnerLockRecord,
  parsePreparedRecord,
  parsePreparingRecord,
  parseRefUpdatedRecord,
  postIndexFilename,
  PREPARED_FILENAME,
  PREPARING_FILENAME,
  preLandingIndexFilename,
  quoteConfigParameter,
  quoteGitConfigValue,
  readOwnerLockRecord,
  readPreparedCommit,
  REF_UPDATED_RECORD_FILENAME,
  removeShadowRepository,
  removeTransactionKeeps,
  runNativePreparation,
  shadowRepositoryPath,
  splitCommitInvocation,
  transactionKeepMessage,
  withoutAllFlag,
  writeHookShim,
  writeIndexInstalledMarker,
  writeJournalRecord,
};
