/**
 Session-owned binding to the unchanged original Codex provider. @module
 */

import type {
  Api,
  AssistantMessageEventStream,
  Model,
  OpenAICodexResponsesOptions,
  Provider,
  TranscriptContext,
} from '@earendil-works/pi-ai';
import type { ModelRegistry, } from '@earendil-works/pi-coding-agent';
import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  CODEX_PROVIDER,
  type CODEX_API,
} from './constants.ts';
import { FastModelError, } from './fast-model-error.ts';
import type {
  OriginalDispatchCapabilities,
  OriginalModelLookup,
} from './original-dispatch-types.ts';

//region Original host binding

/**
 Encapsulate the mutable registry behind frozen request capabilities.

 @param provider - bootstrap source before host binding

 @param l - registration logger

 @returns original-provider lookup and authenticated dispatch capabilities

 @example
 ```ts
 const binding = createOriginalDispatch({ provider, l });
 ```
 */
export function createOriginalDispatch({
  provider,
  l,
}: {
  readonly provider: ForeignHostCapability<Provider>;
  readonly l: Logger;
},): OriginalDispatchCapabilities {
  /**
   Logger retains registration ancestry without exposing request content.
   */
  const logger = tagged({
    tag: createOriginalDispatch.name,
    l,
  },);
  /**
   Mutable state belongs only to this factory's returned capabilities.
   */
  const state: { registry?: ForeignHostCapability<ModelRegistry>; } = {};

  /**
   Bind subsequent calls to the initialized host registry.

   @param registry - authenticated host request capability

   @remarks Retains the registry on this factory's owned state.
   */
  function bind(registry: ForeignHostCapability<ModelRegistry>,): void {
    state.registry = registry;
    logger.debug('bound original-model dispatch to the active host',);
  }

  /**
   Read only the original provider, never the adapter's catalog.

   @returns bootstrap source or current original provider

   @throws FastModelError when the original provider was removed
   */
  function getProvider(): ForeignHostCapability<Provider> {
    /**
     Function logger records only provider lookup lifecycle.
     */
    const inner = tagged({
      tag: getProvider.name,
      l: logger,
    },);
    inner.trace('reading original provider metadata',);
    if (state.registry === undefined)
      return provider;
    /**
     Live lookup reflects every source configuration and catalog change.
     */
    const original = state.registry
      .getProvider(CODEX_PROVIDER,);
    if (original === undefined)
      throw new FastModelError('The original Codex provider is no longer registered. Restore it or select another provider.',);
    return original;
  }

  /**
   Find an original model without enumerating the adapter.

   @param id - upstream identity

   @returns current original model or absent after removal
   */
  function lookup(id: string,): ReturnType<OriginalModelLookup> {
    /**
     Lookup logger excludes headers and credentials.
     */
    const inner = tagged({
      tag: lookup.name,
      l: logger,
    },);
    inner.trace(`looking up original Codex model ${id}`,);
    if (state.registry !== undefined)
      return state.registry
        .getModelOfType(
          'chat',
          CODEX_PROVIDER,
          id,
        );
    return provider.getModels()
      .find(function matchingModel(model: ForeignHostCapability<Model<Api>>,) {
        return model.id === id;
      },);
  }

  /**
   Native StreamFunction callback resolves original auth and model-specific headers.

   @param model - original model

   @param context - normalized transcript

   @param options - native priority options

   @returns native stream without tier or model fallback

   @mutates options - native dispatch consumes cancellation and instrumentation callbacks

   @throws FastModelError when invoked before initialization
   */
  function dispatch({
    model,
    context,
    options,
  }: {
    readonly model: ForeignHostCapability<Model<typeof CODEX_API>>;
    readonly context: ForeignHostCapability<TranscriptContext>;
    readonly options?: ForeignHostCapability<OpenAICodexResponsesOptions>;
  },): AssistantMessageEventStream {
    /**
     Stream logger records identity without request options or authentication.
     */
    const inner = tagged({
      tag: dispatch.name,
      l: logger,
    },);
    inner.debug(`dispatching priority request for ${model.id}`,);
    if (state.registry === undefined)
      throw new FastModelError('Codex fast dispatch requires an initialized pi session. Start or reload the session before requesting a fast model.',);
    return state.registry
      .stream(
        model,
        context,
        options,
      );
  }

  return Object.freeze({
    bind,
    getProvider,
    lookup,
    /**
     {@inheritDoc dispatch}
     */
    stream: function stream(
      model: ForeignHostCapability<Model<typeof CODEX_API>>,
      context: ForeignHostCapability<TranscriptContext>,
      options?: ForeignHostCapability<OpenAICodexResponsesOptions>,
    ): AssistantMessageEventStream {
      return dispatch({
        model,
        context,
        ...(options === undefined ? {} : { options, }),
      },);
    },
  },);
}

//endregion
