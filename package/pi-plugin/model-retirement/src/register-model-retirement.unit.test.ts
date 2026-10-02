/**
 Tests for the retirement pass and its session-start wiring.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type {
  ExtensionAPI,
  ProviderConfig,
} from '@earendil-works/pi-coding-agent';
import type {
  Api,
  ClassifierApi,
  ClassifierModel,
  ImageApi,
  ImageModel,
  Model,
} from '@earendil-works/pi-ai';
import {
  applyRetirements,
  readsFromRegistry,
  registerModelRetirement,
  type CatalogRead,
  type IncumbentConfig,
  type RetirementLog,
} from '../dist/final/node/index.mjs';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

//region Fixtures

/** API type used by chat fixtures. */
const CHAT_API: Api = 'openai-completions';

/**
 Build one chat model fixture.
 
 @param provider - provider id owning the model
 
 @param id - model id
 
 @returns chat model shaped like a registry read
 */
function chatModel(
  {
    provider,
    id,
  }: {
    readonly provider: string;
    readonly id: string;
  },
): Model<Api> {
  return {
    id,
    name: id,
    api: CHAT_API,
    provider,
    baseUrl: 'https://example.invalid',
    input: ['text'],
    cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, },
    reasoning: true,
    contextWindow: 128_000,
    maxTokens: 4_096,
  };
}

/**
 Build one image model fixture.
 
 @param provider - provider id owning the model
 
 @param id - model id
 
 @returns image model shaped like a registry read
 */
function imageModel(
  {
    provider,
    id,
  }: {
    readonly provider: string;
    readonly id: string;
  },
): ImageModel<ImageApi> {
  return {
    id,
    name: id,
    api: 'openrouter-images',
    provider,
    baseUrl: 'https://example.invalid',
    input: ['text', 'image'],
    cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, },
    type: 'image',
    output: ['image'],
  };
}

/**
 Build one classifier model fixture.
 
 @param provider - provider id owning the model
 
 @param id - model id
 
 @returns classifier model shaped like a registry read
 */
function classifierModel(
  {
    provider,
    id,
  }: {
    readonly provider: string;
    readonly id: string;
  },
): ClassifierModel<ClassifierApi> {
  return {
    id,
    name: id,
    api: 'typesafe-system-one',
    provider,
    baseUrl: 'https://example.invalid',
    input: ['text'],
    cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, },
    type: 'classifier',
    contextWindow: 8_000,
  };
}

/** Log records captured by a fake logger. */
type CapturedLog = {
  readonly info: string[];
  readonly debug: string[];
  readonly warn: string[];
};

/**
 Build a fake logger that captures every message.
 
 @param captured - arrays the fake appends to
 
 @returns logger surface the pass accepts
 */
function fakeLog(captured: CapturedLog,): RetirementLog {
  return {
    info: function captureInfo(message,) {
      captured.info.push(message,);
    },
    debug: function captureDebug(message,) {
      captured.debug.push(message,);
    },
    warn: function captureWarn(message,) {
      captured.warn.push(message,);
    },
  };
}

/**
 Build an empty capture triple.
 
 @returns fresh capture arrays
 */
function emptyCapture(): CapturedLog {
  return { info: [], debug: [], warn: [], };
}

/** Registration recorded by a fake pi host. */
type RecordedRegistration = {
  readonly name: string;
  readonly config: ProviderConfig;
};

/** State a fake pi host accumulates. */
type FakeHostState = {
  readonly events: string[];
  readonly registrations: RecordedRegistration[];
  handler?: (payload: unknown, ctx: unknown,) => Promise<void>;
};

/**
 Build a fake pi host recording events and provider registrations.
 
 @param state - mutable state the fake writes to
 
 @returns fake extension API and its recorded state
 */
function fakeHost(state: FakeHostState,): ExtensionAPI {
  /**
   Object implementing only the two members this extension touches.
   */
  const fake = {
    on(
      event: string,
      handler: (payload: unknown, ctx: unknown,) => Promise<void>,
    ): void {
      state.events.push(event,);
      state.handler = handler;
    },
    registerProvider(name: string, config: ProviderConfig,): void {
      state.registrations.push({ name, config, },);
    },
  };
  return fake as unknown as ExtensionAPI;
}

/**
 Refresh stub that resolves immediately.

 @returns resolved promise, so a pass can await it

 @example
 ```typescript
 await noopRefresh();
 ```
 */
function noopRefresh(): Promise<void> {
  return Promise.resolve();
}

/**
 Build a catalog read over three fixture lists.
 
 @param chat - chat models to report
 
 @param images - image models to report
 
 @param classifiers - classifier models to report
 
 @returns reads the pass consumes
 */
function readOf(
  {
    chat,
    images = [],
    classifiers = [],
    registeredIds = [],
    configs = {},
  }: {
    readonly chat: readonly Model<Api>[];
    readonly images?: readonly ImageModel<ImageApi>[];
    readonly classifiers?: readonly ClassifierModel<ClassifierApi>[];
    readonly registeredIds?: readonly string[];
    readonly configs?: Readonly<Record<string, ProviderConfig>>;
  },
): CatalogRead {
  return {
    readChatModels: function readChatModels() {
      return chat;
    },
    readImageModels: function readImageModels() {
      return images;
    },
    readClassifierModels: function readClassifierModels() {
      return classifiers;
    },
    readRegisteredProviderIds: function readRegisteredProviderIds() {
      return registeredIds;
    },
    readProviderConfig: function readProviderConfig(provider,): IncumbentConfig {
      /**
       Incumbent configuration for this provider, when the fixture supplies one.
       */
      const config = configs[provider];
      if (config === undefined)
        return { kind: 'absent', };
      return {
        kind: 'present',
        config,
      };
    },
  };
}

/**
 Read the ids one registration would install.
 
 @param config - configuration a fake host recorded, absent when nothing registered
 
 @returns model ids in registration order
 */
function registeredModelIds(config: ProviderConfig,): readonly string[] {
  return (config.models ?? []).map(function toId(model,) {
    return model.id;
  },);
}

//endregion Fixtures

await describe({
  name: '',
  children: [
    describe({
      name: readsFromRegistry.name,
      children: [
        it({
          name: 'forwards every registry read',
          fn: async function runReadForwarding() {
            /**
             Chat model the fake registry reports.
             */
            const chat = chatModel({ provider: 'hyper', id: 'glm-5.3', },);
            /**
             Image model the fake registry reports.
             */
            const image = imageModel({ provider: 'hyper', id: 'flux', },);
            /**
             Classifier model the fake registry reports.
             */
            const classifier = classifierModel({ provider: 'hyper', id: 'judge', },);
            /**
             Reads adapted from three single-method fakes.
             */
            const read = readsFromRegistry({
              chatReader: {
                getAll: function getAll() {
                  return [chat];
                },
              },
              imageReader: {
                getModelsOfType: function getImages() {
                  return [image];
                },
              },
              classifierReader: {
                getModelsOfType: function getClassifiers() {
                  return [classifier];
                },
              },
              idReader: {
                getRegisteredProviderIds: function readIds() {
                  return ['hyper'];
                },
              },
              configReader: {
                getRegisteredProviderConfig: function readAbsentConfig() {
                  return undefined;
                },
              },
            },);
            expect(read.readChatModels(),).toEqual([chat],);
            expect(read.readImageModels('hyper',),).toEqual([image],);
            expect(read.readClassifierModels('hyper',),).toEqual([classifier],);
            expect(read.readRegisteredProviderIds(),).toEqual(['hyper'],);
            expect(read.readProviderConfig('hyper',),).toEqual({ kind: 'absent', },);
          },
        },),
        it({
          name: 'marks a readable incumbent configuration present',
          fn: async function runPresentConfig() {
            /**
             Incumbent configuration the fake registry returns.
             */
            const incumbent = { api: 'pi-messages', };
            /**
             Reads adapted from a registry that exposes one provider configuration.
             */
            const read = readsFromRegistry({
              chatReader: {
                getAll: function getAll() {
                  return [];
                },
              },
              imageReader: {
                getModelsOfType: function getImages() {
                  return [];
                },
              },
              classifierReader: {
                getModelsOfType: function getClassifiers() {
                  return [];
                },
              },
              idReader: {
                getRegisteredProviderIds: function readIds() {
                  return ['radius'];
                },
              },
              configReader: {
                getRegisteredProviderConfig: function readPresentConfig() {
                  return incumbent;
                },
              },
            },);
            expect(read.readProviderConfig('radius',),).toEqual({
              kind: 'present',
              config: incumbent,
            },);
          },
        },),
      ],
    },),
    describe({
      name: applyRetirements.name,
      children: [
        it({
          name: 'registers the filtered provider and logs one line per retirement',
          fn: async function runRegistration() {
            /**
             Capture arrays for this pass.
             */
            const captured = emptyCapture();
            /**
             Provider registrations the pass made.
             */
            const registrations: RecordedRegistration[] = [];
            /**
             Pass summary over one superseded pair.
             */
            const summary = await applyRetirements({
              refresh: noopRefresh,
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.2', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                ],
              },),
              registerProvider: function recordRegistration({ name, config, },) {
                registrations.push({ name, config, },);
              },
              log: fakeLog(captured,),
            },);
            expect(registrations.length,).toBe(1,);
            expect(registrations[0]?.name,).toBe('hyper',);
            expect(
              registeredModelIds(nonNullishOrThrow(registrations[0]?.config,),),
            ).toEqual([
              'glm-5.3',
            ],);
            expect(summary.registeredProviders,).toEqual(['hyper'],);
            expect(summary.retirements.length,).toBe(1,);
            expect(captured.info.length,).toBe(1,);
            expect(captured.debug.length,).toBe(1,);
            expect(captured.debug[0]?.includes('glm-5.2'),).toBe(true,);
            expect(captured.warn,).toEqual([],);
            expect(summary.liveModelRetirement,).toBe(undefined,);
          },
        },),
        it({
          name: 'warns when the session started on a retired model',
          fn: async function runLiveModelWarning() {
            /**
             Capture arrays for this pass.
             */
            const captured = emptyCapture();
            /**
             Pass summary with a live model the rule retires.
             */
            const summary = await applyRetirements({
              refresh: noopRefresh,
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.2', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                ],
              },),
              registerProvider: function discardRegistration() {},
              liveModel: { provider: 'hyper', id: 'glm-5.2', },
              log: fakeLog(captured,),
            },);
            expect(captured.warn.length,).toBe(1,);
            expect(captured.warn[0]?.includes('glm-5.3'),).toBe(true,);
            expect(summary.liveModelRetirement?.keeperId,).toBe('glm-5.3',);
          },
        },),
        it({
          name: 'stays quiet when the live model is the keeper',
          fn: async function runLiveModelKept() {
            /**
             Capture arrays for this pass.
             */
            const captured = emptyCapture();
            /**
             Pass summary with a live model the rule keeps.
             */
            const summary = await applyRetirements({
              refresh: noopRefresh,
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.2', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                ],
              },),
              registerProvider: function discardRegistration() {},
              liveModel: { provider: 'hyper', id: 'glm-5.3', },
              log: fakeLog(captured,),
            },);
            expect(captured.warn,).toEqual([],);
            expect(summary.liveModelRetirement,).toBe(undefined,);
          },
        },),
        it({
          name: 'records a provider pi refused and still filters the rest',
          fn: async function runRegistrationFailure() {
            /**
             Capture arrays for this pass.
             */
            const captured = emptyCapture();
            /**
             Provider registrations the pass made.
             */
            const registrations: RecordedRegistration[] = [];
            /**
             Pass summary where one provider throws on registration.
             */
            const summary = await applyRetirements({
              refresh: noopRefresh,
              read: readOf({
                chat: [
                  chatModel({ provider: 'azure-openai-responses', id: 'gpt-4.1', },),
                  chatModel({ provider: 'azure-openai-responses', id: 'gpt-5.5', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.2', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                ],
              },),
              registerProvider: function refusingRegistration({ name, config, },) {
                if (name === 'azure-openai-responses')
                  throw new Error('"baseUrl" is required when defining custom models',);
                registrations.push({ name, config, },);
              },
              log: fakeLog(captured,),
            },);
            expect(summary.registeredProviders,).toEqual(['hyper'],);
            expect(summary.failedProviders.length,).toBe(1,);
            expect(summary.failedProviders[0]?.provider,).toBe('azure-openai-responses',);
            expect(summary.failedProviders[0]?.reason.includes('baseUrl',),).toBe(true,);
            expect(registrations.length,).toBe(1,);
            expect(captured.warn.length,).toBe(1,);
          },
        },),
        it({
          name: 'awaits the catalog refresh before reading',
          fn: async function runRefreshOrder() {
            /**
             Order the pass touched its dependencies in.
             */
            const order: string[] = [];
            await applyRetirements({
              read: {
                readChatModels: function readChatModels() {
                  order.push('read',);
                  return [];
                },
                readImageModels: function readImageModels() {
                  return [];
                },
                readClassifierModels: function readClassifierModels() {
                  return [];
                },
                readRegisteredProviderIds: function readRegisteredProviderIds() {
                  return [];
                },
                readProviderConfig: function readProviderConfig(): IncumbentConfig {
                  return { kind: 'absent', };
                },
              },
              refresh: function recordingRefresh() {
                order.push('refresh',);
                return Promise.resolve();
              },
              registerProvider: function discardRegistration() {},
              log: fakeLog(emptyCapture(),),
            },);
            expect(order,).toEqual(['refresh', 'read'],);
          },
        },),
        it({
          name: 'keeps filtering when the catalog refresh fails',
          fn: async function runRefreshFailure() {
            /**
             Capture arrays for this pass.
             */
            const captured = emptyCapture();
            /**
             Pass summary over a refresh that rejects.
             */
            const summary = await applyRetirements({
              refresh: function failingRefresh() {
                return Promise.reject(new Error('models.json unreadable',),);
              },
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.2', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                ],
              },),
              registerProvider: function discardRegistration() {},
              log: fakeLog(captured,),
            },);
            expect(summary.registeredProviders,).toEqual(['hyper'],);
            expect(captured.warn.length,).toBe(1,);
            expect(captured.warn[0]?.includes('models.json unreadable',),).toBe(true,);
          },
        },),
        it({
          name: 'warns about a provider another extension owns natively',
          fn: async function runNativeOwnerWarning() {
            /**
             Capture arrays for this pass.
             */
            const captured = emptyCapture();
            /**
             Provider registrations the pass made.
             */
            const registrations: RecordedRegistration[] = [];
            /**
             Pass summary over a provider pi lists as extension-registered with no
             readable configuration.
             */
            const summary = await applyRetirements({
              refresh: noopRefresh,
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.2', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                ],
                registeredIds: ['hyper'],
              },),
              registerProvider: function recordRegistration({ name, config, },) {
                registrations.push({ name, config, },);
              },
              log: fakeLog(captured,),
            },);
            expect(registrations,).toEqual([],);
            expect(summary.retirements.length,).toBe(1,);
            expect(summary.skippedProviders.length,).toBe(1,);
            expect(summary.skippedProviders[0]?.provider,).toBe('hyper',);
            expect(captured.warn.length,).toBe(1,);
            expect(captured.warn[0]?.includes('native provider',),).toBe(true,);
          },
        },),
        it({
          name: 'registers nothing when no family is superseded',
          fn: async function runNoRetirement() {
            /**
             Capture arrays for this pass.
             */
            const captured = emptyCapture();
            /**
             Provider registrations the pass made.
             */
            const registrations: RecordedRegistration[] = [];
            /**
             Pass summary over two models in different families.
             */
            const summary = await applyRetirements({
              refresh: noopRefresh,
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3-flash', },),
                ],
              },),
              registerProvider: function recordRegistration({ name, config, },) {
                registrations.push({ name, config, },);
              },
              log: fakeLog(captured,),
            },);
            expect(registrations,).toEqual([],);
            expect(summary.retirements,).toEqual([],);
            expect(captured.info.length,).toBe(1,);
          },
        },),
      ],
    },),
    describe({
      name: registerModelRetirement.name,
      children: [
        it({
          name: 'registers only a session-start handler',
          fn: async function runHandlerRegistration() {
            /**
             State the fake host records into.
             */
            const state: FakeHostState = { events: [], registrations: [], };
            registerModelRetirement({ pi: fakeHost(state,), },);
            expect(state.events,).toEqual(['session_start'],);
            expect(state.registrations,).toEqual([],);
          },
        },),
        it({
          name: 'filters the catalog when the session starts',
          fn: async function runHandlerInvocation() {
            /**
             State the fake host records into.
             */
            const state: FakeHostState = { events: [], registrations: [], };
            registerModelRetirement({ pi: fakeHost(state,), },);
            /**
             Session-start context carrying a registry and a live model.
             */
            const ctx = {
              modelRegistry: {
                getAll: function getAll() {
                  return [
                    chatModel({ provider: 'hyper', id: 'glm-5.2', },),
                    chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                  ];
                },
                getModelsOfType: function getModelsOfType() {
                  return [];
                },
                refresh: noopRefresh,
                getRegisteredProviderIds: function readIds() {
                  return [];
                },
                getRegisteredProviderConfig: function readConfig() {
                  return undefined;
                },
              },
              model: chatModel({ provider: 'hyper', id: 'glm-5.3', },),
            };
            await state.handler?.({ type: 'session_start', }, ctx,);
            expect(state.registrations.length,).toBe(1,);
            expect(
              registeredModelIds(nonNullishOrThrow(state.registrations[0]?.config,),),
            ).toEqual([
              'glm-5.3',
            ],);
          },
        },),
        it({
          name: 'tolerates a session without a live model',
          fn: async function runHandlerWithoutModel() {
            /**
             State the fake host records into.
             */
            const state: FakeHostState = { events: [], registrations: [], };
            registerModelRetirement({ pi: fakeHost(state,), },);
            await state.handler?.({ type: 'session_start', }, {
              modelRegistry: {
                getAll: function getAll() {
                  return [chatModel({ provider: 'hyper', id: 'glm-5.3', },)];
                },
                getModelsOfType: function getModelsOfType() {
                  return [];
                },
                refresh: noopRefresh,
                getRegisteredProviderIds: function readIds() {
                  return [];
                },
                getRegisteredProviderConfig: function readConfig() {
                  return undefined;
                },
              },
              model: undefined,
            },);
            expect(state.registrations,).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);
