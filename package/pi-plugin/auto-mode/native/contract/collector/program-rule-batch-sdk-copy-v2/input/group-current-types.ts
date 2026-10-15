/** Original collection currentness preserves failure precedence and cancellation observation. @module */
import type { GroupFailures, GroupFailureState } from './group-failure-types.ts';

/** Currentness observes retained completion presence without reading native result contents. */
type CurrentCompletion = Readonly<{ completion: unknown }>;
/** Caller-owned original view and callbacks determine collection currentness. */
export type GroupCurrentInput<View> = Readonly<{
  group: object;
  view: View;
  readGroup: (handle: object) => View;
  signal: AbortSignal;
  assertParentCurrent: () => unknown;
  groupState: Readonly<GroupFailureState>;
  records: readonly CurrentCompletion[];
  recordFailure: GroupFailures['recordFailure'];
  abortOccurrence: GroupFailures['abortOccurrence'];
}>;
/** Original cancellation checking throws only after the observed signal is cancelled. */
export type GroupCurrent = Readonly<{
  checkAbort: (input: Readonly<{ observed: AbortSignal; at: string }>) => void;
  current: () => void;
  onParentAbort: () => void;
}>;
