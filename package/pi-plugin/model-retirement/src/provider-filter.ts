/**
 Translation from a live registry read into per-provider re-registration plans.

 pi replaces a provider's whole model list when an extension registers one with
 `models`, so a plan must carry every model the provider keeps, of every model type,
 plus whatever the incumbent owner of that provider configured.
 `ModelRegistry.getAll()` reports chat models only, which is why image and classifier
 models are read separately and passed through untouched.

 @module
 */

import type {
  ProviderConfig,
  ProviderModelConfig,
} from '@earendil-works/pi-coding-agent';
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
import {
  REGISTERABLE,
  planGap,
  toModelConfig
} from './registration-gap.ts';

//region Types

/**
 Incumbent extension configuration for one provider.

 Modelled as a discriminant rather than an optional value because pi returns
 `undefined` both for a builtin provider and for a provider another extension
 registered as a native object, and those two cases demand opposite decisions.
 */
export type IncumbentConfig = {
  /**
   Whether pi returned a configuration for this provider.
   */
  readonly kind: 'present' | 'absent';
  /**
   Configuration pi returned, present only when the kind is `present`.
   */
  readonly config?: ForeignBorrowed<ProviderConfig>;
};

/**
 Registry reads this extension needs, injected so tests can fake them.

 Every model is marked {@link ForeignBorrowed} because model objects are owned by pi's
 registry: this package reads them and spreads them into configurations, and never
 mutates them.
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
  /**
   Providers another extension registered, in pi's own order.
   */
  readonly readRegisteredProviderIds: () => readonly string[];
  /**
   Incumbent configuration one extension registered for a provider.
   */
  readonly readProviderConfig: (provider: string,) => IncumbentConfig;
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
   Configuration to register: the incumbent's, with its model list replaced.
   */
  readonly config: ProviderConfig;
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
  /**
   Providers the rule retired models for but that cannot be re-registered safely, so
   their models stay visible.
   */
  readonly skippedProviders: readonly SkippedProvider[];
};

/**
 One provider this pass could not filter.
 */
export type SkippedProvider = {
  /**
   Provider left untouched.
   */
  readonly provider: string;
  /**
   What stopped the re-registration, naming the offending model or owner.
   */
  readonly reason: string;
};

//endregion Types

//region Planning

/**
 Plan every provider re-registration a catalog needs.

 A provider only earns a plan when the rule retires one of its models, and a family's
 keeper is never retired, so a plan always carries at least the keeper.

 Two ownership rules keep the pass from breaking providers it does not own. A provider
 another extension registered as a native object has no readable configuration, so
 re-registering it would replace that extension's streaming, auth, and image handlers
 with a plain catalog list; those providers are skipped. A provider with a readable
 configuration is re-registered with that configuration spread underneath the filtered
 model list, which preserves `api`, `baseUrl`, `apiKey`, `headers`, `oauth`, and
 `streamSimple`.

 @param read - injected registry reads

 @returns plans, every retirement, the abstention tally, and the skipped providers

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
   Providers another extension registered.
   */
  const registeredIds = read.readRegisteredProviderIds();
  /**
   Plans in first-seen provider order.
   */
  const plans: ProviderFilterPlan[] = [];
  /**
   Providers whose models cannot be re-declared safely.
   */
  const skippedProviders: SkippedProvider[] = [];
  for (const [provider, retired,] of retiredByProvider) {
    /**
     Incumbent configuration for this provider, when pi exposes one.
     */
    const incumbent = read.readProviderConfig(provider,);
    if ((incumbent.kind === 'absent') && registeredIds.includes(provider,)) {
      skippedProviders.push({
        provider,
        reason: 'another extension registered it as a native provider and pi exposes no configuration to preserve, so re-registering would replace its streaming and auth',
      },);
      continue;
    }
    /**
     Configuration the filtered model list is layered onto.
     */
    const base: ProviderConfig = incumbent.kind === 'present'
      ? incumbent.config ?? {}
      : {};
    /**
     Chat models this provider still serves.
     */
    const keptChat = chatModels.filter(function isKept(model,) {
      return (model.provider === provider)
        && (!retired.has(`${model.api}\u0000${model.id}`,));
    },);
    /**
     Every model the re-registration must carry, of all three types.
     */
    const models: ProviderModelConfig[] = [
      ...keptChat.map(function toChatConfig(model,) {
        return toModelConfig(model,);
      },),
      ...read.readImageModels(provider,)
        .map(function toImageConfig(model,) {
          return toModelConfig(model,);
        },),
      ...read.readClassifierModels(provider,)
        .map(function toClassifierConfig(model,) {
          return toModelConfig(model,);
        },),
    ];
    /**
     First reason this provider cannot be re-registered, when there is one.
     */
    const gap = planGap({
      models,
      base,
    },);
    if (gap !== REGISTERABLE) {
      skippedProviders.push({
        provider,
        reason: gap,
      },);
      continue;
    }
    plans.push({
      provider,
      config: {
        ...base,
        models,
      },
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
    skippedProviders,
  };
}

//endregion Planning
