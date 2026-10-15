/** Original complete-group dispatch retains outcomes independently of transport lifetime. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { DeclaredGroupCollectionError } from './group-collection-error.ts';
import type { DispatchedCompletionRecord } from './group-completion-types.ts';
import type { GroupDispatch, GroupDispatchInput, GroupDispatchRecord } from './group-dispatch-types.ts';

/** Dispatch logs omit original member inputs and opaque native outcomes. */
const l = tagged({ tag: 'auto-mode-group-dispatch' });

//region Original arrival publication proves ticket allocation without adding eligibility checks.
/** Read the original arrival discriminant whose publication follows ticket allocation.
 @param record - original collector-owned member record
 @returns whether original arrival has published its already allocated delivery ticket
 */
function hasArrived<const Member>(record: GroupDispatchRecord<Member>): record is GroupDispatchRecord<Member> & DispatchedCompletionRecord<unknown> {
  return record.arrival === 'matched';
}
//endregion

//region Dispatch publishes drainable work before callbacks and retains every issued native completion.
/** Bind original complete-group dispatch without granting preparation or execution permission.
 @param handle - original reached-group identity
 @param declaration - original frozen source and member association
 @param records - original mutable collector records in declaration order
 @param groupState - original dispatch, failure, and retirement publication
 @param current - original enclosing currentness check
 @param dispatchGroup - original complete-group native consumer
 @param recordFailure - original new failure occurrence owner
 @param retainBoundaryFailure - original retained failure propagation
 @param observeCompletion - original native outcome retention and transport delivery
 @returns original drainable dispatch starter
 @example createGroupDispatch({ handle, declaration, records, groupState, current, dispatchGroup, recordFailure, retainBoundaryFailure, observeCompletion });
 */
export function createGroupDispatch<const Declaration, const Member>({
  handle, declaration, records, groupState, current, dispatchGroup,
  recordFailure, retainBoundaryFailure, observeCompletion,
}: GroupDispatchInput<Declaration, Member>): GroupDispatch {
  /** Dispatch shares original state with failure and lifetime owners. */
  const rl = tagged({ tag: createGroupDispatch.name, l });
  rl.debug('binding original complete-group dispatch');
  /** Observe original completions even after transport closure or association failure. */
  async function dispatch(): Promise<void> {
    /** Dispatch observations do not inspect original native result contents. */
    const dl = tagged({ tag: dispatch.name, l: rl });
    dl.debug('checking complete original group arrival');
    try {
      current();
      if (!records.every(hasArrived)) throw new DeclaredGroupCollectionError('Declared member set is incomplete');
      groupState.phase = 'dispatching';
      groupState.dispatches++;
      /** Frozen association containers retain original member and signal identities. */
      const members = Object.freeze(records.map(function createDispatchMember(record) {
        return Object.freeze({ handle: record.handle, declaration: record.member, signal: record.signal });
      }));
      /** Native consumer output remains opaque until its original array association check. */
      let completions: unknown = undefined;
      try {
        completions = await dispatchGroup(Object.freeze({ handle, declaration, members }));
      } catch (error) {
        throw recordFailure({ error, at: 'group-consumer' });
      }
      if ((!Array.isArray(completions)) || (completions.length !== records.length)
        || records.some(function isMissingCompletion(_record, index) { 
          return !Object.hasOwn(completions, index); 
        })) {
        /** Association failure is published before unassociated returned work is awaited. */
        const failure = recordFailure({
          error: new DeclaredGroupCollectionError('Complete group consumer returned a different member set'),
          at: 'group-dispatch',
        });
        if (Array.isArray(completions)) {
          /** Array admission preserves opaque entries, including enumerable non-index properties. */
          const returned: readonly unknown[] = completions;
          /** Enumeration skips holes while retaining every returned enumerable completion. */
          const entries = Object.entries(returned);
          groupState.unboundPending = entries.length;
          /** All issued unassociated work remains drainable after failure closes delivery. */
          const settled = await Promise.allSettled(entries.map(function readUnboundCompletion([, completion]) { 
            return completion; 
          }));
          groupState.unboundOutcomes = Object.freeze(settled.map(function retainUnboundOutcome(outcome, index) {
            return Object.freeze({ retainedOnly: true as const, sourceKey: nonNullishOrThrow(entries[index])[0], ...outcome });
          }));
          groupState.unboundPending = 0;
          dl.debug('retained all unassociated original completions');
        }
        throw failure;
      }
      /** Complete original array association does not constrain native result values. */
      const associated: readonly unknown[] = completions;
      /** Every admitted original member begins observation before tail currentness is checked. */
      const settlements = records.map(function observeMemberCompletion(record, index) {
        return observeCompletion({ record, completion: associated[index] });
      });
      // Returned parents cannot receive more transport results. Observe already-issued completions regardless.
      if (!groupState.closed) {
        try { 
          current(); 
        }
        catch (error) { 
          retainBoundaryFailure({ error, at: 'group-consumer-tail' }); 
        }
      }
      await Promise.allSettled(settlements);
      dl.debug('observed complete original member settlements');
    } catch (error) {
      retainBoundaryFailure({ error, at: 'group-dispatch' });
      dl.debug('retained original dispatch boundary failure');
    }
  }
  /** Publish original drainable work before synchronous currentness or consumer callbacks. */
  function startDispatch(): void {
    /** Work ownership precedes all callback reentry into lifetime inspection and draining. */
    const sl = tagged({ tag: startDispatch.name, l: rl });
    /** Original cleanup resolves this exact published work promise on every completion route. */
    const completion = Promise.withResolvers<void>();
    groupState.work = completion.promise;
    sl.debug('published original dispatch work');
    /** Resolve original work after ordinary dispatch or its boundary retention failure. */
    async function run(): Promise<void> {
      /** Cleanup preserves original drain completion even when dispatch boundary retention throws. */
      using dispatchCompletion = { [Symbol.dispose](): void { 
        completion.resolve(); 
      } };
      try { 
        await dispatch(); 
      }
      catch (error) { 
        retainBoundaryFailure({ error, at: 'dispatcher-completion' }); 
      }
    }
    void run();
  }
  return { startDispatch };
}
//endregion
