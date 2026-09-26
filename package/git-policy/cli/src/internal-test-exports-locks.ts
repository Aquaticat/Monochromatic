/**
 Foreign `index.lock` classification, lock PID injection, and index-writer coordination internals,
 reachable from the built artifact only so unit tests exercise what consumers load.

 @internal

 @module
 */
import {
  ALIAS_SPLIT_FAILED,
  ALIAS_UNSET,
  createsOrMovesWorktrees,
  resolveForwardedCommand,
  splitAliasCommand,
} from './forwarded-command.ts';
import {
  CONFIG_COUNT_MALFORMED,
  gitChildEnvironment,
  lockfilePidOverlay,
  parseConfigCount,
} from './git-child-environment.ts';
import {
  classifyIndexLock,
  describeIndexLockEvidence,
  gatherIndexLockEvidence,
  LOCK_ABSENT,
  parsePidFileText,
  PID_TEXT_MALFORMED,
  provenHolderLine,
  readLockMetadata,
  readPidFileEvidence,
} from './index-lock/index-lock-evidence.ts';
import {
  matchingHolders,
  parseLsofFields,
} from './index-lock/index-lock-holders-darwin.ts';
import {
  scanProcFdHolders,
} from './index-lock/index-lock-holders-linux.ts';
import {
  parseRestartManagerOutput,
} from './index-lock/index-lock-holders-win32.ts';
import {
  BACKOFF_MAX_MULTIPLIER,
  IndexLockUnprovenOwnerError,
  INITIAL_BACKOFF,
  jitteredWait,
  LOCK_HELD,
  nextBackoff,
  PROVEN_BY_DESCRIPTOR_POLL_CAP_MS,
  PROVEN_BY_PID_FILE_POLL_CAP_MS,
  waitForIndexLock,
} from './index-lock/index-lock-wait.ts';
import {
  isIndexWriter,
} from './index-lock/index-writer-commands.ts';
import {
  formatLandingLease,
  hasValidLandingLease,
  LANDING_LEASE_ENV,
} from './index-lock/landing-lease.ts';
import {
  parseLinuxStat,
  resolveProcessStart,
} from './index-lock/process-start-time.ts';

/**
 Shapes of the lock internals exposed to built-artifact tests.
 */
export type LockTestExports = Readonly<{
  /**
   Internal `ALIAS_SPLIT_FAILED`.
   */
  ALIAS_SPLIT_FAILED: typeof ALIAS_SPLIT_FAILED;
  /**
   Internal `ALIAS_UNSET`.
   */
  ALIAS_UNSET: typeof ALIAS_UNSET;
  /**
   Internal `BACKOFF_MAX_MULTIPLIER`.
   */
  BACKOFF_MAX_MULTIPLIER: typeof BACKOFF_MAX_MULTIPLIER;
  /**
   Internal `classifyIndexLock`.
   */
  classifyIndexLock: typeof classifyIndexLock;
  /**
   Internal `CONFIG_COUNT_MALFORMED`.
   */
  CONFIG_COUNT_MALFORMED: typeof CONFIG_COUNT_MALFORMED;
  /**
   Internal `createsOrMovesWorktrees`.
   */
  createsOrMovesWorktrees: typeof createsOrMovesWorktrees;
  /**
   Internal `describeIndexLockEvidence`.
   */
  describeIndexLockEvidence: typeof describeIndexLockEvidence;
  /**
   Internal `formatLandingLease`.
   */
  formatLandingLease: typeof formatLandingLease;
  /**
   Internal `gatherIndexLockEvidence`.
   */
  gatherIndexLockEvidence: typeof gatherIndexLockEvidence;
  /**
   Internal `gitChildEnvironment`.
   */
  gitChildEnvironment: typeof gitChildEnvironment;
  /**
   Internal `hasValidLandingLease`.
   */
  hasValidLandingLease: typeof hasValidLandingLease;
  /**
   Internal `IndexLockUnprovenOwnerError`.
   */
  IndexLockUnprovenOwnerError: typeof IndexLockUnprovenOwnerError;
  /**
   Internal `INITIAL_BACKOFF`.
   */
  INITIAL_BACKOFF: typeof INITIAL_BACKOFF;
  /**
   Internal `isIndexWriter`.
   */
  isIndexWriter: typeof isIndexWriter;
  /**
   Internal `jitteredWait`.
   */
  jitteredWait: typeof jitteredWait;
  /**
   Internal `LANDING_LEASE_ENV`.
   */
  LANDING_LEASE_ENV: typeof LANDING_LEASE_ENV;
  /**
   Internal `LOCK_ABSENT`.
   */
  LOCK_ABSENT: typeof LOCK_ABSENT;
  /**
   Internal `LOCK_HELD`.
   */
  LOCK_HELD: typeof LOCK_HELD;
  /**
   Internal `lockfilePidOverlay`.
   */
  lockfilePidOverlay: typeof lockfilePidOverlay;
  /**
   Internal `matchingHolders`.
   */
  matchingHolders: typeof matchingHolders;
  /**
   Internal `nextBackoff`.
   */
  nextBackoff: typeof nextBackoff;
  /**
   Internal `parseConfigCount`.
   */
  parseConfigCount: typeof parseConfigCount;
  /**
   Internal `parseLinuxStat`.
   */
  parseLinuxStat: typeof parseLinuxStat;
  /**
   Internal `parseLsofFields`.
   */
  parseLsofFields: typeof parseLsofFields;
  /**
   Internal `parsePidFileText`.
   */
  parsePidFileText: typeof parsePidFileText;
  /**
   Internal `parseRestartManagerOutput`.
   */
  parseRestartManagerOutput: typeof parseRestartManagerOutput;
  /**
   Internal `PID_TEXT_MALFORMED`.
   */
  PID_TEXT_MALFORMED: typeof PID_TEXT_MALFORMED;
  /**
   Internal `PROVEN_BY_DESCRIPTOR_POLL_CAP_MS`.
   */
  PROVEN_BY_DESCRIPTOR_POLL_CAP_MS: typeof PROVEN_BY_DESCRIPTOR_POLL_CAP_MS;
  /**
   Internal `PROVEN_BY_PID_FILE_POLL_CAP_MS`.
   */
  PROVEN_BY_PID_FILE_POLL_CAP_MS: typeof PROVEN_BY_PID_FILE_POLL_CAP_MS;
  /**
   Internal `provenHolderLine`.
   */
  provenHolderLine: typeof provenHolderLine;
  /**
   Internal `readLockMetadata`.
   */
  readLockMetadata: typeof readLockMetadata;
  /**
   Internal `readPidFileEvidence`.
   */
  readPidFileEvidence: typeof readPidFileEvidence;
  /**
   Internal `resolveForwardedCommand`.
   */
  resolveForwardedCommand: typeof resolveForwardedCommand;
  /**
   Internal `resolveProcessStart`.
   */
  resolveProcessStart: typeof resolveProcessStart;
  /**
   Internal `scanProcFdHolders`.
   */
  scanProcFdHolders: typeof scanProcFdHolders;
  /**
   Internal `splitAliasCommand`.
   */
  splitAliasCommand: typeof splitAliasCommand;
  /**
   Internal `waitForIndexLock`.
   */
  waitForIndexLock: typeof waitForIndexLock;
}>;

/**
 Lock internals as one plain object, merged into the package's test export object.
 */
export const lockTestExports: LockTestExports = {
  ALIAS_SPLIT_FAILED,
  ALIAS_UNSET,
  BACKOFF_MAX_MULTIPLIER,
  classifyIndexLock,
  CONFIG_COUNT_MALFORMED,
  createsOrMovesWorktrees,
  describeIndexLockEvidence,
  formatLandingLease,
  gatherIndexLockEvidence,
  gitChildEnvironment,
  hasValidLandingLease,
  IndexLockUnprovenOwnerError,
  INITIAL_BACKOFF,
  isIndexWriter,
  jitteredWait,
  LANDING_LEASE_ENV,
  LOCK_ABSENT,
  LOCK_HELD,
  lockfilePidOverlay,
  matchingHolders,
  nextBackoff,
  parseConfigCount,
  parseLinuxStat,
  parseLsofFields,
  parsePidFileText,
  parseRestartManagerOutput,
  PID_TEXT_MALFORMED,
  PROVEN_BY_DESCRIPTOR_POLL_CAP_MS,
  PROVEN_BY_PID_FILE_POLL_CAP_MS,
  provenHolderLine,
  readLockMetadata,
  readPidFileEvidence,
  resolveForwardedCommand,
  resolveProcessStart,
  scanProcFdHolders,
  splitAliasCommand,
  waitForIndexLock,
};
