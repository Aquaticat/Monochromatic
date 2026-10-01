/** Native virtual Codex fast entries with request-local priority transport. @module */

import type {
  Api,
  Model,
  Provider,
  OpenAICodexResponsesOptions,
  TranscriptContext,
} from '@earendil-works/pi-ai';
import type { ExtensionAPI, ModelRegistry, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { loadCodexProvider, } from './catalog.ts';
import { CODEX_API, CODEX_PROVIDER, } from './constants.ts';
import { createPriorityProvider, } from './priority-provider.ts';
import { FastModelError, } from './fast-model-error.ts';
import { createFastModelRegistration, } from './virtual-registration.ts';

export { createCatalogCredentials, loadCodexProvider, } from './catalog.ts';
export { CODEX_API, CODEX_PROVIDER, FAST_PROVIDER, PRIORITY_TARGET_PREFIX, } from './constants.ts';
export { FastModelError, } from './fast-model-error.ts';
export { createPriorityProvider, isPriorityTarget, priorityTarget, resolvePriorityBase, } from './priority-provider.ts';
export { createFastModelRegistration, } from './virtual-registration.ts';
export { streamPriority, streamSimplePriority, } from './priority-stream.ts';
export { forcePriorityPayload, } from './priority-payload.ts';
export { PriorityRequestError, } from './priority-error.ts';

//region Native registration

/** Module logger records extension lifecycle without additional UI. */
const moduleLogger = tagged({ tag: 'pi-plugin-openai-fast.index', },);

/**
 Register virtual companions and a keyless adapter without replacing the original provider.
 @param pi - host registration capability
 @param provider - native Codex provider before priority wrapping
 @mutates pi - registers the provider, virtual models, and session-start callback
 @mutates provider - invokes model listing and ordinary stream callbacks
 */
export function registerOpenAIFast({ pi, provider, }: {
  readonly pi: ForeignHostCapability<ExtensionAPI>;
  readonly provider: ForeignHostCapability<Provider>;
},): void {
  const l = tagged({ tag: registerOpenAIFast.name, l: moduleLogger, },);
  l.debug('registering virtual priority companions',);
  let registry: ForeignHostCapability<ModelRegistry> | undefined;
  const synchronize = createFastModelRegistration(pi,);

  /**
   Read the current ordinary model, never another internal priority target.
   @param id - original upstream model identity
   @returns current model or absent when removed
   */
  function originalProvider(): ForeignHostCapability<Provider> {
    if (registry === undefined)
      return provider;
    const original = registry.getProvider(CODEX_PROVIDER,);
    if (original === undefined)
      throw new FastModelError('The original Codex provider is no longer registered. Restore it or select another provider.',);
    return original;
  }

  /**
   Read the current original model without enumerating the adapter.
   @param id - original upstream identity
   @returns live original model or absent after removal
   */
  function lookup(id: string,): Model<Api> | undefined {
    const ll = tagged({ tag: lookup.name, l, },);
    ll.trace(`looking up original Codex model ${id}`,);
    if (registry !== undefined)
      return registry.find(CODEX_PROVIDER, id,);
    return provider.getModels().find(function matchingModel(model,) { return model.id === id; },);
  }

  /**
   Resolve original-model auth and model-specific headers through the live host before native dispatch.
   @param model - original model, not the internal target
   @param context - normalized conversation
   @param options - native priority request options
   @returns native assistant event stream
   @mutates model - provider dispatch reads host model capabilities
   @mutates options - provider consumes cancellation and instrumentation callbacks
   */
  function dispatch(model: Model<typeof CODEX_API>, context: TranscriptContext, options?: OpenAICodexResponsesOptions,) {
    const dl = tagged({ tag: dispatch.name, l, },);
    dl.debug(`dispatching priority request for ${model.id}`,);
    if (registry === undefined)
      throw new FastModelError('Codex fast dispatch requires an initialized pi session. Start or reload the session before requesting a fast model.',);
    return registry.stream(model, context, options,);
  }

  pi.registerProvider(createPriorityProvider({ provider, getProvider: originalProvider, lookup, dispatch, onCatalog: synchronize, },),);
  synchronize(provider.getModels(),);
  pi.on('session_start', function sessionStart(_event, ctx,) {
    const sl = tagged({ tag: sessionStart.name, l, },);
    registry = ctx.modelRegistry;
    synchronize(originalProvider().getModels(),);
    sl.debug('bound priority dispatch to the unchanged original pi provider',);
  },);
}

//endregion

//region Extension factory

/**
 Initialize every configured Codex companion before startup model selection.
 @param pi - native extension registration capability
 @mutates pi - delegates provider and virtual-model registration
 */
export default async function openAIFast(pi: ForeignHostCapability<ExtensionAPI>,): Promise<void> {
  const l = tagged({ tag: openAIFast.name, l: moduleLogger, },);
  l.debug('initializing virtual Codex fast extension',);
  const provider = await loadCodexProvider();
  registerOpenAIFast({ pi, provider, },);
  l.debug('virtual Codex fast extension initialized',);
}

//endregion
