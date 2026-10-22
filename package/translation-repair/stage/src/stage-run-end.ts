import { EveryProviderDryError, } from '@monochromatic-dev/translation-repair-provider/ts';

//region Stage run end
// THE ONE QUESTION "DOES THIS FAILURE END THE RUN?", asked by every layer that would otherwise turn a failed call into
// a lost voice (`attemptStageCall`, `attemptDecisionCall`, `askOnce` in `runGatherRound`) and by the entry scheduler
// that files a caught failure (`entryErrorOutcome`). The owner ruled that `EveryProviderDryError` "ENDS THE RUN":
// every other budget state leaves something buyable, and this one leaves nothing, so no seat's voice can be heard
// either. XingZ6018 (2026-10-22) lost it as one seat's voice in every round for 77 s, until the bench floor stopped
// the run mid-entry. The scheduler reaches this through the stage package because it holds no runtime dependency on
// the provider package of its own.

/**
 Whether a failed call's error ends the run instead of costing one seat its voice.

 @param error - what the call raised

 @returns Whether the router found every provider out of budget

 @example
 ```ts
 if (endsTheRun({ error, },))
   throw error;
 ```
 */
export function endsTheRun({ error, }: { readonly error: unknown; },): boolean {
  return error instanceof EveryProviderDryError;
}

//endregion Stage run end
