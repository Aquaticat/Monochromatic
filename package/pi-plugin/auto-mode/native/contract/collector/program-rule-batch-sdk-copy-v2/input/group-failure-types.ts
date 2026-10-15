/**
 Original group failure occurrences keep ordering separate from repeated delivery of the same failure. @module
 */
import type { RecordedGroupFailureError } from './group-failure-error.ts';

/**
 Original observed failure values retain an independent occurrence identity and ordinal.
 */
export type GroupFailureOccurrence = Readonly<{
  identity: object;
  ordinal: number;
  at: string;
  error: unknown;
}>;

/**
 Optional primary failure supplies the original explicit undefined state before any occurrence is retained.
 */
type GroupFailureSlots = Readonly<{ primary?: RecordedGroupFailureError }>;

/**
 Failure ownership shares retirement and phase publication with the original collector.
 */
export type GroupFailureState = {
  primary: GroupFailureSlots['primary'];
  readonly closed: boolean;
  phase: 'collecting' | 'dispatching' | 'settled' | 'failed';
};

/**
 Original error values and observation boundaries are retained without cloning or normalizing them.
 */
export type GroupFailureInput = Readonly<{
  error: unknown;
  at: string
}>;

/**
 Failure publication precedes pending delivery rejection and original group cancellation.
 */
export type GroupFailuresInput = Readonly<{
  groupState: GroupFailureState;
  failures: GroupFailureOccurrence[];
  controller: AbortController;
  rejectPending: (input: Readonly<{
    error: unknown;
    state: 'rejected'
  }>) => unknown;
}>;

/**
 Internal failure tokens remain distinct from newly thrown equal-valued occurrences.
 */
export type GroupFailures = Readonly<{
  recordFailure: (input: GroupFailureInput) => RecordedGroupFailureError;
  abortOccurrence: (input: Readonly<{
    observed: AbortSignal;
    at: string
  }>) => RecordedGroupFailureError;
  retainBoundaryFailure: (input: GroupFailureInput) => RecordedGroupFailureError;
}>;
