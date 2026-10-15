/**
 Original completion observation separates transport delivery from retained native outcomes. @module
 */

/**
 Optional values supply explicit undefined slots in the original mutable record.
 */
type CompletionSlots<Outcome> = Readonly<{
  removeAbort?: () => void;
  completion?: Readonly<PromiseSettledResult<Outcome>>;
}>;

/**
 Every original member may retain an abort listener and its eventual native completion.
 */
export type GroupCompletionRecord<Outcome> = {
  removeAbort: CompletionSlots<Outcome>['removeAbort'];
  completion: CompletionSlots<Outcome>['completion'];
};

/**
 Complete dispatch has allocated every ticket before beginning outcome observation.
 */
export type DispatchedCompletionRecord<Outcome> = GroupCompletionRecord<Outcome> & {
  state: 'unarrived' | 'pending' | 'fulfilled' | 'rejected' | 'cancelled';
  readonly ticket: Pick<PromiseWithResolvers<Outcome>, 'resolve' | 'reject'>;
};

/**
 Settled phase is published only when no original failure or retirement has closed delivery.
 */
export type GroupCompletionInput<Outcome> = Readonly<{
  groupState: {
    readonly primary?: object | undefined;
    readonly closed: boolean;
    phase: 'collecting' | 'dispatching' | 'settled' | 'failed';
  };
  records: readonly GroupCompletionRecord<Outcome>[];
  signal: AbortSignal;
  onParentAbort: () => void;
}>;

/**
 Retained outcome observation continues after callers stop receiving transport results.
 */
export type GroupCompletions<Outcome> = Readonly<{
  detach: () => void;
  observeCompletion: (input: Readonly<{
    record: DispatchedCompletionRecord<Outcome>;
    completion: Outcome | PromiseLike<Outcome>;
  }>) => Promise<void>;
}>;
