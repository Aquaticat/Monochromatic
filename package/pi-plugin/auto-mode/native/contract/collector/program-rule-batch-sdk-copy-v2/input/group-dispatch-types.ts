/**
 Original dispatch binds complete arrivals and retains every returned native outcome. @module
 */
import type {
  DispatchedCompletionRecord,
  GroupCompletions
} from './group-completion-types.ts';
import type {
  GroupFailures,
  GroupFailureState
} from './group-failure-types.ts';

/**
 Original arrival slots exist before delivery tickets and cancellation are allocated.
 */
type DispatchSlots = Readonly<{
  ticket?: DispatchedCompletionRecord<unknown>['ticket'];
  signal?: AbortSignal;
}>;
/**
 Arrival publication follows ticket allocation in the original member collector.
 */
export type GroupDispatchRecord<Member> = Omit<DispatchedCompletionRecord<unknown>, 'ticket'> & {
  readonly member: Member;
  readonly handle: object;
  readonly arrival: string;
  readonly ticket: DispatchSlots['ticket'];
  readonly signal: DispatchSlots['signal'];
};
/**
 Consumer input freezes association containers while retaining original member identities.
 */
export type GroupDispatchCall<Declaration, Member> = Readonly<{
  handle: object;
  declaration: Declaration;
  members: readonly Readonly<{
    handle: object;
    declaration: Member;
    signal: DispatchSlots['signal'];
  }>[];
}>;
/**
 Unassociated results preserve original enumerable array keys and opaque outcomes.
 */
export type UnboundGroupOutcome = Readonly<{
  retainedOnly: true;
  sourceKey: string;
}> & Readonly<PromiseSettledResult<unknown>>;
/**
 Original dispatch shares failure, retirement, work publication, and retained outcomes.
 */
export type GroupDispatchState = GroupFailureState & {
  dispatches: number;
  work: Promise<void>;
  unboundPending: number;
  unboundOutcomes: readonly UnboundGroupOutcome[];
};
/**
 Dispatch callbacks retain ownership of original eligibility and native outcome observation.
 */
export type GroupDispatchInput<Declaration, Member> = Readonly<{
  handle: object;
  declaration: Declaration;
  records: readonly GroupDispatchRecord<Member>[];
  groupState: GroupDispatchState;
  current: () => void;
  dispatchGroup: (input: GroupDispatchCall<Declaration, Member>) => unknown;
  recordFailure: GroupFailures['recordFailure'];
  retainBoundaryFailure: GroupFailures['retainBoundaryFailure'];
  observeCompletion: GroupCompletions<unknown>['observeCompletion'];
}>;
/**
 Starting dispatch publishes drainable work before original callbacks run.
 */
export type GroupDispatch = Readonly<{ startDispatch: () => void }>;
