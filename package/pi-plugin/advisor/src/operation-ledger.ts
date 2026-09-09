/** Operation-owned attempt snapshots; progress and final accounting share this source. @module */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { AdvisorAttemptRecord, AdvisorCollectedReview, AdvisorOperationEnd, AdvisorOperationSnapshot, } from './operation-types.ts';
import { aggregateAdvisorUsage, } from './operation-usage.ts';

/** Ledger logger root. */
const l = tagged({ tag: 'advisor/operation-ledger', },);

//region Ledger

/**
 Own immutable published records while retaining mutable operation-local indexing.
 @example
 ```ts
 const ledger = new AdvisorOperationLedger({ startedAtMs: 0, deadlineAtMs: 1000 });
 ```
 */
export class AdvisorOperationLedger {
  /** Attempts indexed by local identity. */
  readonly #attempts = new Map<number, AdvisorAttemptRecord>();
  /** Usable reviews indexed by the successful attempt. */
  readonly #reviews = new Map<number, AdvisorCollectedReview>();
  /** Provider exclusions discovered by this operation only. */
  readonly #blocked = new Set<string>();
  /** Absolute operation timing. */
  readonly #timing: { readonly startedAtMs: number; readonly deadlineAtMs: number; };
  /** Single post-success collection boundary. */
  #collectionEndsAtMs?: number;
  /** Local terminal state, also sealing late provider callbacks. */
  #end?: AdvisorOperationEnd;

  /**
   Create an empty operation ledger.
   @param timing - original operation boundaries
   @example
   ```ts
   new AdvisorOperationLedger({ startedAtMs: 0, deadlineAtMs: 1000 });
   ```
   */
  constructor(timing: { readonly startedAtMs: number; readonly deadlineAtMs: number; },) {
    this.#timing = timing;
  }

  /**
   Insert or replace an attempt snapshot while this operation remains open.
   @param record - detached attempt metadata
   @example
   ```ts
   ledger.record(attempt);
   ```
   */
  record(record: AdvisorAttemptRecord,): void {
    if (this.#end !== undefined)
      return;
    this.#attempts.set(record.id, record,);
  }

  /**
   Return the latest recorded attempt, rejecting inconsistent identities.
   @param id - operation-local attempt identity
   @returns current immutable record
   @throws when no such attempt was started
   @example
   ```ts
   const attempt = ledger.attempt(1);
   ```
   */
  attempt(id: number,): AdvisorAttemptRecord {
    /** Latest attempt snapshot. */
    const record = this.#attempts.get(id,);
    if (record === undefined)
      throw new Error(`advisor: unknown attempt ${String(id,)}`,);
    return record;
  }

  /**
   Retain a review and establish the collection boundary only once.
   @param review - original usable text and identity
   @param collectionEndsAtMs - proposed first-success cutoff
   @example
   ```ts
   ledger.collect({ review, collectionEndsAtMs: 1000 });
   ```
   */
  collect({ review, collectionEndsAtMs, }: {
    readonly review: AdvisorCollectedReview;
    readonly collectionEndsAtMs: number;
  },): void {
    if (this.#end !== undefined)
      return;
    this.#reviews.set(review.attemptId, review,);
    this.#collectionEndsAtMs ??= Math.min(collectionEndsAtMs, this.#timing.deadlineAtMs,);
  }

  /**
   Exclude a provider after observed credit exhaustion.
   @param provider - registered provider identity
   @example
   ```ts
   ledger.blockProvider('fixture-provider');
   ```
   */
  blockProvider(provider: string,): void {
    if (this.#end !== undefined)
      return;
    tagged({ tag: 'blockProvider', l, },).debug(`excluding provider for this operation: ${provider}`,);
    this.#blocked.add(provider,);
  }

  /**
   Seal records and finalize locally cancelled pending attempts.
   @param end - local reason scheduling and collection ended
   @param now - cutoff timestamp
   @example
   ```ts
   ledger.finish({ end: 'collection', now: 1000 });
   ```
   */
  finish({ end, now, }: { readonly end: AdvisorOperationEnd; readonly now: number; },): void {
    if (this.#end !== undefined)
      return;
    for (const record of this.#attempts.values()) {
      if (record.state === 'running' || record.state === 'preparing') {
        this.#attempts.set(record.id, {
          ...record, state: 'cancelled', endedAtMs: now,
          diagnostic: `${end}: cancellation requested; remote settlement not confirmed`, usageIncomplete: true,
        },);
      }
    }
    this.#end = end;
  }

  /**
   Publish detached containers with latest usage counted exactly once per attempt.
   @returns operation snapshot safe to retain across later callbacks
   @example
   ```ts
   const progress = ledger.snapshot();
   ```
   */
  snapshot(): AdvisorOperationSnapshot {
    /** Stable attempt order inherited from insertion. */
    const attempts = [...this.#attempts.values(),];
    return {
      ...this.#timing,
      ...(this.#collectionEndsAtMs === undefined ? {} : { collectionEndsAtMs: this.#collectionEndsAtMs, }),
      attempts,
      reviews: [...this.#reviews.values(),].toSorted(function byAttempt(left, right,): number {
        return left.attemptId - right.attemptId;
      },),
      blockedProviders: [...this.#blocked,],
      usage: aggregateAdvisorUsage(attempts.flatMap(function available(record,): readonly NonNullable<AdvisorAttemptRecord['usage']>[] {
        return record.usage === undefined ? [] : [record.usage,];
      },),),
      usageIncomplete: attempts.some(function incomplete(record,): boolean { return record.usageIncomplete; },),
      ...(this.#end === undefined ? {} : { end: this.#end, }),
    };
  }
}

//endregion Ledger
