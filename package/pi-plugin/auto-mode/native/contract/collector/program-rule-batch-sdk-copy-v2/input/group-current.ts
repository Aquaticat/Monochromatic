/**
 Original collector eligibility checks retain callback ordering and cancellation provenance. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { DeclaredGroupCollectionError } from './group-collection-error.ts';
import type {
  GroupCurrent,
  GroupCurrentInput
} from './group-current-types.ts';

/**
 Currentness logs omit original input, failure, and native result contents.
 */
const l = tagged({ tag: 'auto-mode-group-current' });

//region Currentness checks preserve first-failure precedence before and after original callbacks.
/** Bind the original collector currentness checks without adding eligibility conditions.
 @param group - original reached-group handle
 
 @param view - original reached-group view identity
 
 @param readGroup - original current reached-group reader
 
 @param signal - original parent cancellation signal
 
 @param assertParentCurrent - original enclosing execution currentness callback
 
 @param groupState - original retained failure and transport phase
 
 @param records - original completion presence in declaration order
 
 @param recordFailure - original newly observed failure retention
 
 @param abortOccurrence - original cancellation occurrence reuse
 
 @returns original cancellation, currentness, and parent-listener operations
 
 @example createGroupCurrent({ group, view, readGroup, signal, assertParentCurrent, groupState, records, recordFailure, abortOccurrence });
 */
export function createGroupCurrent<const View>({
  group,
  view,
  readGroup,
  signal,
  assertParentCurrent,
  groupState,
  records,
  recordFailure,
  abortOccurrence,
}: GroupCurrentInput<View>): GroupCurrent {
  /**
   Currentness callbacks share original failure publication with collector lifetime operations.
   */
  const rl = tagged({
    tag: createGroupCurrent.name,
    l
  });
  rl.debug('binding original collector currentness');
  /** Retain and throw the original cancellation occurrence only after signal cancellation.
   @param observed - original parent or member cancellation source
   
   @param at - original observation boundary retained by the failure owner
   
   @throws RecordedGroupFailureError when original cancellation has occurred
   */
  function checkAbort({
    observed,
    at
  }: Parameters<GroupCurrent['checkAbort']>[0]): void {
    /**
     Signal checks do not inspect or normalize the original cancellation reason.
     */
    const al = tagged({
      tag: checkAbort.name,
      l: rl
    });
    if (observed.aborted) {
      al.debug('retaining original cancelled collection boundary');
      throw abortOccurrence({
        observed,
        at
      });
    }
    al.debug('original collection signal remains active');
  }
  /** Re-read original failure and closure after callbacks can publish new transport state.
   @throws RecordedGroupFailureError when the original primary failure is retained
   
   @throws DeclaredGroupCollectionError when original transport has returned
   */
  function requireOpenTransport(): void {
    /**
     Separate calls re-read mutable state without retaining pre-callback type narrowing.
     */
    const tl = tagged({
      tag: requireOpenTransport.name,
      l: rl
    });
    tl.debug('checking original failure and transport closure');
    if (groupState.primary) throw groupState.primary;
    if (groupState.closed) throw new DeclaredGroupCollectionError('Declared parent group has returned');
  }
  /** Check original retained failure, retirement, cancellation, and current view in their original order.
   @throws RecordedGroupFailureError when an original failure or cancellation has been retained
   
   @throws DeclaredGroupCollectionError when original transport has already returned
   */
  function current(): void {
    /**
     Every currentness invocation retains the same original callback and view identities.
     */
    const cl = tagged({
      tag: current.name,
      l: rl
    });
    cl.debug('checking original collector currentness');
    requireOpenTransport();
    checkAbort({
      observed: signal,
      at: 'original-cancellation'
    });
    try {
      assertParentCurrent();
      if (readGroup(group) !== view) throw new DeclaredGroupCollectionError('Reached group view changed during native collection');
    } catch (error) {
      throw recordFailure({
        error,
        at: 'parent-current-reader'
      });
    }
    checkAbort({
      observed: signal,
      at: 'original-cancellation'
    });
    requireOpenTransport();
    cl.debug('original collector remains current');
  }
  /**
   Observe parent cancellation only while original transport still has unfinished native results.
   */
  function onParentAbort(): void {
    /**
     Listener invocation retains original completed, failed, and retired group distinctions.
     */
    const pl = tagged({
      tag: onParentAbort.name,
      l: rl
    });
    if (groupState.closed || (groupState.phase === 'settled')
      || records.every(function hasCompletion(record) { return record.completion !== undefined; })) {
      pl.debug('original parent cancellation has no remaining transport observation');
      return;
    }
    abortOccurrence({
      observed: signal,
      at: 'original-cancellation'
    });
    pl.debug('retained original parent cancellation occurrence');
  }
  return {
    checkAbort,
    current,
    onParentAbort
  };
}
//endregion
