/** Original reached-group collection owns transport without claiming native execution effects. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { createGroupArrival } from './group-arrival.ts';
import { DeclaredGroupCollectionError } from './group-collection-error.ts';
import { createGroupCompletions } from './group-completions.ts';
import { createGroupCurrent } from './group-current.ts';
import { createGroupDispatch } from './group-dispatch.ts';
import { createGroupFailures } from './group-failures.ts';
import { createGroupLifetime } from './group-lifetime.ts';
import type { DispatchedCompletionRecord } from './group-completion-types.ts';
import type { GroupFailureOccurrence } from './group-failure-types.ts';
import type { GroupCollector, GroupCollectorInput, GroupCollectorRecord, GroupCollectorState, GroupCollectorTool, GroupRejectPending } from './group-collector-types.ts';

/** Collector construction logs omit original source text and native inputs. */
const l = tagged({ tag: 'auto-mode-group-collector' });

//region Original pending publication proves ticket allocation before delivery rejection.
/** Read the original pending discriminant published after ticket allocation.
 @param record - original member transport record
 @returns whether original pending delivery owns its allocated ticket
 */
function isPending(record: GroupCollectorRecord): record is GroupCollectorRecord & DispatchedCompletionRecord<unknown> {
  return record.state === 'pending';
}
//endregion

//region Run-local transport composition retains original source and parent capabilities.
/** Collect exact original source members without creating judgment, inference, or permission.
 @param group - original reached-group handle
 @param readGroup - original canonical reached-group reader
 @param signal - original parent cancellation source
 @param assertParentCurrent - original parent lifetime check
 @param dispatchGroup - original complete preparation and native outcome consumer
 @returns original collection callbacks and retained transport lifetime operations
 @throws DeclaredGroupCollectionError when original parent capabilities or frozen group ownership are absent
 @example createReachedGroupRun({ group, readGroup, signal, assertParentCurrent, dispatchGroup });
 */
export function createReachedGroupRun({ group, readGroup, signal, assertParentCurrent, dispatchGroup }: GroupCollectorInput): GroupCollector {
  /** Original construction checks run before reading the canonical reached group. */
  const rl = tagged({ tag: createReachedGroupRun.name, l });
  rl.debug('binding original reached-group collector');
  if ((!(signal instanceof AbortSignal)) || ((typeof assertParentCurrent) !== 'function')
    || ((typeof dispatchGroup) !== 'function') || ((typeof readGroup) !== 'function')) throw new DeclaredGroupCollectionError('Original parent cancellation and group consumer are required');
  /** Exact frozen reached view remains the later currentness comparison identity. */
  const view = readGroup(group);
  if ((!Object.isFrozen(view)) || (view.handle !== group) || (!Object.isFrozen(view.members))) throw new DeclaredGroupCollectionError('Canonical reached group view is required');
  /** Original source and member identities remain shared with the complete-group consumer. */
  const declaration = Object.freeze({ source: view.declaration.source, members: view.members });
  /** Collector-owned cancellation joins original parent and member cancellation after arrival. */
  const controller = new AbortController();
  /** Every original declared member begins without transport allocation or retained completion. */
  const records = declaration.members.map(function createMemberRecord(member): GroupCollectorRecord {
    return { member, handle: Object.freeze({}), arrival: 'unarrived', state: 'unarrived', ticket: undefined, signal: undefined, removeAbort: undefined, completion: undefined };
  });
  /** Failure history remains original and append-only under its occurrence owner. */
  const failures: GroupFailureOccurrence[] = [];
  /** Shared original state separates collection phase, transport return, and issued native work. */
  const groupState: GroupCollectorState = { checking: false, closed: false, dispatches: 0, phase: 'collecting', phaseAtReturn: undefined, primary: undefined, unboundPending: 0, work: Promise.resolve(), unboundOutcomes: Object.freeze([]) };
  /** Reject pending original delivery after publishing its terminal transport state.
   @param error - original retained failure or retirement reason
   @param state - original rejection or cancellation transport state
   */
  function rejectPending({ error, state }: Parameters<GroupRejectPending>[0]): void {
    /** Delivery rejection logs omit the original failure contents. */
    const pl = tagged({ tag: rejectPending.name, l: rl });
    pl.debug('rejecting original pending transport');
    for (const record of records) {
      if (isPending(record)) {
        record.state = state;
        record.ticket.reject(error);
      }
    }
  }
  /** Failure ownership is created before currentness can observe original cancellation. */
  const { recordFailure, abortOccurrence, retainBoundaryFailure } = createGroupFailures({ groupState, failures, controller, rejectPending });
  /** Currentness retains exact parent capabilities and canonical reached-view identity. */
  const { checkAbort, current, onParentAbort } = createGroupCurrent({ group, view, readGroup, signal, assertParentCurrent, groupState, records, recordFailure, abortOccurrence });
  /** Native observation remains independent from transport retirement. */
  const { detach, observeCompletion } = createGroupCompletions({ groupState, records, signal, onParentAbort });
  /** Complete original arrival is required before the native consumer receives a group. */
  const { startDispatch } = createGroupDispatch({ handle: group, declaration, records, groupState, current, dispatchGroup, recordFailure, retainBoundaryFailure, observeCompletion });
  /** Original callbacks publish delivery tickets before dispatch can begin. */
  const { invoke } = createGroupArrival({ signal, controller, records, groupState, current, checkAbort, onParentAbort, abortOccurrence, retainBoundaryFailure, rejectPending, startDispatch });
  signal.addEventListener('abort', onParentAbort, { once: true });
  if (signal.aborted) onParentAbort();
  /** Frozen native callbacks retain original declaration order and aliases. */
  const tools = Object.freeze(records.map(function createGroupTool(record): GroupCollectorTool {
    return Object.freeze({
      name: record.member.alias,
      execute(args, context) { return invoke({ record, args, nativeSignal: context.signal }); },
    });
  }));
  /** Transport lifetime observes original records while native work remains independently drainable. */
  const { retire, drain, inspect } = createGroupLifetime({ groupState, records, failures, controller, detach, recordFailure, rejectPending });
  return Object.freeze({ declaration, tools, retire, drain, inspect });
}
//endregion
