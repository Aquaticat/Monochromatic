/** Test-only priority overlay driver and refresh publication capability. @module */
import type { Api, Model, Provider, RefreshModelsContext, StreamFunction, OpenAICodexResponsesOptions, } from '@earendil-works/pi-ai';
import { createPriorityProvider, } from '../dist/final/node/index.mjs';
import { fixtureAssistant, fixtureStream, } from './host-fixture-model.ts';
import type { FixtureCall, } from './host-fixture-provider.ts';

//region Overlay driver: injected full dispatch is distinct from ordinary provider delegation.

/** Capture priority dispatch and source catalog synchronization without a host or network. */
export function fixtureOverlay(provider: Provider,) {
  const dispatched: FixtureCall[] = [];
  const catalogs: (readonly Model<Api>[])[] = [];
  const dispatch: StreamFunction<'openai-codex-responses', OpenAICodexResponsesOptions> = function dispatch(model, context, options) {
    dispatched.push({ kind: 'full', model, context, options, },);
    return fixtureStream(fixtureAssistant({ model, },),);
  };
  const overlay = createPriorityProvider({ provider, dispatch,
    lookup: function lookup(id) { return provider.getModels().find(function matches(model) { return model.id === id; },); },
    onCatalog: function onCatalog(models) { catalogs.push(models,); }, },);
  return { overlay, dispatched, catalogs, };
}

/** Publish fixture updates immediately unless the test has already cancelled the refresh. */
export function fixtureRefresh(signal: AbortSignal = new AbortController().signal,): RefreshModelsContext {
  return {
    signal, allowNetwork: false,
    publish: async function publish(publication) {
      if (signal.aborted)
        return false;
      publication.update?.();
      return true;
    },
  };
}

//endregion Overlay driver
