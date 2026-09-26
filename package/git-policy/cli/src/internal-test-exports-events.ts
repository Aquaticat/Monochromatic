/**
 JSONL event constructors and renderer,
 reachable from the built artifact only so the schema compatibility test exercises what consumers load.

 @internal

 @module
 */
import {
  createCommitLandedEvent,
  createConfigurationWarningEvent,
  createCoreFindingEvent,
  createEngineFailureEvent,
  createFindingEvent,
  createFixSummaryEvent,
  renderPolicyEvents,
} from './policy-engine/events.ts';

/**
 Shapes of the event internals exposed to built-artifact tests.
 */
export type EventTestExports = Readonly<{
  /**
   Internal `createCommitLandedEvent`.
   */
  createCommitLandedEvent: typeof createCommitLandedEvent;
  /**
   Internal `createConfigurationWarningEvent`.
   */
  createConfigurationWarningEvent: typeof createConfigurationWarningEvent;
  /**
   Internal `createCoreFindingEvent`.
   */
  createCoreFindingEvent: typeof createCoreFindingEvent;
  /**
   Internal `createEngineFailureEvent`.
   */
  createEngineFailureEvent: typeof createEngineFailureEvent;
  /**
   Internal `createFindingEvent`.
   */
  createFindingEvent: typeof createFindingEvent;
  /**
   Internal `createFixSummaryEvent`.
   */
  createFixSummaryEvent: typeof createFixSummaryEvent;
  /**
   Internal `renderPolicyEvents`.
   */
  renderPolicyEvents: typeof renderPolicyEvents;
}>;

/**
 Event internals as one plain object, merged into the package's test export object.
 */
export const eventTestExports: EventTestExports = {
  createCommitLandedEvent,
  createConfigurationWarningEvent,
  createCoreFindingEvent,
  createEngineFailureEvent,
  createFindingEvent,
  createFixSummaryEvent,
  renderPolicyEvents,
};
