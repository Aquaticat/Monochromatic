/** Original native arrival associates exact source arguments before dispatch. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { DeclaredGroupCollectionError } from './group-collection-error.ts';
import type { GroupArrival, GroupArrivalInput, GroupCollectorRecord } from './group-collector-types.ts';

/** Arrival logs describe native transport boundaries without original argument contents. */
const l = tagged({ tag: 'auto-mode-group-arrival' });

//region Native callbacks retain original reentry, exact argument matching, and cancellation order.
/** Bind original member arrival to its existing currentness and transport owners.
 @param signal - original parent cancellation source
 @param controller - original collector cancellation source
 @param records - complete original declared members
 @param groupState - original collection, failure, and retirement publication
 @param current - original parent and reached-view currentness check
 @param checkAbort - original cancellation check before arrival publication
 @param onParentAbort - original parent cancellation listener
 @param abortOccurrence - original member cancellation occurrence owner
 @param retainBoundaryFailure - original boundary failure retention
 @param rejectPending - original pending transport rejection
 @param startDispatch - original complete-group dispatch starter
 @returns original member callback operation
 @example createGroupArrival({ signal, controller, records, groupState, current, checkAbort, onParentAbort, abortOccurrence, retainBoundaryFailure, rejectPending, startDispatch });
 */
export function createGroupArrival({
  signal, controller, records, groupState, current, checkAbort, onParentAbort,
  abortOccurrence, retainBoundaryFailure, rejectPending, startDispatch,
}: GroupArrivalInput): GroupArrival {
  /** Arrival shares original retained transport state with dispatch and lifetime operations. */
  const rl = tagged({ tag: createGroupArrival.name, l });
  rl.debug('binding original native member arrival');
  /** Associate exact original native arguments and publish delivery before group dispatch.
   @param record - original source member selected by its native tool callback
   @param args - original native arguments compared with the declared source serialization
   @param nativeSignal - original native cancellation input admitted before ticket allocation
   @returns original delivered native result
   @throws DeclaredGroupCollectionError when original callback admission fails
   */
  async function invoke({ record, args, nativeSignal }: Parameters<GroupArrival['invoke']>[0]): Promise<unknown> {
    /** Member boundary logs omit original source arguments and native result contents. */
    const il = tagged({ tag: invoke.name, l: rl });
    il.debug('checking original native arrival');
    /** Invocation-local ticket distinguishes pre-publication failure from pending delivery failure. */
    const invocation: { ticket: GroupCollectorRecord['ticket'] } = { ticket: undefined };
    try {
      if (groupState.checking) throw new DeclaredGroupCollectionError('Declared group collection cannot reenter through callbacks');
      groupState.checking = true;
      {
        /** Original cleanup releases reentry protection on every guarded collection exit. */
        using collection = { [Symbol.dispose](): void { groupState.checking = false; } };
        current();
        if ((groupState.phase !== 'collecting') || (record.arrival !== 'unarrived')) throw new DeclaredGroupCollectionError('Declared member callback cannot be replayed');
        if (!(nativeSignal instanceof AbortSignal)) throw new DeclaredGroupCollectionError('Native member cancellation is required');
        if (JSON.stringify(args) !== record.member.argsJSON) throw new DeclaredGroupCollectionError('Native member arguments differ from the declared callsite');
        checkAbort({ observed: nativeSignal, at: 'native-cancellation' });
        current();
        invocation.ticket = Promise.withResolvers<unknown>();
        record.ticket = invocation.ticket;
        record.arrival = 'matched';
        record.state = 'pending';
        record.signal = AbortSignal.any([signal, nativeSignal, controller.signal]);
        /** Preserve native cancellation after arrival unless transport or retained completion has ended observation. */
        function onNativeAbort(): void {
          /** Original callback re-reads mutable transport and native completion presence. */
          const al = tagged({ tag: onNativeAbort.name, l: il });
          if (groupState.closed || (groupState.phase === 'settled') || (record.completion !== undefined)) {
            al.debug('native cancellation observation has ended');
            return;
          }
          abortOccurrence({ observed: nativeSignal, at: 'native-cancellation' });
          al.debug('retained original native cancellation');
        }
        nativeSignal.addEventListener('abort', onNativeAbort, { once: true });
        record.removeAbort = function removeNativeAbort(): void {
          nativeSignal.removeEventListener('abort', onNativeAbort);
        };
        // Abort events do not replay when a constituent was aborted by the final parent-reader callback.
        if (nativeSignal.aborted) onNativeAbort();
        if (signal.aborted) onParentAbort();
      }
      if ((!groupState.primary) && (!groupState.closed)
        && records.every(function hasArrivedMember(value) { return value.arrival === 'matched'; })) startDispatch();
      il.debug('published original member arrival');
    } catch (error) {
      /** Original failure occurrence is retained before deciding whether transport was allocated. */
      const recorded = retainBoundaryFailure({ error, at: 'member-entry' });
      if (!invocation.ticket) throw recorded.occurrence.error;
      rejectPending({ error: recorded.occurrence.error, state: 'rejected' });
      il.debug('rejected original pending member delivery');
    }
    return await nonNullishOrThrow(invocation.ticket).promise;
  }
  return { invoke };
}
//endregion
