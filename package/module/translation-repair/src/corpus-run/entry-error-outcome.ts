import { NaturalnessCompletenessError, } from '../naturalness-completeness-error.ts';
import { NaturalnessRepairInterruptedError, } from '../naturalness-repair-interrupted-error.ts';
import { PromptPayloadStoreError, } from '../prompt-payload-store.ts';
import type { EntryOutcome, } from './pass-entry-contract.ts';

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
 * Keeps naturalness work and duplicate-evidence guards out of whole-entry retry.
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
   * Whether error names stage-local incomplete naturalness work.
   */
  const stopped = (error instanceof NaturalnessRepairInterruptedError)
    || (error instanceof NaturalnessCompletenessError)
    || (error instanceof PromptPayloadStoreError);
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

//endregion Entry failure scheduling
