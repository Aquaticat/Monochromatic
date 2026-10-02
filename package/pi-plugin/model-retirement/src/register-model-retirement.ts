/**
 Registration of the retirement pass against pi's session lifecycle.

 The host probe in `doc/planning/pi-model-retirement.md` settled where this can run:
 an extension factory has no catalog read at all, and `session_start` is the earliest
 event carrying `ctx.modelRegistry`. Everything here therefore happens in that
 handler, which is after startup model resolution and after `pi --list-models` has
 already exited.

 @module
 */

import type {
  ExtensionAPI,
  ProviderConfig,
  SessionStartEvent,
} from '@earendil-works/pi-coding-agent';
import type {
  Api,
  ClassifierApi,
  ClassifierModel,
  ImageApi,
  ImageModel,
  Model,
} from '@earendil-works/pi-ai';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  planProviderFilters,
  type CatalogRead,
  type IncumbentConfig,
  type SkippedProvider,
} from './provider-filter.ts';
import type { Retirement, } from './retirement-rule.ts';
import {
  formatFailedProvider,
  formatLiveModelWarning,
  formatPlanningSummary,
  formatRefreshFailure,
  formatRetirementLine,
  formatSkippedProvider,
} from './retirement-report.ts';

//region Types

/**
 Logger surface this extension writes to.

 Structural rather than imported so a test can fake it without a sink, while the
 default stays a tagged logger from `@monochromatic-dev/module-logger`.
 */
export type RetirementLog = {
  /**
   Report one retirement pass summary.
   */
  readonly info: (message: string,) => void;
  /**
   Report one retirement line.
   */
  readonly debug: (message: string,) => void;
  /**
   Report a session running on a retired model.
   */
  readonly warn: (message: string,) => void;
};

/**
 Chat-model read side of pi's registry.
 */
export type ChatModelReader = {
  /**
   Every chat model the registry knows, in registry order.
   */
  readonly getAll: () => readonly Model<Api>[];
};

/**
 Image-model read side of pi's registry.
 */
export type ImageModelReader = {
  /**
   Image models, optionally narrowed to one provider.
   */
  readonly getModelsOfType: (
    type: 'image',
    provider?: string,
  ) => readonly ImageModel<ImageApi>[];
};

/**
 Classifier-model read side of pi's registry.
 */
export type ClassifierModelReader = {
  /**
   Classifier models, optionally narrowed to one provider.
   */
  readonly getModelsOfType: (
    type: 'classifier',
    provider?: string,
  ) => readonly ClassifierModel<ClassifierApi>[];
};

/**
 Provider-id read side of pi's registry.
 */
export type ProviderIdReader = {
  /**
   Providers another extension registered.
   */
  readonly getRegisteredProviderIds: () => readonly string[];
};

/**
 Provider-config read side of pi's registry.

 Typed as returning `unknown` because pi returns `undefined` for a provider it holds no
 extension configuration for, and this package models absence with a discriminant rather
 than a nullish union.
 */
export type ProviderConfigReader = {
  /**
   Configuration one extension registered for a provider, when there is one.
   */
  readonly getRegisteredProviderConfig: (name: string,) => unknown;
};

/**
 Provider re-registration side of pi's extension API.
 */
export type ProviderRegistrar = {
  /**
   Replace one provider's model list.
   */
  readonly registerProvider: (options: {
    readonly name: string;
    readonly config: ProviderConfig;
  }) => void;
};

/**
 Catalog refresh side of pi's registry.

 Pi reloads `models.json` asynchronously and its registry documents awaiting `refresh`
 before synchronous reads, so the pass awaits an offline refresh first.
 `modelOverrides` cannot be lost either way: pi applies them after extension model
 replacement (`dist/core/provider-composer.js:337-353`), which the disposable host
 confirms by reporting the overridden 750000 both before and after filtering.
 */
export type CatalogRefresher = {
  /**
   Reload `models.json`, optionally without reaching the network.
   */
  readonly refresh: (options?: {
    readonly allowNetwork?: boolean;
  }) => Promise<unknown>;
};

/**
 Identity of the model a session is currently running.
 */
export type LiveModelIdentity = {
  /**
   Provider serving the model.
   */
  readonly provider: string;
  /**
   Model id.
   */
  readonly id: string;
};

/**
 One provider pi refused to re-register.
 */
export type FailedProvider = {
  /**
   Provider whose registration threw.
   */
  readonly provider: string;
  /**
   Text of the caught failure.
   */
  readonly reason: string;
};

/**
 Outcome of one retirement pass, returned so tests can assert without a logger.
 */
export type RetirementPassSummary = {
  /**
   Retirements the rule decided.
   */
  readonly retirements: readonly Retirement[];
  /**
   Providers whose model list was replaced.
   */
  readonly registeredProviders: readonly string[];
  /**
   Providers the rule retired models for but that cannot be re-declared.
   */
  readonly skippedProviders: readonly SkippedProvider[];
  /**
   Providers pi refused to re-register.
   */
  readonly failedProviders: readonly FailedProvider[];
  /**
   Retirement matching the session's live model, when there is one.
   */
  readonly liveModelRetirement?: Retirement;
};

//endregion Types

//region Registry adaptation

/**
 Adapt pi's registry into the three narrow reads the planner takes.

 @param chatReader - registry side returning chat models

 @param imageReader - registry side returning image models

 @param classifierReader - registry side returning classifier models

 @returns reads the planner consumes

 @example
 ```typescript
 readsFromRegistry({ chatReader: ctx.modelRegistry, imageReader: ctx.modelRegistry, classifierReader: ctx.modelRegistry });
 ```
 */
/**
 Test whether an unknown value is a provider configuration this pass can spread.

 @param value - what pi returned for one provider

 @returns whether the value is an object worth layering a model list onto

 @example
 ```typescript
 isProviderConfig({ api: 'pi-messages' }); // true
 ```
 */
function isProviderConfig(value: unknown,): value is ForeignBorrowed<ProviderConfig> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 Adapt pi's registry into the narrow reads the planner takes.

 @param chatReader - registry side returning chat models

 @param imageReader - registry side returning image models

 @param classifierReader - registry side returning classifier models

 @param idReader - registry side naming extension-registered providers

 @param configReader - registry side returning one provider's incumbent configuration

 @returns reads the planner consumes

 @example
 ```typescript
 readsFromRegistry({ chatReader, imageReader, classifierReader, idReader, configReader });
 ```
 */
export function readsFromRegistry(
  {
    chatReader,
    imageReader,
    classifierReader,
    idReader,
    configReader,
  }: {
    readonly chatReader: ChatModelReader;
    readonly imageReader: ImageModelReader;
    readonly classifierReader: ClassifierModelReader;
    readonly idReader: ProviderIdReader;
    readonly configReader: ProviderConfigReader;
  },
): CatalogRead {
  return {
    readChatModels: function readChatModels() {
      return chatReader.getAll();
    },
    readImageModels: function readImageModels(provider,) {
      return imageReader.getModelsOfType(
        'image',
        provider,
      );
    },
    readClassifierModels: function readClassifierModels(provider,) {
      return classifierReader.getModelsOfType(
        'classifier',
        provider,
      );
    },
    readRegisteredProviderIds: function readRegisteredProviderIds() {
      return idReader.getRegisteredProviderIds();
    },
    readProviderConfig: function readProviderConfig(provider,): IncumbentConfig {
      /**
       Whatever pi holds for this provider.
       */
      const incumbent = configReader.getRegisteredProviderConfig(provider,);
      if (!isProviderConfig(incumbent,))
        return { kind: 'absent', };
      return {
        kind: 'present',
        config: incumbent,
      };
    },
  };
}

//endregion Registry adaptation

//region Retirement pass

/**
 Run one retirement pass: plan, re-register, and log.

 @param read - catalog reads for this pass

 @param refresh - awaited before reading, so `models.json` overrides are applied

 @param registerProvider - provider re-registration side of pi

 @param liveModel - identity of the model the session is running, when it has one

 @param log - logger the pass reports through

 @returns what the pass retired, registered, and found running live

 @mutates registerProvider - replaces the model list of every provider that loses a model

 @example
 ```typescript
 await applyRetirements({ read, refresh, registerProvider, log });
 ```
 */
export async function applyRetirements(
  {
    read,
    refresh,
    registerProvider,
    liveModel,
    log,
  }: {
    readonly read: CatalogRead;
    readonly refresh: () => Promise<void>;
    readonly registerProvider: ProviderRegistrar['registerProvider'];
    readonly liveModel?: LiveModelIdentity;
    readonly log: RetirementLog;
  },
): Promise<RetirementPassSummary> {
  try {
    await refresh();
  } catch (error) {
    log.warn(formatRefreshFailure({ reason: caughtValueText(error,), },),);
  }
  /**
   Plans and retirements for the catalog as it stands now.
   */
  const planning = planProviderFilters({ read, },);
  /**
   Providers whose model list this pass replaced.
   */
  const registeredProviders: string[] = [];
  /**
   Providers pi refused to re-register, each reported and then skipped so one bad
   provider cannot leave the rest of the catalog unfiltered.
   */
  const failedProviders: FailedProvider[] = [];
  for (const plan of planning.plans) {
    try {
      registerProvider({
        name: plan.provider,
        config: plan.config,
      },);
      registeredProviders.push(plan.provider,);
    } catch (error) {
      failedProviders.push({
        provider: plan.provider,
        reason: caughtValueText(error,),
      },);
    }
  }
  log.info(formatPlanningSummary({
    counts: {
      planCount: planning.plans
        .length,
      retirementCount: planning.retirements
        .length,
      abstentions: planning.abstentions,
    },
  },),);
  for (const retirement of planning.retirements)
    log.debug(formatRetirementLine({ retirement, },),);
  for (const skipped of planning.skippedProviders)
    log.warn(formatSkippedProvider({ skipped, },),);
  for (const failed of failedProviders)
    log.warn(formatFailedProvider({ failed, },),);
  /**
   Retirement matching the session's live model, when the session started on one.
   */
  const liveModelRetirement = liveModel === undefined
    ? undefined
    : planning.retirements
      .find(function matchesLiveModel(retirement,) {
      return (retirement.provider === liveModel.provider)
        && (retirement.retiredId === liveModel.id);
    },);
  if (liveModelRetirement !== undefined)
    log.warn(formatLiveModelWarning({ retirement: liveModelRetirement, },),);
  return {
    retirements: planning.retirements,
    registeredProviders,
    skippedProviders: planning.skippedProviders,
    failedProviders,
    ...(liveModelRetirement === undefined ? {} : { liveModelRetirement, }),
  };
}

/**
 Register the `session_start` handler that retires superseded models.

 @param pi - pi extension API

 @param logger - package logger the handler re-tags; defaults to a tag for this package

 @mutates pi - `pi.on` registers the session-start handler and the handler calls
 `pi.registerProvider`

 @example
 ```typescript
 registerModelRetirement({ pi });
 ```
 */
export function registerModelRetirement(
  {
    pi,
    logger = tagged({ tag: 'pi-model-retirement', },),
  }: {
    readonly pi: ForeignBorrowed<ExtensionAPI>;
    readonly logger?: Logger;
  },
): void {
  /**
   Provider re-registration forwarded to pi, hoisted so its scope is the one holding the
   borrowed API handle.

   @param name - provider whose model list pi replaces

   @param config - configuration carrying every model the provider keeps
   */
  function registerProvider(
    {
      name,
      config,
    }: {
      readonly name: string;
      readonly config: ProviderConfig;
    },
  ): void {
    pi.registerProvider(
      name,
      config,
    );
  }

  pi.on(
    'session_start',
    async function onSessionStart(
      _event: ForeignBorrowed<SessionStartEvent>,
      ctx,
    ): Promise<void> {
      /**
       Logger tagged for this handler, so records name the package and the entry point.
       */
      const scoped = tagged({
        tag: onSessionStart.name,
        l: logger,
      },);
      /**
       Registry the session started against, narrowed to the surface this pass uses.
       */
      const registry: ChatModelReader & ImageModelReader & ClassifierModelReader & CatalogRefresher & ProviderIdReader & ProviderConfigReader = ctx.modelRegistry;
      /**
       Identity of the model the session runs, absent when none is resolved yet.
       */
      const liveModel = ctx.model === undefined
        ? undefined
        : {
          provider: ctx.model
            .provider,
          id: ctx.model
            .id,
        };
      await applyRetirements({
        read: readsFromRegistry({
          chatReader: registry,
          imageReader: registry,
          classifierReader: registry,
          idReader: registry,
          configReader: registry,
        },),
        refresh: async function refreshCatalog() {
          await registry.refresh({ allowNetwork: false, },);
        },
        registerProvider,
        ...(liveModel === undefined ? {} : { liveModel, }),
        log: {
          info: function reportInfo(message,) {
            scoped.info(message,);
          },
          debug: function reportDebug(message,) {
            scoped.debug(message,);
          },
          warn: function reportWarn(message,) {
            scoped.warn(message,);
          },
        },
      },);
    },
  );
}

//endregion Retirement pass
