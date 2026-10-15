/**
 Original collector retirement and inspection preserve native outcomes after transport closes. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { DeclaredGroupCollectionError } from './group-collection-error.ts';
import type {
  GroupLifetime,
  GroupLifetimeInput,
  GroupLifetimeInspection
} from './group-lifetime-types.ts';

/**
 Lifetime logs describe transport transitions without serializing original results.
 */
const l = tagged({ tag: 'auto-mode-group-lifetime' });

//region Transport retirement preserves original failure ordering and retained execution observations.
/** Bind original collector lifetime operations to their existing mutable owner.
 @param groupState - original work and transport state
 
 @param records - original declaration-ordered member observations
 
 @param failures - original append-only occurrence history
 
 @param controller - original collector cancellation owner
 
 @param detach - original listener cleanup before retirement
 
 @param recordFailure - original incomplete-membership failure publication
 
 @param rejectPending - original pending transport cancellation
 
 @returns original retirement, draining, and retained inspection operations
 
 @example createGroupLifetime({ groupState, records, failures, controller, detach, recordFailure, rejectPending });
 */
export function createGroupLifetime<const Outcome>({
  groupState,
  records,
  failures,
  controller,
  detach,
  recordFailure,
  rejectPending,
}: GroupLifetimeInput<Outcome>): GroupLifetime<Outcome> {
  /**
   Original lifetime state remains shared with dispatch and completion observation.
   */
  const rl = tagged({
    tag: createGroupLifetime.name,
    l
  });
  rl.debug('binding original collector lifetime');
  /**
   Retire transport delivery after detaching original listeners and retaining incomplete membership.
   */
  function retire(): void {
    /**
     Retirement logs omit underlying caught failures and native outcomes.
     */
    const tl = tagged({
      tag: retire.name,
      l: rl
    });
    if (groupState.closed) {
      tl.debug('original collector transport already retired');
      return;
    }
    detach();
    groupState.phaseAtReturn = groupState.phase;
    if ((groupState.phase === 'collecting') && (!groupState.primary)) recordFailure({
      error: new DeclaredGroupCollectionError('Parent returned before declared membership completed'),
      at: 'incomplete-membership-return',
    });
    groupState.closed = true;
    /**
     Original retirement reason is shared by pending transport rejection and group cancellation.
     */
    const reason = new DeclaredGroupCollectionError('Declared parent group has returned');
    rejectPending({
      error: reason,
      state: 'cancelled'
    });
    controller.abort(reason);
    tl.debug('retired original collector transport');
  }
  /**
   Drain the work published at this call without inferring native effect completion.
   */
  async function drain(): Promise<void> {
    /**
     Draining observes the original published work value exactly once.
     */
    const dl = tagged({
      tag: drain.name,
      l: rl
    });
    dl.debug('draining original collector work');
    await groupState.work;
    dl.debug('original collector work drained');
  }
  /** Inspect retained observations without invoking currentness or granting execution permission.
   @returns frozen transport snapshot retaining original native outcome identities
   */
  function inspect(): GroupLifetimeInspection<Outcome> {
    /**
     Retained inspection may run after failure, cancellation, or retirement.
     */
    const il = tagged({
      tag: inspect.name,
      l: rl
    });
    il.debug('inspecting retained original collector state');
    return Object.freeze({
      phase: groupState.closed ? 'closed' : groupState.phase,
      phaseAtReturn: groupState.phaseAtReturn,
      failed: groupState.primary !== undefined,
      failure: groupState.primary
        ?.occurrence
        .error,
      failures: Object.freeze([...failures]),
      dispatches: groupState.dispatches,
      unboundPending: groupState.unboundPending,
      unboundOutcomes: groupState.unboundOutcomes,
      members: Object.freeze(records.map(function inspectMember(record) {
        return Object.freeze({
          ordinal: record.member
            .ordinal,
          arrival: record.arrival,
          state: record.state,
          completion: record.completion,
        });
      })),
      executionState: 'owned-by-native-consumer-not-inferred',
      effectQualification: 'not-established',
    });
  }
  return {
    retire,
    drain,
    inspect
  };
}
//endregion
