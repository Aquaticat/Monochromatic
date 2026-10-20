import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import { exchangeFailureLogText, } from '@monochromatic-dev/translation-repair-provider-stream/ts';
import {
  PROVIDER_ORDER,
  type ProviderName,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';
import type { ModelReach, } from './budget-routing.ts';
import {
  reachPastBoundHolds,
  type StreamBoundHolds,
} from './stream-bound-hold.ts';

//region Credential hold
// A PROVIDER WHOSE CREDENTIAL WAS REFUSED IS HELD OUT FOR THE REST OF THE RUN,
// for every model it serves. zheermao19 (2026-10-20): the Bedrock key expired,
// every Bedrock call answered HTTP 401, and the seat tally withheld
// `gemma-4-26b-a4b-it` after four failed asks though OpenRouter, wet all run,
// serves it. The key is the provider's, one key serves every model there, and a
// key does not renew during a run, so the hold is the provider's and has no
// end: unlike the stream bound hold (`stream-bound-hold.ts`), which is one
// pair's and lapses, nothing a run does makes an expired token valid again.
//
// A MODEL THAT NO OTHER PROVIDER SERVES reads unreachable without a call, as it
// does under any hold, and is the one case where a seat is withheld for it.

/**
 Providers whose credential was refused this run.

 @example
 ```ts
 const holds = createCredentialHolds();
 holds.hold({ provider: 'bedrock', },);
 ```
 */
export type CredentialHolds = {
  /**
   Holds a provider out for the rest of the run; true when this call began
   the hold, false when it was already in force, so the one call that learns
   a provider's credential is refused is the one that says so.
   */
  readonly hold: (args: { readonly provider: ProviderName; },) => boolean;

  /**
   Whether a provider is held out.
   */
  readonly isHeld: (args: { readonly provider: ProviderName; },) => boolean;
};

/**
 Builds the credential holds one router keeps.

 @returns Holds shared by every call the router makes

 @example
 ```ts
 const holds = createCredentialHolds();
 ```
 */
export function createCredentialHolds(): CredentialHolds {
  /**
   Providers held out.
   */
  const held = new Set<ProviderName>();
  return {
    hold: function hold({ provider, },): boolean {
      if (held.has(provider,))
        return false;
      held.add(provider,);
      return true;
    },
    isHeld: function isHeld({ provider, },): boolean {
      return held.has(provider,);
    },
  };
}

/**
 A model's reach with the providers whose credential was refused removed.
 */
export type ReachPastCredentialHolds = {
  /**
   Providers that serve the model and have their credential accepted so far.
   */
  readonly reach: ModelReach;

  /**
   Providers that serve the model and are held out for a refused credential,
   in provider order.
   */
  readonly refused: readonly ProviderName[];
};

/**
 Removes from a model's reach every provider whose credential was refused.

 @param reach - providers that serve the model

 @param holds - the router's credential holds

 @returns Reach past the holds, and the serving providers taken out

 @example
 ```ts
 const { reach, refused, } = reachPastCredentialHolds({ reach, holds, },);
 ```
 */
export function reachPastCredentialHolds(
  {
    reach,
    holds,
  }: {
    readonly reach: ModelReach;
    readonly holds: CredentialHolds;
  },
): ReachPastCredentialHolds {
  /**
   Whether one provider serves the model and has its credential accepted.

   @param provider - provider read

   @returns True where it may take the call
   */
  function open(provider: ProviderName,): boolean {
    return reach[provider] && (!holds.isHeld({ provider, },));
  }

  return {
    reach: {
      neuralwatt: open('neuralwatt',),
      synthetic: open('synthetic',),
      hyper: open('hyper',),
      bedrock: open('bedrock',),
      openrouter: open('openrouter',),
    },
    refused: PROVIDER_ORDER.filter(function servesAndRefused(provider,): boolean {
      return reach[provider] && holds.isHeld({ provider, },);
    },),
  };
}

/**
 The line said once per provider, when its credential is first refused.

 @param modelId - model whose call met the refusal

 @param provider - provider that refused its credential

 @param error - what the call threw, whose words the line quotes

 @param movesTo - providers still serving the model, in the order they are
 tried, none where the model is served nowhere else

 @returns The warn line

 @example
 ```ts
 rl.warn(credentialRefusalLine({ modelId, provider: 'bedrock', error, movesTo: ['hyper',], },),);
 ```
 */
export function credentialRefusalLine(
  {
    modelId,
    provider,
    error,
    movesTo,
  }: {
    readonly modelId: string;
    readonly provider: ProviderName;
    readonly error: unknown;
    readonly movesTo: readonly ProviderName[];
  },
): string {
  /**
   What becomes of the seat, said in the order it is tried.
   */
  const seat = (movesTo.length === 0)
    ? `No provider that serves ${modelId} is left, so the seat is withheld for the rest of the run.`
    : `${modelId} moves to ${movesTo.join(', then ',)}.`;
  return `SEAT CREDENTIAL REFUSED ${modelId} on ${provider}: ${exchangeFailureLogText({ error, },)}. `
    + `${provider} is held out for every model for the rest of the run, because one credential serves them all. `
    + `${seat} Renew ${provider}'s credential before the next run, or leave it.`;
}

/**
 Holds a provider out for a refused credential, saying so the first time.

 @param rl - logger the line goes to

 @param provider - provider that refused its credential

 @param modelId - model whose call met the refusal

 @param error - what the call threw

 @param reach - providers that serve the model, before any hold

 @param holds - the router's credential holds

 @param boundHolds - the router's stream bound holds, which also close a
 provider to the model the line names the seat's next provider from

 @example
 ```ts
 holdOnCredentialRefusal({ rl, provider, modelId, error, reach, holds, boundHolds, },);
 ```
 */
export function holdOnCredentialRefusal(
  {
    rl,
    provider,
    modelId,
    error,
    reach,
    holds,
    boundHolds,
  }: {
    readonly rl: Logger;
    readonly provider: ProviderName;
    readonly modelId: string;
    readonly error: unknown;
    readonly reach: ModelReach;
    readonly holds: CredentialHolds;
    readonly boundHolds: StreamBoundHolds;
  },
): void {
  if (!holds.hold({ provider, },))
    return;

  /**
   Providers serving the model that have their credential accepted.
   */
  const { reach: accepted, } = reachPastCredentialHolds({
    reach,
    holds,
  },);

  /**
   Providers still serving the model, the refused one taken out and the stream
   bound holds with it.
   */
  const { reach: remaining, } = reachPastBoundHolds({
    reach: accepted,
    modelId,
    holds: boundHolds,
  },);
  rl.warn(credentialRefusalLine({
    modelId,
    provider,
    error,
    movesTo: PROVIDER_ORDER.filter(function stillServes(candidate,): boolean {
      return remaining[candidate];
    },),
  },),);
}

//endregion Credential hold
