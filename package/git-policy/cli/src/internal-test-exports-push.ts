/**
 Single-flight auto-push and manual-push probe internals reachable from the built artifact for unit tests.

 Not part of the authoring API;
 names and shapes change without notice.

 @internal

 @module
 */
import {
  autoPush,
  filterPushOutput,
} from './auto-push.ts';
import {
  BranchKeyError,
  decodeBranchKey,
  encodeBranchKey,
} from './auto-push-branch-key.ts';
import {
  LAST_PUSHED_ABSENT,
  LAST_PUSHED_SUFFIX,
  parseLastPushedRecord,
  readLastPushedRecord,
  writeLastPushedRecord,
} from './auto-push-record.ts';
import {
  resolvePushCoordinationPaths,
  runSingleFlightPush,
  tipContains,
} from './auto-push-single-flight.ts';
import {
  ManualPushProbeError,
  probeManualPushUpdates,
} from './policy-engine/manual-push-probe.ts';

/**
 Shapes of the auto-push internals exposed to built-artifact tests.
 */
export type PushTestExports = Readonly<{
  /**
   Internal `autoPush`.
   */
  autoPush: typeof autoPush;
  /**
   Internal `BranchKeyError`.
   */
  BranchKeyError: typeof BranchKeyError;
  /**
   Internal `decodeBranchKey`.
   */
  decodeBranchKey: typeof decodeBranchKey;
  /**
   Internal `encodeBranchKey`.
   */
  encodeBranchKey: typeof encodeBranchKey;
  /**
   Internal `filterPushOutput`.
   */
  filterPushOutput: typeof filterPushOutput;
  /**
   Internal `LAST_PUSHED_ABSENT`.
   */
  LAST_PUSHED_ABSENT: typeof LAST_PUSHED_ABSENT;
  /**
   Internal `LAST_PUSHED_SUFFIX`.
   */
  LAST_PUSHED_SUFFIX: typeof LAST_PUSHED_SUFFIX;
  /**
   Internal `ManualPushProbeError`.
   */
  ManualPushProbeError: typeof ManualPushProbeError;
  /**
   Internal `parseLastPushedRecord`.
   */
  parseLastPushedRecord: typeof parseLastPushedRecord;
  /**
   Internal `probeManualPushUpdates`.
   */
  probeManualPushUpdates: typeof probeManualPushUpdates;
  /**
   Internal `readLastPushedRecord`.
   */
  readLastPushedRecord: typeof readLastPushedRecord;
  /**
   Internal `resolvePushCoordinationPaths`.
   */
  resolvePushCoordinationPaths: typeof resolvePushCoordinationPaths;
  /**
   Internal `runSingleFlightPush`.
   */
  runSingleFlightPush: typeof runSingleFlightPush;
  /**
   Internal `tipContains`.
   */
  tipContains: typeof tipContains;
  /**
   Internal `writeLastPushedRecord`.
   */
  writeLastPushedRecord: typeof writeLastPushedRecord;
}>;

/**
 Auto-push internals as one plain object, merged into the package's test export object.
 */
export const pushTestExports: PushTestExports = {
  autoPush,
  BranchKeyError,
  decodeBranchKey,
  encodeBranchKey,
  filterPushOutput,
  LAST_PUSHED_ABSENT,
  LAST_PUSHED_SUFFIX,
  ManualPushProbeError,
  parseLastPushedRecord,
  probeManualPushUpdates,
  readLastPushedRecord,
  resolvePushCoordinationPaths,
  runSingleFlightPush,
  tipContains,
  writeLastPushedRecord,
};
