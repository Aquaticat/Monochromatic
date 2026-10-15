/** Original group failures retain occurrence order, pending rejection, and cancellation publication. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { RecordedGroupFailureError } from './group-failure-error.ts';
import type { GroupFailures, GroupFailuresInput, GroupFailureInput } from './group-failure-types.ts';

/** Failure logs describe custody transitions without serializing arbitrary caught values. */
const l = tagged({ tag: 'auto-mode-group-failures' });

//region New occurrences are retained before original delivery cancellation, even when caught values repeat.
/**
 Retain original failure occurrences and their group cancellation effects.

 @param groupState - original primary failure, retirement, and collection phase

 @param failures - original append-only occurrence history

 @param controller - original collector cancellation owner

 @param rejectPending - original pending delivery rejection callback

 @returns original occurrence recording and already-recorded boundary propagation

 @example createGroupFailures({ groupState, failures, controller, rejectPending });
 */
export function createGroupFailures({ groupState, failures, controller, rejectPending }: GroupFailuresInput): GroupFailures {
  /** Failure callbacks retain the original owner across cancellation reentry. */
  const rl = tagged({ tag: createGroupFailures.name, l });
  rl.debug('binding original group failure owner');
  /** Cancellation observations are cached only after original failure publication returns. */
  const abortOccurrences = new WeakMap<AbortSignal, RecordedGroupFailureError>();
  /**
   Record every newly observed failure, including repeated equal-valued throws.

   @param error - original caught or cancellation value

   @param at - original observation boundary

   @returns internal token for this exact retained failure occurrence
   */
  function recordFailure({ error, at }: GroupFailureInput): RecordedGroupFailureError {
    /** Recording logs omit the original caught value and caller-supplied boundary text. */
    const fl = tagged({ tag: recordFailure.name, l: rl });
    fl.debug('retaining new original failure occurrence');
    /** Original failure identity is independent of equality between caught values. */
    const occurrence = Object.freeze({ identity: Object.freeze({}), ordinal: failures.length, at, error });
    /** This token prevents a propagated occurrence from being appended again. */
    const recorded = new RecordedGroupFailureError(occurrence);
    failures.push(occurrence);
    if ((!groupState.primary) && (!groupState.closed) && (groupState.phase !== 'settled')) {
      groupState.primary = recorded;
      groupState.phase = 'failed';
      rejectPending({ error, state: 'rejected' });
      controller.abort(error);
      fl.debug('published original group failure and cancellation');
    }
    return recorded;
  }
  /**
   Reuse a completed cancellation observation while retaining first-observation callback order.

   @param observed - original cancellation source

   @param at - original cancellation observation boundary

   @returns original recorded cancellation after publication completes
   */
  function abortOccurrence({ observed, at }: Parameters<GroupFailures['abortOccurrence']>[0]): RecordedGroupFailureError {
    /** Repeated cancellation logging does not read or replace the original reason. */
    const al = tagged({ tag: abortOccurrence.name, l: rl });
    /** An earlier completed observation remains authoritative for this exact signal. */
    const existing = abortOccurrences.get(observed);
    if (existing) {
      al.debug('retaining original cancellation occurrence');
      return existing;
    }
    /** Original callbacks run before caching, preserving reentry and failure behavior. */
    const recorded = recordFailure({ error: observed.reason, at });
    abortOccurrences.set(observed, recorded);
    al.debug('published original cancellation occurrence');
    return recorded;
  }
  /**
   Propagate an existing internal token or retain a newly caught original value.

   @param error - original boundary failure or already recorded control-flow token

   @param at - current observation boundary used only for a newly recorded value

   @returns unchanged recorded token or newly retained original occurrence
   */
  function retainBoundaryFailure({ error, at }: GroupFailureInput): RecordedGroupFailureError {
    /** Boundary propagation records no extra failure for an existing internal token. */
    const bl = tagged({ tag: retainBoundaryFailure.name, l: rl });
    bl.debug('retaining original boundary failure');
    return error instanceof RecordedGroupFailureError ? error : recordFailure({ error, at });
  }
  return { recordFailure, abortOccurrence, retainBoundaryFailure };
}
//endregion
