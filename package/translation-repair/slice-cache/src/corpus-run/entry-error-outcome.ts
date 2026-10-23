import {
  NaturalnessCompletenessError,
  NaturalnessRepairInterruptedError,
} from '@monochromatic-dev/translation-repair-adjudication/ts';
import {
  ArchiveOriginalCompletenessError,
  DroppedDestinationError,
  FrontMatterCompletenessError,
  PublishedPageDisagreesError,
  UnansweredContestSliceError,
  UnparseablePageError,
} from '@monochromatic-dev/translation-repair-page-check/ts';
import {
  CollapsedHeadingError,
  ContributorCompletenessError,
  SliceSpliceError,
} from '@monochromatic-dev/translation-repair-page-pass/ts';
import {
  endsTheRun,
  isDryRefusal,
  PromptPayloadStoreError,
} from '@monochromatic-dev/translation-repair-stage/ts';
import { WritingBenchUnreachableError, } from '@monochromatic-dev/translation-repair-run/ts';
import { TranslationRepairInterruptedError, } from '@monochromatic-dev/translation-repair-translate-stage/ts';
import { VisualEvidenceInterruptedError, } from './visual-evidence-completeness.ts';
import type { EntryOutcome, } from './pass-entry-contract.ts';
import { tallyErrorText, } from './tally-error-text.ts';

//region Entry failure scheduling

/**
 Tally status and scheduler outcome for one caught entry error.

 @example
 ```ts
 const classified = entryErrorOutcome({ error, });
 ```
 */
export type EntryErrorOutcome = {
  /**
   Operational tally state.
   */
  readonly status: 'ERROR' | 'INCOMPLETE';

  /**
   Whether whole-entry scheduler may resume cached progress.
   */
  readonly outcome: Exclude<EntryOutcome, { readonly kind: 'settled'; }>;
};

/**
 Keeps stage-local quality work and completeness invariants out of whole-entry retry.

 @param error - caught entry failure

 @returns Tally status and scheduler disposition

 @example
 ```ts
 const classified = entryErrorOutcome({ error: new Error('transport'), });
 ```
 */
export function entryErrorOutcome(
  { error, }: { readonly error: unknown; },
): EntryErrorOutcome {
  /**
   Whether error names stage-local incomplete or invariant work.
   */
  const stopped = (error instanceof ArchiveOriginalCompletenessError)
    || (error instanceof ContributorCompletenessError)
    || (error instanceof DroppedDestinationError)
    // The owner's rule: every provider dry ends the run. A whole-entry retry meets the same dry router.
    || endsTheRun({ error, },)
    || (error instanceof FrontMatterCompletenessError)
    || (error instanceof NaturalnessRepairInterruptedError)
    || (error instanceof NaturalnessCompletenessError)
    || (error instanceof PromptPayloadStoreError)
    || (error instanceof TranslationRepairInterruptedError)
    || (error instanceof VisualEvidenceInterruptedError)
    // Ledger A7: deterministic refusals of the assembled page or the artifact,
    // which a retry resuming the same cached slices reproduces exactly.
    || (error instanceof CollapsedHeadingError)
    || (error instanceof UnparseablePageError)
    || (error instanceof PublishedPageDisagreesError)
    || (error instanceof UnansweredContestSliceError)
    || (error instanceof SliceSpliceError);
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
 Whether a failure is a writing bench error that carries NeuralWatt's return, which the pass may park for.

 @param error - what the entry raised

 @returns Whether the error names a return

 @example
 ```ts
 if (carriesNeuralWattReturn({ error, },))
   endRun?.({ error, },);
 ```
 */
function carriesNeuralWattReturn({ error, }: { readonly error: unknown; },): boolean {
  return (error instanceof WritingBenchUnreachableError) && (error.neuralwattReturnsInMs !== undefined);
}

/**
 The fields stating the NeuralWatt return a failure names, none where it names none.

 @param error - what the entry raised

 @returns Leading-space fields: the distance, and the time of day where the failure carries one

 @example
 ```ts
 const fields = returnFieldsOf({ error, },);
 ```
 */
function returnFieldsOf({ error, }: { readonly error: unknown; },): string {
  if ((!(error instanceof WritingBenchUnreachableError)) && (!isDryRefusal(error,)))
    return '';
  if (error.neuralwattReturnsInMs === undefined)
    return '';
  return ` returnsInMs=${String(error.neuralwattReturnsInMs,)}${
    (error.neuralwattReturnsAt === undefined) ? '' : ` returnsAt=${error.neuralwattReturnsAt}`
  }`;
}

/**
 Prints the TALLY line for an entry that raised out of its pipeline, and
 returns the scheduler's disposition for it.

 THE STATUSES THIS LINE PRINTS, one per class of failure (a settled entry prints `SETTLED` and a declined one
 `DECLINED`, from their own lines):
 `ERROR` for a failure a whole-entry retry may resume, `INCOMPLETE` for stage-local work or a run-ending refusal that
 no retry would change, and `PARKED` for an entry the pass put back at the front of its queue to wait for NeuralWatt's
 energy to return, which earns no verdict and is attempted again after the wait. A `PARKED` line states the distance
 and the time of day of the return in `returnsInMs=` and `returnsAt=` fields before the reason, so the cap on the
 reason's text never cuts them; `error=` is the failure that named the return.

 @param entryId - entry that failed

 @param error - what it raised

 @param durationMs - time before it failed, on `monotonicMs`

 @param aborted - whether the entry's signal had aborted when it failed: the hard-ceiling abort fired, or the dry
 router stopped the run (the TALLY line prints it as `aborted=`)

 @param endRun - told of the failure when it ends the run or carries a NeuralWatt return the pass may park for, before
 the entry is filed, so the pass stops starting entries (or parks) however the failure reached the entry: a guarded call
 carries it by the shared abort, the seat reading and a layer that re-raises it reach here without one

 @param parked - asked after `endRun` has been told, naming this entry's failure: true when the pass is parked for
 that failure, so the entry goes back to the front of its queue and the line prints `PARKED` and not the status the
 failure would have had; never true for a failure that is not the park's own

 @returns Scheduling disposition, never a settlement

 @example
 ```ts
 return tallyCaughtEntry({ entryId: entry.id, error, durationMs, aborted, },);
 ```
 */
export function tallyCaughtEntry(
  {
    entryId,
    error,
    durationMs,
    aborted,
    endRun,
    parked,
  }: {
    readonly entryId: string;
    readonly error: unknown;
    readonly durationMs: number;
    readonly aborted: boolean;
    readonly endRun?: (args: { readonly error: unknown; },) => void;
    readonly parked?: (args: { readonly error: unknown; },) => boolean;
  },
): EntryErrorOutcome['outcome'] {
  /**
   Failure text for the TALLY line, named or quoted per its class and capped.
   */
  const message = tallyErrorText({ error, },);
  /**
   Tally and retry classification for caught state.
   */
  const classified = entryErrorOutcome({ error, },);
  // A bench error that carries NeuralWatt's return is handed over as well, for the pass to park on; the pass leaves
  // it alone when it cannot wait for the return, and the entry is filed as any bench error is.
  if (endsTheRun({ error, },) || carriesNeuralWattReturn({ error, },))
    endRun?.({ error, },);
  // THE FINDINGS REACH THE LOG, one line each, since the tally line carries the
  // reason alone and the sixth yuki418330012 pass of 2026-09-09 stopped twice
  // as carried-evidence-lost with nothing in the log saying which region.
  if (error instanceof TranslationRepairInterruptedError) {
    for (const finding of error.findings)
      console.log(`INTERRUPTED ${entryId}: ${finding}`,);
  }
  /**
   Whether the pass is parked for this failure and will attempt the entry again.
   */
  const parkedForThis = parked?.({ error, },) === true;
  /**
   Status the line prints: the entry's own, or `PARKED`.
   */
  const status = parkedForThis ? 'PARKED' : classified.status;
  /**
   The return a parked entry waits for, stated before the reason so the cap on the reason never cuts it.
   */
  const returnFields = parkedForThis ? returnFieldsOf({ error, },) : '';
  console.log(
    `TALLY ${entryId} status=${status}${returnFields} ms=${String(durationMs,)} aborted=${String(aborted,)} `
      + `error=${message}`,
  );
  return classified.outcome;
}

//endregion Entry failure scheduling
