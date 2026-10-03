/**
 Replay and test-phase internals reachable from the built artifact for unit tests.

 Not part of the authoring API;
 names and shapes change without notice.

 @internal

 @module
 */
import {
  droppedReplayHeaders,
  identityEnvironment,
  parseRawCommit,
  rewriteCommitObject,
} from './policy-engine/commit-replay-object.ts';
import { replayOptions, } from './policy-engine/commit-replay-options.ts';
import { containsLandedChange, } from './policy-engine/commit-replay-containment.ts';
import {
  parseIndexedPatch,
  splitKeepingNewlines,
} from './policy-engine/commit-replay-patch.ts';
import { reverseApplies, } from './policy-engine/commit-replay-reverse-apply.ts';
import { subsumeLandedChanges, } from './policy-engine/commit-replay-subsumption.ts';
import {
  mergeReplayTree,
  replayMergeBase,
  writeReplayedCommit,
} from './policy-engine/commit-replay.ts';
import {
  parsePhaseSignal,
  reachTransactionPhase,
  TestPhaseSignalError,
} from './policy-engine/commit-transaction-test-phase.ts';
import { appendEvents, } from './policy-engine/events-concurrency.ts';

/**
 Shapes of the replay internals exposed to built-artifact tests.
 */
export type ReplayTestExports = Readonly<{
  /**
   Internal `appendEvents`.
   */
  appendEvents: typeof appendEvents;
  /**
   Internal `containsLandedChange`.
   */
  containsLandedChange: typeof containsLandedChange;
  /**
   Internal `droppedReplayHeaders`.
   */
  droppedReplayHeaders: typeof droppedReplayHeaders;
  /**
   Internal `identityEnvironment`.
   */
  identityEnvironment: typeof identityEnvironment;
  /**
   Internal `mergeReplayTree`.
   */
  mergeReplayTree: typeof mergeReplayTree;
  /**
   Internal `parseIndexedPatch`.
   */
  parseIndexedPatch: typeof parseIndexedPatch;
  /**
   Internal `parsePhaseSignal`.
   */
  parsePhaseSignal: typeof parsePhaseSignal;
  /**
   Internal `parseRawCommit`.
   */
  parseRawCommit: typeof parseRawCommit;
  /**
   Internal `reachTransactionPhase`.
   */
  reachTransactionPhase: typeof reachTransactionPhase;
  /**
   Internal `replayMergeBase`.
   */
  replayMergeBase: typeof replayMergeBase;
  /**
   Internal `replayOptions`.
   */
  replayOptions: typeof replayOptions;
  /**
   Internal `reverseApplies`.
   */
  reverseApplies: typeof reverseApplies;
  /**
   Internal `rewriteCommitObject`.
   */
  rewriteCommitObject: typeof rewriteCommitObject;
  /**
   Internal `splitKeepingNewlines`.
   */
  splitKeepingNewlines: typeof splitKeepingNewlines;
  /**
   Internal `subsumeLandedChanges`.
   */
  subsumeLandedChanges: typeof subsumeLandedChanges;
  /**
   Internal `TestPhaseSignalError`.
   */
  TestPhaseSignalError: typeof TestPhaseSignalError;
  /**
   Internal `writeReplayedCommit`.
   */
  writeReplayedCommit: typeof writeReplayedCommit;
}>;

/**
 Replay internals as one plain object, merged into the package's test export object.
 */
export const replayTestExports: ReplayTestExports = {
  appendEvents,
  containsLandedChange,
  droppedReplayHeaders,
  identityEnvironment,
  mergeReplayTree,
  parseIndexedPatch,
  parsePhaseSignal,
  parseRawCommit,
  reachTransactionPhase,
  replayMergeBase,
  replayOptions,
  reverseApplies,
  rewriteCommitObject,
  splitKeepingNewlines,
  subsumeLandedChanges,
  TestPhaseSignalError,
  writeReplayedCommit,
};
