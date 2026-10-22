import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import { NoProviderForModelError, } from '@monochromatic-dev/translation-repair-markup/ts';
import {
  PROVIDER_ORDER,
  type ProviderName,
  type ProviderRecord,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';

//region Model dark reason
// WHY ONE MODEL HAS NO PROVIDER, in words a read of the run can tell from the run-ending stop. A model whose own
// providers are all out of budget while another provider reads wet is a lost seat (the router raises
// `NoProviderForModelError` for it); every provider out of budget at once is the stop that ends the run
// (`EveryProviderDryError`). The two read alike in a log unless the reason names which providers serve the model and
// how each reads, so this does.

/**
 Reading of one provider in the words the run-ending refusal's measured clause uses.

 @param provider - provider read

 @param dry - which providers read dry

 @returns The provider's name and `dry` or `wet`

 @example
 ```ts
 readingOf({ provider: 'hyper', dry, },); // => 'hyper dry'
 ```
 */
function readingOf(
  {
    provider,
    dry,
  }: {
    readonly provider: ProviderName;
    readonly dry: ProviderRecord<boolean>;
  },
): string {
  return `${provider} ${dry[provider] ? 'dry' : 'wet'}`;
}

/**
 The reason a model that no usable provider can take gives for it.

 @param reach - providers that serve the model at all

 @param dry - which providers have nothing buyable, budget reading and anything learned at the wire taken together

 @returns Either that no provider serves the model, or that every provider serving it is out of budget with how each
 provider reads, the ones serving the model first and then the ones that do not

 @example
 ```ts
 modelDarkReason({ reach, dry, },);
 // => 'every provider serving this model is out of budget (hyper dry); the providers that do not serve it read ...'
 ```
 */
export function modelDarkReason(
  {
    reach,
    dry,
  }: {
    readonly reach: ProviderRecord<boolean>;
    readonly dry: ProviderRecord<boolean>;
  },
): string {
  /**
   Providers that serve the model, in spending order.
   */
  const serving = PROVIDER_ORDER.filter(function serves(provider,): boolean {
    return reach[provider];
  },);
  if (serving.length === 0)
    return 'no provider serves this model';

  /**
   Providers that do not serve the model, in spending order.
   */
  const notServing = PROVIDER_ORDER.filter(function doesNotServe(provider,): boolean {
    return !reach[provider];
  },);
  /**
   The sentence about the providers serving the model.
   */
  const servingClause = `every provider serving this model is out of budget (${
    serving.map(function readingOfServing(provider,): string {
      return readingOf({
        provider,
        dry,
      },);
    },)
      .join(', ',)
  })`;
  if (notServing.length === 0)
    return servingClause;
  return `${servingClause}; the providers that do not serve it read ${
    notServing.map(function readingOfOther(provider,): string {
      return readingOf({
        provider,
        dry,
      },);
    },)
      .join(', ',)
  }`;
}

/**
 Refuses a call whose model has no usable provider, saying in the log which model went dark and how each provider read,
 so a read of the run can tell a lost seat from the stop that ends the run.

 @param modelId - model that has no usable provider

 @param reason - what {@link modelDarkReason} gave for it

 @param l - logger the line goes to

 @throws {@link NoProviderForModelError} always, which the stage layers read as one seat's lost voice

 @example
 ```ts
 refuseDarkModel({ modelId, reason: modelDarkReason({ reach, dry, },), l, },);
 ```
 */
export function refuseDarkModel(
  {
    modelId,
    reason,
    l,
  }: {
    readonly modelId: string;
    readonly reason: string;
    readonly l: Logger;
  },
): never {
  /**
   Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: refuseDarkModel.name,
    l,
  },);
  rl.warn(`${modelId} went dark: ${reason}`,);
  throw new NoProviderForModelError({
    modelId,
    reason,
  },);
}

//endregion Model dark reason
