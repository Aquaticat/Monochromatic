/** Observe one provider dispatch without allowing late results to reopen a sealed operation. @module */
import type { AssistantMessage, Usage, } from '@earendil-works/pi-ai';
import type { ReadonlyDeep, } from 'type-fest';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { AdvisorOperationLedger, } from './operation-ledger.ts';
import type { AdvisorCandidateIdentity, } from './operation-candidates.ts';
import { assertAdvisorProviderAvailable, isAdvisorCreditExhaustion, } from './provider-credit.ts';
import { copyAdvisorUsage, } from './operation-usage.ts';

/** Model-specific evidence metrics retained for every attempt. */
export type AdvisorOperationCandidate = AdvisorCandidateIdentity & {
  /** Serialized evidence characters. */
  readonly contextChars: number;
  /** Model-specific input estimate. */
  readonly estimatedInputTokens: number;
  /** Whether this endpoint received reduced evidence. */
  readonly truncated: boolean;
};

/** Provider invocation boundary, including streaming observations. */
export type AdvisorDispatch = (options: {
  /** Candidate selected from this operation's eligible pool. */
  readonly candidate: AdvisorOperationCandidate;
  /** Shared operation-owned cancellation signal. */
  readonly signal: ForeignHostCapability<AbortSignal>;
  /** Called synchronously immediately before actual provider invocation. */
  readonly onDispatch: (metadata: { readonly reasoning?: string; }) => void;
  /** Latest available detached usage counters. */
  readonly onUsage: (usage: ReadonlyDeep<Usage>) => void;
}) => Promise<AssistantMessage>;

/** Scheduler notification for a settled attempt. */
export type AdvisorAttemptCompletion = {
  /** Operation-local identity. */
  readonly id: number;
  /** Whether bounded same-model no-text recovery is possible. */
  readonly empty: boolean;
};

/**
 Execute and record one attempt, preserving provider failures as scheduler outcomes.
 @param options - operation-owned capabilities and cutoff policy
 @returns settled-attempt identity and no-text recovery eligibility
 @mutates options - invokes provider, ledger, and progress capabilities
 @example
 ```ts
 const completion = await observeAdvisorAttempt({ id, candidate, ledger, complete, signal, now, graceMs, notify });
 ```
 */
export async function observeAdvisorAttempt(options: ForeignHostCapability<{
  readonly id: number;
  readonly candidate: AdvisorOperationCandidate;
  readonly ledger: AdvisorOperationLedger;
  readonly complete: AdvisorDispatch;
  readonly signal: ForeignHostCapability<AbortSignal>;
  readonly now: () => number;
  readonly graceMs: number;
  readonly notify: () => void;
}>,): Promise<AdvisorAttemptCompletion> {
  /** Operation-local services. */
  const { id, candidate, ledger, complete, signal, now, graceMs, notify, } = options;
  try {
    /** Terminal response; the scheduler races this work against local cutoffs. */
    const response = await complete({
      candidate,
      signal,
      onDispatch(metadata): void {
        /** Re-read exclusions after asynchronous authentication or scope preparation. */
        const current = ledger.snapshot();
        signal.throwIfAborted();
        if (now() >= current.deadlineAtMs || current.reviews.length > 0)
          throw new Error('advisor: scheduling ended before provider dispatch',);
        assertAdvisorProviderAvailable({ provider: candidate.provider, blockedProviders: current.blockedProviders, },);
        ledger.record({ ...ledger.attempt(id,), ...metadata, state: 'running', dispatchedAtMs: now(), },);
        notify();
      },
      onUsage(usage): void {
        ledger.record({ ...ledger.attempt(id,), usage: copyAdvisorUsage(usage,), usageIncomplete: true, },);
      },
    },);
    /** Current cutoff state may have changed while the provider was pending. */
    const current = ledger.snapshot();
    if (current.end !== undefined || signal.aborted || now() >= (current.collectionEndsAtMs ?? current.deadlineAtMs))
      return { id, empty: false, };
    /** Successful terminal states, never partial, deferred, tool-use, or aborted text. */
    const successful = response.stopReason === 'stop' || response.stopReason === 'length';
    /** Original visible text, retained only after operational validation. */
    const text = response.content.filter(block => block.type === 'text').map(block => block.text).join('\n',);
    /** Empty text is recoverable only for successful terminal responses. */
    const empty = successful && text.trim() === '';
    /** Diagnostic remains distinct from successful review content. */
    const diagnostic = response.errorMessage ?? `stopReason=${response.stopReason}`;
    ledger.record({
      ...ledger.attempt(id,), endedAtMs: now(), stopReason: response.stopReason,
      state: successful ? empty ? 'empty' : 'succeeded' : 'failed',
      usage: copyAdvisorUsage(response.usage,), usageIncomplete: !successful,
      ...(successful ? empty ? { diagnostic: 'successful response contained no visible text', } : {} : { diagnostic, }),
    },);
    if (response.stopReason === 'error' && isAdvisorCreditExhaustion(diagnostic,))
      ledger.blockProvider(candidate.provider,);
    if (successful && !empty) {
      ledger.collect({
        review: { attemptId: id, model: candidate.model, text, lengthLimited: response.stopReason === 'length', },
        collectionEndsAtMs: now() + graceMs,
      },);
    }
    notify();
    return { id, empty, };
  }
  catch (error) {
    /** Retain a readable failure while keeping thrown provider objects out of session state. */
    const diagnostic = caughtValueText(error,);
    if (ledger.snapshot().end === undefined) {
      ledger.record({ ...ledger.attempt(id,), state: 'failed', endedAtMs: now(), diagnostic, },);
      if (isAdvisorCreditExhaustion(diagnostic,))
        ledger.blockProvider(candidate.provider,);
      notify();
    }
    return { id, empty: false, };
  }
}
