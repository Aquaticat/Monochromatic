/** Keyless priority targets that leave the original Codex provider untouched. @module */

import {
  hasApi,
  type Api,
  type ApiStreamOptions,
  type AnyModel,
  type Model,
  type Provider,
  type StreamFunction,
  type TranscriptContext,
  type OpenAICodexResponsesOptions,
} from '@earendil-works/pi-ai';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { CODEX_API, FAST_PROVIDER, PRIORITY_TARGET_PREFIX, } from './constants.ts';
import { FastModelError, } from './fast-model-error.ts';
import { streamPriority, streamSimplePriority, } from './priority-stream.ts';

//region Routing identity helpers

/** Module logger excludes payloads, authentication, and configured headers. */
const moduleLogger = tagged({ tag: 'pi-plugin-openai-fast.priority-provider', },);

/** Detect extension-owned routing identities, never model priority compatibility. */
export function isPriorityTarget(model: Readonly<Pick<AnyModel, 'id'>>, ): boolean {
  /** Identity logger records only the routing-boundary operation. */
  const l = tagged({ tag: isPriorityTarget.name, l: moduleLogger, },);
  l.trace('checking internal routing identity',);
  return model.id.startsWith(PRIORITY_TARGET_PREFIX,);
}

/**
 Clone capabilities for a local target without inheriting request-auth headers.
 @param model - original catalog model
 @returns local physical target, never an upstream model ID
 */
export function priorityTarget(model: ForeignBorrowed<Model<Api>>, ): Model<Api> {
  /** Target logger excludes all request-auth metadata. */
  const l = tagged({ tag: priorityTarget.name, l: moduleLogger, },);
  l.trace(`creating physical routing target for ${model.id}`,);
  /** Authentication headers are deliberately left at the original request boundary. */
  const { headers: _headers, ...metadata } = model;
  return { ...metadata, provider: FAST_PROVIDER, id: `${PRIORITY_TARGET_PREFIX}${model.id}`, };
}

/**
 Resolve a target to the live original rather than persisting a stale clone.
 @param model - requested internal target
 @param lookup - live original-model lookup
 @returns original native Codex model
 @throws FastModelError when input is not a target, the original disappeared, or its API is unsupported
 @mutates lookup - invokes supplied catalog lookup capability
 */
export function resolvePriorityBase({ model, lookup, }: {
  readonly model: ForeignBorrowed<Model<Api>>;
  readonly lookup: (id: string) => Model<Api> | undefined;
},): Model<typeof CODEX_API> {
  /** Original-model logger keeps translation visible without request data. */
  const l = tagged({ tag: resolvePriorityBase.name, l: moduleLogger, },);
  if (!isPriorityTarget(model,))
    throw new FastModelError(`Model "${model.id}" is not an internal Codex priority target. Select its fast virtual entry instead.`,);
  /** Fixed prefix removal recovers the original catalog identity. */
  const id = model.id.slice(PRIORITY_TARGET_PREFIX.length,);
  /** Current original is resolved after configuration and catalog changes. */
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

//region Adapter provider

/** Source metadata and the original runtime dispatch boundary. */
export type PriorityProviderOptions = {
  readonly provider: ForeignHostCapability<Provider>;
  readonly getProvider?: () => ForeignHostCapability<Provider>;
  readonly lookup: (id: string) => Model<Api> | undefined;
  readonly dispatch: StreamFunction<typeof CODEX_API, OpenAICodexResponsesOptions>;
  readonly onCatalog: (models: readonly Model<Api>[]) => void;
};

/**
 Add keyless physical targets without registering over the original provider.
 @param provider - bootstrap metadata source, never an authentication source
 @param getProvider - live original-provider lookup after session initialization
 @param lookup - current upstream model lookup
 @param dispatch - original registry dispatch for native auth and header precedence
 @param onCatalog - guarded companion registration when catalog reads expose changes
 @returns adapter whose targets are excluded from normal availability lists
 @mutates provider - invokes metadata accessors and explicitly delegated ordinary streams
 @mutates getProvider - invokes live catalog capability
 @mutates lookup - priority dispatch invokes original-model lookup
 @mutates dispatch - priority dispatch invokes native stream capability
 @mutates onCatalog - catalog reads invoke virtual registration
 */
export function createPriorityProvider({ provider, getProvider, lookup, dispatch, onCatalog, }: PriorityProviderOptions,): Provider {
  /** Adapter logger retains the module boundary through catalog callbacks. */
  const l = tagged({ tag: createPriorityProvider.name, l: moduleLogger, },);

  /** Read only the original provider, never recursively enumerate this adapter. */
  function originalModels(): readonly Model<Api>[] {
    /** Catalog-read logger never receives model headers or authentication. */
    const ml = tagged({ tag: originalModels.name, l, },);
    /** Source lookup targets only the unchanged original provider. */
    const source = getProvider?.() ?? provider;
    /** Virtual routers cannot be routed to as physical bases. */
    const models = source.getModels().filter(function physicalModel(model,) { return model.api !== 'pi-virtual'; },);
    onCatalog(models,);
    ml.trace(`read ${models.length} original Codex models`,);
    return models;
  }

  /** Derive targets from current original metadata without stale snapshots. */
  function getModels(): readonly Model<Api>[] {
    return originalModels().map(priorityTarget,);
  }

  l.debug('creating keyless priority adapter',);
  return {
    id: FAST_PROVIDER,
    name: 'OpenAI Codex Fast',
    auth: {
      apiKey: {
        name: 'Routes to existing Codex login',
        check: function check() { return Promise.resolve({ type: 'api_key' as const, source: 'routes-to-openai-codex', },); },
        resolve: function resolve() { return Promise.resolve({ auth: {}, source: 'routes-to-openai-codex', },); },
      },
    },
    getModels,
    getAllModels: getModels,
    filterModels: function filterModels() { return []; },
    filterAllModels: function filterAllModels() { return []; },
    stream: function stream<TApi extends Api>(model: Model<TApi>, context: TranscriptContext, options?: ApiStreamOptions<TApi>,) {
      if (!isPriorityTarget(model,))
        return provider.stream(model, context, options,);
      return streamPriority({ model: resolvePriorityBase({ model, lookup, },), context, ...(options === undefined ? {} : { options, }), stream: dispatch, },);
    },
    streamSimple: function streamSimple(model, context, options,) {
      if (!isPriorityTarget(model,))
        return provider.streamSimple(model, context, options,);
      return streamSimplePriority({ model: resolvePriorityBase({ model, lookup, },), context, ...(options === undefined ? {} : { options, }), stream: dispatch, },);
    },
    refreshModels: async function refreshModels(context,) {
      /** Refresh logger records companion synchronization without another provider's I/O. */
      const rl = tagged({ tag: refreshModels.name, l, },);
      if (context.signal.aborted)
        return;
      originalModels();
      rl.debug('synchronized companions without refreshing another provider under the adapter identity',);
    },
  };
}

//endregion
