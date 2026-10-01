/** Session-owned binding to the unchanged original Codex provider. @module */

import type {
  Api,
  AssistantMessageEventStream,
  Model,
  OpenAICodexResponsesOptions,
  Provider,
  TranscriptContext,
} from '@earendil-works/pi-ai';
import type { ModelRegistry, } from '@earendil-works/pi-coding-agent';
import { tagged, type Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { CODEX_PROVIDER, type CODEX_API, } from './constants.ts';
import { FastModelError, } from './fast-model-error.ts';

//region Original host binding

/** Encapsulate the mutable session binding without a request-global fast flag. */
export class OriginalDispatch {
  /** Bootstrap catalog provides metadata only, never real request authentication. */
  readonly #provider: ForeignHostCapability<Provider>;
  /** Parent logger retains module and extension registration tags. */
  readonly #l: Logger;
  /** Live registry becomes available when the host starts the session. */
  #registry?: ForeignHostCapability<ModelRegistry>;

  /**
   Retain bootstrap metadata and parent logger for later session binding.
   @param provider - original catalog source before host binding
   @param l - registration logger
   */
  constructor({ provider, l, }: { readonly provider: ForeignHostCapability<Provider>; readonly l: Logger; },) {
    this.#provider = provider;
    this.#l = tagged({ tag: OriginalDispatch.name, l, },);
  }

  /**
   Bind subsequent requests to the initialized host's original model registry.
   @param registry - host model lookup and authenticated dispatch capability
   @remarks Replaces the receiver's session-owned registry binding.
   */
  bind(registry: ForeignHostCapability<ModelRegistry>,): void {
    this.#registry = registry;
    this.#l.debug('bound original-model dispatch to the active host',);
  }

  /**
   Read the original provider without enumerating the adapter.
   @returns bootstrap source or current original provider
   @throws FastModelError when the original provider was removed
   */
  getProvider(): ForeignHostCapability<Provider> {
    /** Function logger extends the owning registration boundary. */
    const l = tagged({ tag: this.getProvider.name, l: this.#l, },);
    l.trace('reading original provider metadata',);
    if (this.#registry === undefined)
      return this.#provider;
    /** Current provider is looked up after each config or catalog change. */
    const original = this.#registry.getProvider(CODEX_PROVIDER,);
    if (original === undefined)
      throw new FastModelError('The original Codex provider is no longer registered. Restore it or select another provider.',);
    return original;
  }

  /**
   Read the current original model without traversing the adapter.
   @param id - upstream model identity
   @returns current original model or absent after removal
   */
  lookup(id: string,): Model<Api> | undefined {
    /** Function logger records only the public model identity. */
    const l = tagged({ tag: this.lookup.name, l: this.#l, },);
    l.trace(`looking up original Codex model ${id}`,);
    if (this.#registry !== undefined)
      return this.#registry.find(CODEX_PROVIDER, id,);
    return this.#provider.getModels().find(function matchingModel(model,) { return model.id === id; },);
  }

  /**
   Native StreamFunction callback resolves original auth and model-specific headers through the host.
   @param model - live original model
   @param context - normalized transcript
   @param options - full native priority request options
   @returns native stream without tier or model fallback
   @mutates options - native dispatch consumes cancellation and instrumentation callbacks
   @throws FastModelError when invoked before session initialization
   */
  stream(model: ForeignHostCapability<Model<typeof CODEX_API>>, context: ForeignHostCapability<TranscriptContext>, options?: ForeignHostCapability<OpenAICodexResponsesOptions>,): AssistantMessageEventStream {
    /** Function logger never receives options, headers, or authentication. */
    const l = tagged({ tag: this.stream.name, l: this.#l, },);
    l.debug(`dispatching priority request for ${model.id}`,);
    if (this.#registry === undefined)
      throw new FastModelError('Codex fast dispatch requires an initialized pi session. Start or reload the session before requesting a fast model.',);
    return this.#registry.stream(model, context, options,);
  }
}

//endregion
