/** Native Codex overlay isolating priority dispatch by physical target identity. @module */

import {
  hasApi,
  getModelType,
  type Api,
  type ApiStreamOptions,
  type AnyModel,
  type Credential,
  type Model,
  type Provider,
  type SimpleStreamOptions,
  type StreamFunction,
  type TranscriptContext,
  type OpenAICodexResponsesOptions,
} from '@earendil-works/pi-ai';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { CODEX_API, PRIORITY_TARGET_PREFIX, } from './constants.ts';
import { FastModelError, } from './fast-model-error.ts';
import { streamPriority, streamSimplePriority, } from './priority-stream.ts';

//region Routing identity helpers

/** Module-scoped logger without request content or credentials. */
const moduleLogger = tagged({ tag: 'pi-plugin-openai-fast.priority-provider', },);

/** Detect only extension-owned target identities, never upstream priority compatibility. */
export function isPriorityTarget(model: Pick<AnyModel, 'id'>,): boolean {
  return model.id.startsWith(PRIORITY_TARGET_PREFIX,);
}

/**
 Clone model metadata for a local-only physical routing target.
 @param model - original catalog model
 @returns physical target with original capabilities and limits
 */
export function priorityTarget(model: Model<Api>,): Model<Api> {
  const l = tagged({ tag: priorityTarget.name, l: moduleLogger, },);
  l.trace(`creating physical routing target for ${model.id}`,);
  return { ...model, id: `${PRIORITY_TARGET_PREFIX}${model.id}`, };
}

/**
 Resolve target to the live upstream identity rather than persisting a stale clone.
 @param model - requested target
 @param lookup - live original-model lookup
 @returns original native Codex model
 @throws FastModelError when the original model disappeared or uses another API
 @mutates lookup - invokes supplied catalog lookup capability
 */
export function resolvePriorityBase({ model, lookup, }: {
  readonly model: Model<Api>;
  readonly lookup: (id: string) => Model<Api> | undefined;
},): Model<typeof CODEX_API> {
  const l = tagged({ tag: resolvePriorityBase.name, l: moduleLogger, },);
  const id = model.id.slice(PRIORITY_TARGET_PREFIX.length,);
  const base = lookup(id,);
  if (base === undefined)
    throw new FastModelError(`Codex fast model "${id}" no longer exists. Refresh models or select an available model.`,);
  if (!hasApi(base, CODEX_API,)) {
    throw new FastModelError(`Codex fast model "${id}" uses "${base.api}" instead of the native Codex transport. Correct its model configuration or select its ordinary entry.`,);
  }
  l.debug(`resolved priority target to ${base.id}`,);
  return base;
}

//endregion

//region Provider overlay

/** Dependencies preserving the native provider and live request boundary. */
export type PriorityProviderOptions = {
  readonly provider: ForeignHostCapability<Provider>;
  readonly lookup: (id: string) => Model<Api> | undefined;
  readonly dispatch: StreamFunction<typeof CODEX_API, OpenAICodexResponsesOptions>;
  readonly onCatalog: (models: readonly Model<Api>[]) => void;
};

/**
 Retain native authentication and operations while adding filtered priority targets.
 @param provider - native effective provider before this overlay
 @param lookup - current upstream model lookup
 @param dispatch - full native registry dispatch for original-model authentication and headers
 @param onCatalog - companion synchronizer after source catalog refresh
 @returns provider using request-local identities rather than mutable fast-mode state
 @mutates provider - delegates model access, availability filters, refresh, and ordinary streaming
 @mutates lookup - priority dispatch invokes live model lookup
 @mutates dispatch - priority dispatch invokes supplied native stream capability
 @mutates onCatalog - refresh invokes companion registration callback
 */
export function createPriorityProvider({ provider, lookup, dispatch, onCatalog, }: PriorityProviderOptions,): Provider {
  const l = tagged({ tag: createPriorityProvider.name, l: moduleLogger, },);
  l.debug('registering native Codex priority overlay',);
  return {
    ...provider,
    getModels: function getModels() {
      const models = provider.getModels();
      return [...models, ...models.map(priorityTarget,),];
    },
    getAllModels: function getAllModels() {
      const models = provider.getAllModels?.() ?? provider.getModels();
      return [...models, ...provider.getModels().map(priorityTarget,),];
    },
    filterModels: function filterModels(models, credential,) {
      const ordinary = models.filter(function keepOrdinary(model,) { return !isPriorityTarget(model,); },);
      return provider.filterModels?.(ordinary, credential,) ?? ordinary;
    },
    filterAllModels: function filterAllModels(models, credential,) {
      const ordinary = models.filter(function keepOrdinary(model,) {
        return (getModelType(model,) !== 'chat') || !isPriorityTarget(model,);
      },);
      if (provider.filterAllModels !== undefined)
        return provider.filterAllModels(ordinary, credential,);
      const chat = ordinary.filter(function keepChat(model,): model is Model<Api> { return getModelType(model,) === 'chat'; },);
      const available = provider.filterModels?.(chat, credential,) ?? chat;
      const availableIds = new Set(available.map(function modelId(model,) { return model.id; },),);
      return ordinary.filter(function keepAvailable(model,) {
        return (getModelType(model,) !== 'chat') || availableIds.has(model.id,);
      },);
    },
    stream: function stream<TApi extends Api>(model: Model<TApi>, context: TranscriptContext, options?: ApiStreamOptions<TApi>,) {
      if (!isPriorityTarget(model,))
        return provider.stream(model, context, options,);
      return streamPriority({ model: resolvePriorityBase({ model, lookup, },), context, options, stream: dispatch, },);
    },
    streamSimple: function streamSimple(model, context, options,) {
      if (!isPriorityTarget(model,))
        return provider.streamSimple(model, context, options,);
      return streamSimplePriority({ model: resolvePriorityBase({ model, lookup, },), context, options, stream: dispatch, },);
    },
    ...(provider.refreshModels === undefined ? {} : {
      refreshModels: async function refreshModels(context,) {
        const rl = tagged({ tag: refreshModels.name, l, },);
        rl.debug('refreshing original Codex catalog',);
        await provider.refreshModels?.(context);
        if (context.signal.aborted)
          return;
        onCatalog(provider.getModels(),);
        rl.debug('synchronized fast companions after catalog refresh',);
      },
    }),
  };
}

//endregion
