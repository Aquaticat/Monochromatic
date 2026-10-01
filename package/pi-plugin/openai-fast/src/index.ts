/**
 Native virtual Codex fast entries using the unchanged original provider. @module
 */

import type { Provider, } from '@earendil-works/pi-ai';
import type {
  ExtensionAPI,
  SessionStartEvent,
} from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  ForeignBorrowed,
  ForeignHostCapability,
} from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { loadCodexProvider, } from './catalog.ts';
import { createOriginalDispatch, } from './original-dispatch.ts';
import { createPriorityProvider, } from './priority-provider.ts';
import { createFastModelRegistration, } from './virtual-registration.ts';

export {
  createCatalogCredentials,
  loadCodexProvider,
} from './catalog.ts';
export {
  CODEX_API,
  CODEX_PROVIDER,
  FAST_PROVIDER,
  PRIORITY_TARGET_PREFIX,
} from './constants.ts';
export { FastModelError, } from './fast-model-error.ts';
export {
  createPriorityProvider,
  isPriorityTarget,
  priorityTarget,
  resolvePriorityBase,
} from './priority-provider.ts';
export { createFastModelRegistration, } from './virtual-registration.ts';
export {
  streamPriority,
  streamSimplePriority,
} from './priority-stream.ts';
export { forcePriorityPayload, } from './priority-payload.ts';
export { PriorityRequestError, } from './priority-error.ts';

//region Native registration

/**
 Module logger records lifecycle without additional selection UI.
 */
const moduleLogger = tagged({ tag: 'pi-plugin-openai-fast.index', },);

/**
 Register virtual companions and keyless targets without replacing the original provider.
 
 @param pi - host registration capability
 
 @param provider - credential-free bootstrap metadata source
 
 @mutates pi - registers adapter, virtual models, and session-start callback
 
 @mutates provider - invokes original metadata accessors

 @example
 ```ts
 registerOpenAIFast({ pi, provider });
 ```
 */
export function registerOpenAIFast({
  pi,
  provider,
}: {
  readonly pi: ForeignHostCapability<ExtensionAPI>;
  readonly provider: ForeignHostCapability<Provider>;
},): void {
  /**
   Registration logger carries the module boundary into helper calls.
   */
  const l = tagged({
    tag: registerOpenAIFast.name,
    l: moduleLogger,
  },);
  l.debug('registering virtual priority companions',);
  /**
   Session binding is private state, never a global request-tier switch.
   */
  const binding = createOriginalDispatch({
    provider,
    l,
  },);
  /**
   Structural registration guard prevents getter-triggered reentrant catalog recursion.
   */
  const synchronize = createFastModelRegistration(pi,);
  pi.registerProvider(createPriorityProvider({
    provider,
    getProvider: binding.getProvider,
    lookup: binding.lookup,
    dispatch: binding.stream,
    onCatalog: synchronize,
  },),);
  synchronize(provider.getModels(),);
  pi.on(
    'session_start',
    function sessionStart(
      _event: ForeignBorrowed<SessionStartEvent>,
      ctx,
    ) {
    /**
     Session logger exposes binding lifecycle without payloads or credentials.
     */
    const sl = tagged({
      tag: sessionStart.name,
      l,
    },);
    binding.bind(ctx.modelRegistry,);
    synchronize(binding.getProvider()
      .getModels(),);
    sl.debug('bound priority dispatch to the unchanged original pi provider',);
  },
  );
}

//endregion

//region Extension factory

/**
 Initialize configured Codex companions before startup model selection.
 
 @param pi - native registration capability
 
 @mutates pi - delegates adapter and virtual-model registration

 @example
 ```ts
 await openAIFast(pi);
 ```
 */
export default async function openAIFast(pi: ForeignHostCapability<ExtensionAPI>,): Promise<void> {
  /**
   Factory logger records initialization without another footer or notification.
   */
  const l = tagged({
    tag: openAIFast.name,
    l: moduleLogger,
  },);
  l.debug('initializing virtual Codex fast extension',);
  /**
   Bootstrap uses metadata only; real request auth stays in the active original provider.
   */
  const provider = await loadCodexProvider();
  registerOpenAIFast({
    pi,
    provider,
  },);
  l.debug('virtual Codex fast extension initialized',);
}

//endregion
