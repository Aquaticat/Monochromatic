import { NaturalnessCompletenessError, } from '../naturalness-completeness-error.ts';
import { ContributorCompletenessError, } from './contributor-completeness.ts';
import { FrontMatterCompletenessError, } from './front-matter-completeness.ts';
import { NaturalnessRepairInterruptedError, } from '../naturalness-repair-interrupted-error.ts';
import { PromptPayloadStoreError, } from '../prompt-payload-store.ts';
import { UnfilledPageError, } from './publish-completeness.ts';
import { TranslationRepairInterruptedError, } from '../translation-repair-interrupted-error.ts';
import { VisualEvidenceInterruptedError, } from './visual-evidence-completeness.ts';
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
  const stopped = (error instanceof ContributorCompletenessError)
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

//endregion Entry failure scheduling
