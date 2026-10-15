/**
 Original collector construction and arrival retain native transport ownership. @module
 */
import type {
  GroupCompletionRecord,
  DispatchedCompletionRecord
} from './group-completion-types.ts';
import type { GroupCurrent } from './group-current-types.ts';
import type {
  GroupDispatch,
  GroupDispatchCall,
  GroupDispatchState
} from './group-dispatch-types.ts';
import type { GroupFailures } from './group-failure-types.ts';
import type {
  GroupLifetime,
  GroupLifetimeState
} from './group-lifetime-types.ts';
import type {
  ReachedProgramSite,
  ReachedProgramView
} from './program-declaration-types.ts';

/**
 Original collector slots exist before matching native arrival allocates transport.
 */
type CollectorSlots = Readonly<{
  ticket?: PromiseWithResolvers<unknown>;
  signal?: AbortSignal;
}>;
/**
 Native arrival mutates only the original transport and retained-outcome record.
 */
export type GroupCollectorRecord = GroupCompletionRecord<unknown> & {
  readonly member: ReachedProgramSite;
  readonly handle: object;
  arrival: 'unarrived' | 'matched';
  state: DispatchedCompletionRecord<unknown>['state'];
  ticket: CollectorSlots['ticket'];
  signal: CollectorSlots['signal'];
};
/**
 Original callback reentry protection shares native dispatch and transport retirement state.
 */
export type GroupCollectorState = Omit<GroupDispatchState, 'closed'> & {
  checking: boolean;
  closed: boolean;
  phaseAtReturn: GroupLifetimeState['phaseAtReturn'];
};
/**
 Collection declarations retain exact original reached members and source text.
 */
export type GroupCollectorDeclaration = Readonly<{
  source: string;
  members: readonly ReachedProgramSite[];
}>;
/**
 Pending rejection changes transport state before forwarding the original failure value.
 */
export type GroupRejectPending = (input: Readonly<{
  error: unknown;
  state: 'rejected' | 'cancelled';
}>) => void;
/**
 Original native collector construction retains its parent and complete-group consumer.
 */
export type GroupCollectorInput = Readonly<{
  group: object;
  readGroup: (group: object) => ReachedProgramView;
  signal: AbortSignal;
  assertParentCurrent: () => unknown;
  dispatchGroup: (input: GroupDispatchCall<GroupCollectorDeclaration, ReachedProgramSite>) => unknown;
}>;
/**
 Native callbacks supply cancellation independently of their opaque original arguments.
 */
export type GroupCollectorTool = Readonly<{
  name: string;
  execute: (
    args: unknown,
    context: Readonly<{ signal: unknown }>
  ) => Promise<unknown>;
}>;
/**
 Original run retains transport observations without inferring native execution effects.
 */
export type GroupCollector = GroupLifetime<unknown> & Readonly<{
  declaration: GroupCollectorDeclaration;
  tools: readonly GroupCollectorTool[];
}>;
/**
 Arrival depends on original failure, currentness, and dispatch owners without replacing them.
 */
export type GroupArrivalInput = GroupCurrent & GroupDispatch & Pick<GroupFailures, 'abortOccurrence' | 'retainBoundaryFailure'> & Readonly<{
  signal: AbortSignal;
  controller: AbortController;
  records: readonly GroupCollectorRecord[];
  groupState: GroupCollectorState;
  rejectPending: GroupRejectPending;
}>;
/**
 Each original tool callback associates exactly one declared source member.
 */
export type GroupArrival = Readonly<{ invoke: (input: Readonly<{
  record: GroupCollectorRecord;
  args: unknown;
  nativeSignal: unknown;
}>) => Promise<unknown> }>;
