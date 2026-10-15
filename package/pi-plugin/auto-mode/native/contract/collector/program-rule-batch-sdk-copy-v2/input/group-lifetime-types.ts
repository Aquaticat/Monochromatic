/**
 Collector transport retirement remains separate from issued native execution lifetime. @module
 */
import type {
  GroupFailures,
  GroupFailureOccurrence,
  GroupFailureState
} from './group-failure-types.ts';
import type { GroupCompletionRecord } from './group-completion-types.ts';

/**
 Original inspection observes member arrival and transport delivery without inferring effects.
 */
export type GroupLifetimeRecord<Outcome> = GroupCompletionRecord<Outcome> & {
  readonly member: Readonly<{ ordinal: number }>;
  readonly arrival: string;
  readonly state: string;
};
/**
 Explicit undefined phase exists until the first successful transport retirement.
 */
type GroupLifetimeSlots = Readonly<{ phaseAtReturn?: GroupFailureState['phase'] }>;
/**
 Mutable retirement state shares original failure publication and dispatched work.
 */
export type GroupLifetimeState = Omit<GroupFailureState, 'closed'> & {
  closed: boolean;
  phaseAtReturn: GroupLifetimeSlots['phaseAtReturn'];
  readonly work: PromiseLike<unknown>;
  readonly dispatches: number;
  readonly unboundPending: number;
  readonly unboundOutcomes: readonly unknown[];
};
/**
 Inspection freezes new snapshots while retaining original values and outcomes by identity.
 */
export type GroupLifetimeInspection<Outcome> = Readonly<{
  phase: GroupFailureState['phase'] | 'closed';
  phaseAtReturn: GroupLifetimeSlots['phaseAtReturn'];
  failed: boolean;
  failure: unknown;
  failures: readonly GroupFailureOccurrence[];
  dispatches: number;
  unboundPending: number;
  unboundOutcomes: readonly unknown[];
  members: readonly Readonly<{
    ordinal: number;
    arrival: string;
    state: string;
    completion: GroupLifetimeRecord<Outcome>['completion'];
  }>[];
  executionState: 'owned-by-native-consumer-not-inferred';
  effectQualification: 'not-established';
}>;
/**
 Lifetime operations use original failure recording, pending delivery, and listener detachment.
 */
export type GroupLifetimeInput<Outcome> = Readonly<{
  groupState: GroupLifetimeState;
  records: readonly GroupLifetimeRecord<Outcome>[];
  failures: readonly GroupFailureOccurrence[];
  controller: AbortController;
  detach: () => void;
  recordFailure: GroupFailures['recordFailure'];
  rejectPending: (input: Readonly<{
    error: unknown;
    state: 'cancelled'
  }>) => unknown;
}>;
/**
 Transport retirement never claims to cancel already issued native execution.
 */
export type GroupLifetime<Outcome> = Readonly<{
  retire: () => void;
  drain: () => Promise<void>;
  inspect: () => GroupLifetimeInspection<Outcome>;
}>;
