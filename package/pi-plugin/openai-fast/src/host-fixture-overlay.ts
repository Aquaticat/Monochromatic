/**
 Test-only priority overlay driver and refresh publication capability.
 
 @module
 */
import type {
  Api,
  AssistantMessageEventStream,
  Model,
  Provider,
  RefreshModelsContext,
  TranscriptContext,
  OpenAICodexResponsesOptions,
} from '@earendil-works/pi-ai';
import type {
  ForeignBorrowed,
  ForeignHostCapability,
} from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { createPriorityProvider, } from '../dist/final/node/index.mjs';
import {
  fixtureAssistant,
  fixtureStream,
} from './host-fixture-model.ts';
import type { FixtureCall, } from './host-fixture-provider.ts';

//region Overlay driver: injected full dispatch is distinct from ordinary provider delegation.

/**
 Test-owned dispatch and catalog observations from the keyless overlay.
 */
export type FixtureOverlay = {
  readonly overlay: Provider;
  readonly dispatched: FixtureCall[];
  readonly catalogs: (readonly Model<Api>[])[];
};

/**
 Capture priority dispatch and source catalog synchronization without network.
 
 @param provider - native provider whose current metadata supplies the overlay
 
 @returns overlay and independently owned observations
 
 @example
 ```ts
 const driver = fixtureOverlay(fixtureProvider().provider);
 ```
 */
export function fixtureOverlay(provider: ForeignHostCapability<Provider>,): FixtureOverlay {
  /**
   Requests entering full original-registry dispatch, never ordinary delegation.
   */
  const dispatched: FixtureCall[] = [];
  /**
   Catalog synchronizations retain the source models before target cloning.
   */
  const catalogs: (readonly Model<Api>[])[] = [];
  /**
   Record full native dispatch and emit a canonical terminal response.
   
   @param model - original native request identity
   
   @param context - transcript supplied by the overlay
   
   @param options - prepared priority request without synthetic adapter auth
   
   @returns finite native response stream
   */
  function dispatch({
    model,
    context,
    options,
  }: {
    readonly model: ForeignBorrowed<Model<'openai-codex-responses'>>;
    readonly context: ForeignBorrowed<TranscriptContext>;
    readonly options?: ForeignBorrowed<OpenAICodexResponsesOptions>;
  },): AssistantMessageEventStream {
    dispatched.push({
      kind: 'full',
      model,
      context,
      ...(options === undefined ? {} : { options, }),
    },);
    return fixtureStream(fixtureAssistant({ model, },),);
  }
  /**
   Keyless built-artifact overlay uses the original provider only for lookup.
   */
  const overlay = createPriorityProvider({
    provider,
    dispatch: function dispatchOriginal(
      model: ForeignBorrowed<Model<'openai-codex-responses'>>,
      context: ForeignBorrowed<TranscriptContext>,
      options?: ForeignBorrowed<OpenAICodexResponsesOptions>,
    ): AssistantMessageEventStream {
      return dispatch({
        model,
        context,
        ...(options === undefined ? {} : { options, }),
      },);
    },
    lookup: function lookup(id): ReturnType<Parameters<typeof createPriorityProvider>[0]['lookup']> {
      return provider.getModels()
        .find(function matches(model: ForeignBorrowed<Model<Api>>): boolean {
          return model.id === id;
        },);
    },
    onCatalog: function onCatalog(models): void {
      catalogs.push(models,);
    },
  },);
  return {
    overlay,
    dispatched,
    catalogs,
  };
}

/**
 Publish fixture updates unless refresh was already cancelled.
 
 @param signal - native cancellation handle for this publication attempt
 
 @returns native refresh contract with asynchronous publication completion
 
 @example
 ```ts
 await provider.refreshModels?.(fixtureRefresh());
 ```
 */
export function fixtureRefresh(signal: ForeignBorrowed<AbortSignal> = new AbortController().signal,): RefreshModelsContext {
  return {
    signal,
    allowNetwork: false,
    publish: async function publish(publication: ForeignBorrowed<Parameters<RefreshModelsContext['publish']>[0]>): Promise<boolean> {
      if (signal.aborted)
        return await Promise.resolve(false,);
      publication.update?.();
      return await Promise.resolve(true,);
    },
  };
}

//endregion Overlay driver
