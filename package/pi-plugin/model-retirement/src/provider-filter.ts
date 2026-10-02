/**
 Translation from a live registry read into per-provider re-registration plans.

 pi replaces a provider's whole model list when an extension registers one with
 `models`, so a plan must carry every model the provider keeps, of every model type.
 `ModelRegistry.getAll()` reports chat models only, which is why image and classifier
 models are read separately and passed through untouched.

 @module
 */

import type { ProviderModelConfig, } from '@earendil-works/pi-coding-agent';
import type {
  AnyModel,
  Api,
  ClassifierApi,
  ClassifierModel,
  ImageApi,
  ImageModel,
  Model,
} from '@earendil-works/pi-ai';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  decideRetirements,
  type AbstentionCounts,
  type CatalogEntry,
  type Retirement,
} from './retirement-rule.ts';

//region Types

/**
 Registry reads this extension needs, injected so tests can fake them.

 Every element is marked {@link ForeignBorrowed} because model objects are owned by
 pi's registry: this package reads them and spreads them into configurations, and
 never mutates them.
 */
export type CatalogRead = {
  /**
   Chat models the registry knows, in registry order.
   */
  readonly readChatModels: () => readonly ForeignBorrowed<Model<Api>>[];
  /**
   Image models one provider serves.
   */
  readonly readImageModels: (
    provider: string,
  ) => readonly ForeignBorrowed<ImageModel<ImageApi>>[];
  /**
   Classifier models one provider serves.
   */
  readonly readClassifierModels: (
    provider: string,
  ) => readonly ForeignBorrowed<ClassifierModel<ClassifierApi>>[];
};

/**
 One provider's re-registration plan.
 */
export type ProviderFilterPlan = {
  /**
   Provider whose model list pi will replace.
   */
  readonly provider: string;
  /**
   Every model the provider keeps, of all three types, in registry order.
   */
  readonly models: readonly ProviderModelConfig[];
  /**
   Retirements that made this plan necessary.
   */
  readonly retirements: readonly Retirement[];
};

/**
 Outcome of planning across a whole catalog.
 */
export type FilterPlanning = {
  /**
   Plans for providers that lose at least one model.
   */
  readonly plans: readonly ProviderFilterPlan[];
  /**
   Every retirement the rule decided, including providers with no plan.
   */
  readonly retirements: readonly Retirement[];
  /**
   Declined retirements grouped by reason, so a log can say what the rule saw and
   refused to order.
   */
  readonly abstentions: AbstentionCounts;
};

//endregion Types

//region Model configuration

/**
 Express one live model as a provider-model configuration.

 The spread carries every field pi's composer accepts, which is what preserves
 `thinkingLevelMap`, `promptCache`, `compat`, `samplingParams`, and `inputLimits`
 across a re-registration. Per-model `headers` do not survive: pi's
 `extensionModelFromDefinition` sets them to `undefined` for all three types.

 The discriminant is read off the model itself rather than through an alias, because
 only a direct `model.type` comparison narrows pi's `AnyModel` union.

 @param model - live model object read from the registry, owned by pi

 @returns configuration pi accepts inside `ProviderConfig.models`

 @example
 ```typescript
 toModelConfig(chatModel); // { ...chatModel, type: 'chat' }
 ```
 */
export function toModelConfig(model: ForeignBorrowed<AnyModel>,): ProviderModelConfig {
  if (model.type === 'image')
    return {
      ...model,
      type: 'image',
    };
  if (model.type === 'classifier')
    return {
      ...model,
      type: 'classifier',
    };
  return {
    ...model,
    type: 'chat',
  };
}

//endregion Model configuration

//region Planning

/**
 Plan every provider re-registration a catalog needs.

 A provider only earns a plan when the rule retires one of its models, and a family's
 keeper is never retired, so a plan always carries at least the keeper. That is what
 makes a separate empty-provider guard unnecessary: a provider whose models have not
 been read yet produces no retirements and therefore no registration.

 @param read - injected registry reads

 @returns plans, every retirement, and the abstention tally

 @example
 ```typescript
 planProviderFilters({ read: catalogRead });
 ```
 */
export function planProviderFilters(
  {
    read,
  }: {
    readonly read: CatalogRead;
  },
): FilterPlanning {
  /**
   Chat models in registry order.
   */
  const chatModels = read.readChatModels();
  /**
   Rule input built from the chat catalog, which is the only type pi versions by id.
   */
  const entries: CatalogEntry[] = chatModels.map(function toEntry(model,) {
    return {
      provider: model.provider,
      api: model.api,
      modelId: model.id,
    };
  },);
  /**
   Rule outcome for the whole chat catalog.
   */
  const decision = decideRetirements({ entries, },);
  /**
   Retired identities per provider, so a kept model can be recognised in one lookup.
   */
  const retiredByProvider = new Map<string, Set<string>>();
  for (const retirement of decision.retirements) {
    /**
     Identities retired on this provider so far.
     */
    const retired = retiredByProvider.get(retirement.provider,) ?? new Set<string>();
    retired.add(`${retirement.api}\u0000${retirement.retiredId}`,);
    retiredByProvider.set(
      retirement.provider,
      retired,
    );
  }
  /**
   Plans in first-seen provider order.
   */
  const plans: ProviderFilterPlan[] = [];
  for (const [provider, retired,] of retiredByProvider) {
    /**
     Chat models this provider still serves.
     */
    const keptChat = chatModels.filter(function isKept(model,) {
      return (model.provider === provider)
        && (!retired.has(`${model.api}\u0000${model.id}`,));
    },);
    /**
     Image models this provider serves, which the rule never retires.
     */
    const imageModels = read.readImageModels(provider,);
    /**
     Classifier models this provider serves, which the rule never retires.
     */
    const classifierModels = read.readClassifierModels(provider,);
    /**
     Every model the re-registration must carry.
     */
    const models: ProviderModelConfig[] = [
      ...keptChat.map(toModelConfig,),
      ...imageModels.map(toModelConfig,),
      ...classifierModels.map(toModelConfig,),
    ];
    plans.push({
      provider,
      models,
      retirements: decision.retirements
        .filter(function onProvider(retirement,) {
        return retirement.provider === provider;
      },),
    },);
  }
  return {
    plans,
    retirements: decision.retirements,
    abstentions: decision.abstentions,
  };
}

//endregion Planning
