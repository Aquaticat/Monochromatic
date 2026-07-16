/**
 * Goal continuation transitions at Pi's final settlement boundary.
 *
 * @module
 */

import { buildGoalMessage, } from './message.ts';
import { reduceGoalEvent, } from './reducer.ts';
import type {
  GoalControllerState,
  GoalControllerTransition,
  GoalMessageMarker,
} from './types.ts';

/**
 * Continue active goal after Pi reports final agent settlement.
 *
 * Deferred kickoff takes priority over generic continuation.
 * Every delayed message validates run, generation, and runtime epoch before delivery.
 *
 * @param controller - controller at settlement time
 *
 * @param marker - unique marker for potential continuation message
 *
 * @param timestamp - ISO settlement timestamp
 *
 * @param hasPendingMessages - whether human input already owns next turn
 *
 * @returns next controller with at most one turn-triggering message
 *
 * @example
 * ```ts
 * settleGoal({ controller, marker, timestamp, hasPendingMessages: false });
 * ```
 */
function settleGoal(
  {
    controller,
    marker,
    timestamp,
    hasPendingMessages,
  }: {
    readonly controller: GoalControllerState;
    readonly marker: GoalMessageMarker;
    readonly timestamp: string;
    readonly hasPendingMessages: boolean;
  },
): GoalControllerTransition {
  if (controller.shutdown)
    return {
      controller,
      effects: [],
    };
  if (controller.goal
    .phase
    !== 'active') {
    return {
      controller: {
        goal: controller.goal,
        runtimeEpoch: controller.runtimeEpoch,
        settlementSequence: controller.settlementSequence,
        shutdown: controller.shutdown,
      },
      effects: [],
    };
  }
  if (hasPendingMessages)
    return {
      controller,
      effects: [],
    };
  /**
   * Deferred kickoff candidate captured while Pi was busy.
   */
  const { pendingKickoff, } = controller;
  if ((pendingKickoff !== undefined)
    && (pendingKickoff.runId
      === controller.goal
      .runId)
    && (pendingKickoff.generationId
      === controller.goal
      .generationId)
    && (pendingKickoff.runtimeEpoch === controller.runtimeEpoch)) {
    /**
     * Visible kickoff rebuilt from current validated generation.
     */
    const kickoff = buildGoalMessage({
      goal: controller.goal,
      kind: 'kickoff',
      continuationSequence: controller.goal
        .continuationSequence,
      marker: pendingKickoff.marker,
    },);
    return {
      controller: {
        goal: controller.goal,
        runtimeEpoch: controller.runtimeEpoch,
        settlementSequence: controller.settlementSequence + 1,
        lastEmittedSettlementSequence: controller.settlementSequence + 1,
        shutdown: controller.shutdown,
      },
      effects: [{
        type: 'send_message',
        message: kickoff,
        triggerTurn: true,
      },],
    };
  }
  /**
   * Next persisted continuation sequence.
   */
  const continuationSequence = controller.goal
    .continuationSequence
    + 1;
  /**
   * Auditable continuation issuance event.
   */
  const event = {
    kind: 'continuation_issued',
    runId: controller.goal
      .runId,
    generationId: controller.goal
      .generationId,
    continuationSequence,
    transitionedAt: timestamp,
  } as const;
  /**
   * Active state advanced through reconstruction reducer.
   */
  const goal = reduceGoalEvent({
    state: controller.goal,
    event,
  },);
  if (goal.phase !== 'active')
    throw new Error('Goal continuation event did not retain active state',);
  /**
   * Visible continuation message for exact current generation.
   */
  const continuation = buildGoalMessage({
    goal,
    kind: 'continuation',
    continuationSequence,
    marker,
  },);
  /**
   * Runtime-local settlement sequence after this emission.
   */
  const settlementSequence = controller.settlementSequence + 1;
  return {
    controller: {
      goal,
      runtimeEpoch: controller.runtimeEpoch,
      settlementSequence,
      lastEmittedSettlementSequence: settlementSequence,
      shutdown: controller.shutdown,
    },
    effects: [
      {
        type: 'persist',
        event,
      },
      {
        type: 'send_message',
        message: continuation,
        triggerTurn: true,
      },
      {
        type: 'log',
        level: 'debug',
        message: `continued goal run ${goal.runId} at sequence ${continuationSequence}`,
      },
    ],
  };
}

/**
 * Stop delayed goal actions before runtime replacement or quit.
 *
 * @param controller - current controller
 *
 * @returns shutdown controller and footer-clear effect
 *
 * @example
 * ```ts
 * shutdownGoalController(controller);
 * ```
 */
function shutdownGoalController(controller: GoalControllerState,): GoalControllerTransition {
  return {
    controller: {
      goal: controller.goal,
      runtimeEpoch: controller.runtimeEpoch,
      settlementSequence: controller.settlementSequence,
      shutdown: true,
    },
    effects: [{ type: 'clear_footer', },],
  };
}

export {
  settleGoal,
  shutdownGoalController,
};
