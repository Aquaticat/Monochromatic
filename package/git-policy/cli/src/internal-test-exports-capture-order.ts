/**
 Capture-order internals reachable from the built artifact for unit tests.

 Not part of the authoring API;
 names and shapes change without notice.

 @internal

 @module
 */
import { decideCaptureOrder, } from './policy-engine/commit-capture-order-decision.ts';
import { listWorktreeCapturedPaths, } from './policy-engine/commit-capture-order-capture.ts';
import {
  listLandedChanges,
  parseCommitChanges,
} from './policy-engine/commit-capture-order-history.ts';
import {
  CAPTURED_ABSENT,
  parseCapturedRecord,
  readCapturedRecord,
} from './policy-engine/commit-capture-order-journal.ts';
import { pruneLandedCaptures, } from './policy-engine/commit-capture-order-prune.ts';
import {
  landedRecordDirectory,
  parseLandedCaptureRecord,
  readLandedCaptures,
  recordLandedCapture,
} from './policy-engine/commit-capture-order-records.ts';
import { decideSharedPaths, } from './policy-engine/commit-capture-order-replay.ts';
import {
  captureInOrder,
  captureStorePath,
  readNextCaptureSequence,
} from './policy-engine/commit-capture-order-store.ts';

/**
 Shapes of the capture-order internals exposed to built-artifact tests.
 */
export type CaptureOrderTestExports = Readonly<{
  /**
   Internal `CAPTURED_ABSENT`.
   */
  CAPTURED_ABSENT: typeof CAPTURED_ABSENT;
  /**
   Internal `captureInOrder`.
   */
  captureInOrder: typeof captureInOrder;
  /**
   Internal `captureStorePath`.
   */
  captureStorePath: typeof captureStorePath;
  /**
   Internal `decideCaptureOrder`.
   */
  decideCaptureOrder: typeof decideCaptureOrder;
  /**
   Internal `decideSharedPaths`.
   */
  decideSharedPaths: typeof decideSharedPaths;
  /**
   Internal `landedRecordDirectory`.
   */
  landedRecordDirectory: typeof landedRecordDirectory;
  /**
   Internal `listLandedChanges`.
   */
  listLandedChanges: typeof listLandedChanges;
  /**
   Internal `listWorktreeCapturedPaths`.
   */
  listWorktreeCapturedPaths: typeof listWorktreeCapturedPaths;
  /**
   Internal `parseCapturedRecord`.
   */
  parseCapturedRecord: typeof parseCapturedRecord;
  /**
   Internal `parseCommitChanges`.
   */
  parseCommitChanges: typeof parseCommitChanges;
  /**
   Internal `parseLandedCaptureRecord`.
   */
  parseLandedCaptureRecord: typeof parseLandedCaptureRecord;
  /**
   Internal `pruneLandedCaptures`.
   */
  pruneLandedCaptures: typeof pruneLandedCaptures;
  /**
   Internal `readCapturedRecord`.
   */
  readCapturedRecord: typeof readCapturedRecord;
  /**
   Internal `readLandedCaptures`.
   */
  readLandedCaptures: typeof readLandedCaptures;
  /**
   Internal `readNextCaptureSequence`.
   */
  readNextCaptureSequence: typeof readNextCaptureSequence;
  /**
   Internal `recordLandedCapture`.
   */
  recordLandedCapture: typeof recordLandedCapture;
}>;

/**
 Capture-order internals for built-artifact tests.
 */
export const captureOrderTestExports: CaptureOrderTestExports = {
  CAPTURED_ABSENT,
  captureInOrder,
  captureStorePath,
  decideCaptureOrder,
  decideSharedPaths,
  landedRecordDirectory,
  listLandedChanges,
  listWorktreeCapturedPaths,
  parseCapturedRecord,
  parseCommitChanges,
  parseLandedCaptureRecord,
  pruneLandedCaptures,
  readCapturedRecord,
  readLandedCaptures,
  readNextCaptureSequence,
  recordLandedCapture,
};
