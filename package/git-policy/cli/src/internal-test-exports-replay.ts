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
   Internal `rewriteCommitObject`.
   */
  rewriteCommitObject: typeof rewriteCommitObject;
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
  droppedReplayHeaders,
  identityEnvironment,
  mergeReplayTree,
  parsePhaseSignal,
  parseRawCommit,
  reachTransactionPhase,
  replayMergeBase,
  replayOptions,
  rewriteCommitObject,
  TestPhaseSignalError,
  writeReplayedCommit,
};
