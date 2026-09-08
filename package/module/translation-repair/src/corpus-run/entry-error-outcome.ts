import { ConsolidationStandingIneligibleError, } from '../consolidate-ineligible-standing.ts';
import { NaturalnessCompletenessError, } from '../naturalness-completeness-error.ts';
import { ArchiveOriginalCompletenessError, } from './archive-original-completeness.ts';
import { ContributorCompletenessError, } from './contributor-completeness.ts';
import { DroppedDestinationError, } from './destination-completeness.ts';
import { FrontMatterCompletenessError, } from './front-matter-completeness.ts';
import { NaturalnessRepairInterruptedError, } from '../naturalness-repair-interrupted-error.ts';
import { PromptPayloadStoreError, } from '../prompt-payload-store.ts';
import { UnfilledPageError, } from './publish-completeness.ts';
import { TranslationRepairInterruptedError, } from '../translation-repair-interrupted-error.ts';
import { VisualEvidenceInterruptedError, } from './visual-evidence-completeness.ts';
import type { EntryOutcome, } from './pass-entry-contract.ts';
import { tallyErrorText, } from './tally-error-text.ts';

//region Entry failure scheduling

/**
 * Tally status and scheduler outcome for one caught entry error.
 *
 * @example
 * ```ts
 * const classified = entryErrorOutcome({ error, });
 * ```
 */
export type EntryErrorOutcome = {
  /**
   * Operational tally state.
   */
  readonly status: 'ERROR' | 'INCOMPLETE';

  /**
   * Whether whole-entry scheduler may resume cached progress.
   */
  readonly outcome: Exclude<EntryOutcome, { readonly kind: 'settled'; }>;
};

/**
 * Keeps stage-local quality work and completeness invariants out of whole-entry retry.
 *
 * @param error - caught entry failure
 *
 * @returns Tally status and scheduler disposition
 *
 * @example
 * ```ts
 * const classified = entryErrorOutcome({ error: new Error('transport'), });
 * ```
 */
export function entryErrorOutcome(
  { error, }: { readonly error: unknown; },
): EntryErrorOutcome {
  /**
   * Whether error names stage-local incomplete or invariant work.
   */
  const stopped = (error instanceof ConsolidationStandingIneligibleError)
    || (error instanceof ArchiveOriginalCompletenessError)
    || (error instanceof ContributorCompletenessError)
    || (error instanceof DroppedDestinationError)
    || (error instanceof FrontMatterCompletenessError)
    || (error instanceof NaturalnessRepairInterruptedError)
    || (error instanceof NaturalnessCompletenessError)
    || (error instanceof PromptPayloadStoreError)
    || (error instanceof TranslationRepairInterruptedError)
    || (error instanceof UnfilledPageError)
    || (error instanceof VisualEvidenceInterruptedError);
  return stopped
    ? {
      status: 'INCOMPLETE',
      outcome: { kind: 'stopped', },
    }
    : {
      status: 'ERROR',
      outcome: { kind: 'resumable-failure', },
    };
}

/**
 * Prints the TALLY line for an entry that raised out of its pipeline, and
 * returns the scheduler's disposition for it.
 *
 * @param entryId - entry that failed
 *
 * @param error - what it raised
 *
 * @param durationMs - wall time before it failed
 *
 * @param aborted - whether the hard-ceiling abort fired
 *
 * @returns Scheduling disposition, never a settlement
 *
 * @example
 * ```ts
 * return tallyCaughtEntry({ entryId: entry.id, error, durationMs, aborted, },);
 * ```
 */
export function tallyCaughtEntry(
  {
    entryId,
    error,
    durationMs,
    aborted,
  }: {
    readonly entryId: string;
    readonly error: unknown;
    readonly durationMs: number;
    readonly aborted: boolean;
  },
): EntryErrorOutcome['outcome'] {
  /**
   * Failure text for the TALLY line, named or quoted per its class and capped.
   */
  const message = tallyErrorText({ error, },);
  /**
   * Tally and retry classification for caught state.
   */
  const classified = entryErrorOutcome({ error, },);
  console.log(
    `TALLY ${entryId} status=${classified.status} ms=${String(durationMs,)} aborted=${String(aborted,)} error=${message}`,
  );
  return classified.outcome;
}

//endregion Entry failure scheduling
