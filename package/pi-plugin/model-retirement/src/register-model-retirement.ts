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
  type SkippedProvider,
} from './provider-filter.ts';
import type { Retirement, } from './retirement-rule.ts';
import {
  formatFailedProvider,
  formatLiveModelWarning,
  formatPlanningSummary,
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
export function readsFromRegistry(
  {
    chatReader,
    imageReader,
    classifierReader,
  }: {
    readonly chatReader: ChatModelReader;
    readonly imageReader: ImageModelReader;
    readonly classifierReader: ClassifierModelReader;
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
  };
}

//endregion Registry adaptation

//region Retirement pass

/**
 Run one retirement pass: plan, re-register, and log.

 @param read - catalog reads for this pass

 @param registerProvider - provider re-registration side of pi

 @param liveModel - identity of the model the session is running, when it has one

 @param log - logger the pass reports through

 @returns what the pass retired, registered, and found running live

 @mutates registerProvider - replaces the model list of every provider that loses a model

 @example
 ```typescript
 applyRetirements({ read, registerProvider, liveModel: undefined, log });
 ```
 */
export function applyRetirements(
  {
    read,
    registerProvider,
    liveModel,
    log,
  }: {
    readonly read: CatalogRead;
    readonly registerProvider: ProviderRegistrar['registerProvider'];
    readonly liveModel?: LiveModelIdentity;
    readonly log: RetirementLog;
  },
): RetirementPassSummary {
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
        config: { models: [...plan.models], },
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
    function onSessionStart(
      _event: ForeignBorrowed<SessionStartEvent>,
      ctx,
    ): void {
      /**
       Logger tagged for this handler, so records name the package and the entry point.
       */
      const scoped = tagged({
        tag: onSessionStart.name,
        l: logger,
      },);
      /**
       Registry the session started against.
       */
      const registry = ctx.modelRegistry;
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
      applyRetirements({
        read: readsFromRegistry({
          chatReader: registry,
          imageReader: registry,
          classifierReader: registry,
        },),
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
