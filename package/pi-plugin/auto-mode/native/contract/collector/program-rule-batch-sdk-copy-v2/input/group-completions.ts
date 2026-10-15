/**
 Original native results remain inspectable after transport closes or cancellation fires. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type {
  GroupCompletionRecord,
  GroupCompletionInput,
  GroupCompletions
} from './group-completion-types.ts';

/**
 Completion logs describe lifetime transitions without serializing original results.
 */
const l = tagged({ tag: 'auto-mode-group-completions' });

//region Completion retention precedes delivery and cleanup observes every issued native result.
/**
 Observe every issued completion even after transport delivery closes.

 @param groupState - original group retirement and failure state

 @param records - original mutable member observations in declaration order

 @param signal - original parent cancellation whose listener belongs to this collector

 @param onParentAbort - exact parent listener installed by the original collector

 @returns original listener detachment and issued-result observation operations

 @example createGroupCompletions({ groupState, records, signal, onParentAbort });
 */
export function createGroupCompletions<const Outcome>({
  groupState,
  records,
  signal,
  onParentAbort,
}: GroupCompletionInput<Outcome>): GroupCompletions<Outcome> {
  /**
   Captured original state remains shared with the collector's cancellation owner.
   */
  const rl = tagged({
    tag: createGroupCompletions.name,
    l
  });
  rl.debug('binding original native completion observer');
  /**
   Detach original parent and member listeners in declaration order.
   */
  function detach(): void {
    /**
     Cleanup logs retain the original owner boundary without reading results.
     */
    const dl = tagged({
      tag: detach.name,
      l: rl
    });
    dl.debug('detaching original completion listeners');
    signal.removeEventListener(
      'abort',
      onParentAbort
    );
    for (const record of records) {
      record.removeAbort?.();
      record.removeAbort = undefined;
    }
  }
  /**
   Publish settled delivery only after all original outcomes have been retained.
   */
  function completed(): void {
    /**
     Completion counting observes only the presence of retained outcomes.
     */
    const cl = tagged({
      tag: completed.name,
      l: rl
    });
    if (records.every(function isCompleteRecord(record: Readonly<GroupCompletionRecord<Outcome>>) {
      return record.completion !== undefined;
    })) {
      detach();
      if ((!groupState.primary) && (!groupState.closed)) groupState.phase = 'settled';
      cl.debug('all original native outcomes retained');
    }
  }
  /**
   Retain one original fulfillment or rejection before delivering any pending transport ticket.

   @param record - dispatched original member with its already allocated delivery ticket

   @param completion - original issued native completion or immediate outcome

   */
  async function observeCompletion({
    record,
    completion
  }: Parameters<GroupCompletions<Outcome>['observeCompletion']>[0]): Promise<void> {
    /**
     Observation logs omit the original native value and failure contents.
     */
    const ol = tagged({
      tag: observeCompletion.name,
      l: rl
    });
    ol.debug('observing original issued completion');
    /**
     Original completion cleanup runs after either delivery outcome or callback failure.
     */
    using completionScope = {
      [Symbol.dispose](): void {
        record.removeAbort?.();
        record.removeAbort = undefined;
        completed();
      },
    };
    try {
      /**
       Original await preserves immediate values and thenable settlement.
       */
      const value = await completion;
      record.completion = Object.freeze({
        status: 'fulfilled',
        value
      });
      if (record.state === 'pending') {
        record.state = 'fulfilled';
        record.ticket
          .resolve(value);
      }
      ol.debug('retained original fulfilled completion');
    } catch (error) {
      record.completion = Object.freeze({
        status: 'rejected',
        reason: error
      });
      if (record.state === 'pending') {
        record.state = 'rejected';
        record.ticket
          .reject(error);
      }
      ol.debug('retained original rejected completion');
    }
  }
  return {
    detach,
    observeCompletion
  };
}
//endregion
