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
  type RetirementLog,
} from './register-model-retirement.ts';

//region Fixtures

/** API type used by chat fixtures. */
const CHAT_API: Api = 'openai-completions';

/**
 * Build one chat model fixture.
 *
 * @param provider - provider id owning the model
 *
 * @param id - model id
 *
 * @returns chat model shaped like a registry read
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
    contextWindow: 128000,
    maxTokens: 4096,
  };
}

/**
 * Build one image model fixture.
 *
 * @param provider - provider id owning the model
 *
 * @param id - model id
 *
 * @returns image model shaped like a registry read
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
 * Build one classifier model fixture.
 *
 * @param provider - provider id owning the model
 *
 * @param id - model id
 *
 * @returns classifier model shaped like a registry read
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
    contextWindow: 8000,
  };
}

/** Log records captured by a fake logger. */
type CapturedLog = {
  readonly info: string[];
  readonly debug: string[];
  readonly warn: string[];
};

/**
 * Build a fake logger that captures every message.
 *
 * @param captured - arrays the fake appends to
 *
 * @returns logger surface the pass accepts
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
 * Build an empty capture triple.
 *
 * @returns fresh capture arrays
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
  handler: ((payload: unknown, ctx: unknown,) => void) | undefined;
};

/**
 * Build a fake pi host recording events and provider registrations.
 *
 * @param state - mutable state the fake writes to
 *
 * @returns fake extension API and its recorded state
 */
function fakeHost(state: FakeHostState,): ExtensionAPI {
  /**
   Object implementing only the two members this extension touches.
   */
  const fake = {
    on(
      event: string,
      handler: (payload: unknown, ctx: unknown,) => void,
    ): void {
      state.events.push(event,);
      state.handler = handler;
    },
    registerProvider(name: string, config: ProviderConfig,): void {
      state.registrations.push({ name, config, },);
    },
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fake implements only `on` and `registerProvider`, the two members `registerModelRetirement` touches
  return fake as unknown as ExtensionAPI;
}

/**
 * Build a catalog read over three fixture lists.
 *
 * @param chat - chat models to report
 *
 * @param images - image models to report
 *
 * @param classifiers - classifier models to report
 *
 * @returns reads the pass consumes
 */
function readOf(
  {
    chat,
    images = [],
    classifiers = [],
  }: {
    readonly chat: readonly Model<Api>[];
    readonly images?: readonly ImageModel<ImageApi>[];
    readonly classifiers?: readonly ClassifierModel<ClassifierApi>[];
  },
) {
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
  };
}

/**
 * Read the ids one registration would install.
 *
 * @param config - configuration a fake host recorded, absent when nothing registered
 *
 * @returns model ids in registration order
 */
function registeredIds(config: ProviderConfig | undefined,): readonly string[] {
  return (config?.models ?? []).map(function toId(model,) {
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
          name: 'forwards all three registry reads',
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
            },);
            expect(read.readChatModels(),).toEqual([chat],);
            expect(read.readImageModels('hyper',),).toEqual([image],);
            expect(read.readClassifierModels('hyper',),).toEqual([classifier],);
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
            const summary = applyRetirements({
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.2', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                ],
              },),
              registerProvider: function recordRegistration(name, config,) {
                registrations.push({ name, config, },);
              },
              liveModel: undefined,
              log: fakeLog(captured,),
            },);
            expect(registrations.length,).toBe(1,);
            expect(registrations[0]?.name,).toBe('hyper',);
            expect(registeredIds(registrations[0]?.config,),).toEqual(['glm-5.3'],);
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
            const summary = applyRetirements({
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
            const summary = applyRetirements({
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
            const summary = applyRetirements({
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3-flash', },),
                ],
              },),
              registerProvider: function recordRegistration(name, config,) {
                registrations.push({ name, config, },);
              },
              liveModel: undefined,
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
            const state: FakeHostState = { events: [], registrations: [], handler: undefined, };
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
            const state: FakeHostState = { events: [], registrations: [], handler: undefined, };
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
              },
              model: chatModel({ provider: 'hyper', id: 'glm-5.3', },),
            };
            state.handler?.({ type: 'session_start', }, ctx,);
            expect(state.registrations.length,).toBe(1,);
            expect(registeredIds(state.registrations[0]?.config,),).toEqual([
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
            const state: FakeHostState = { events: [], registrations: [], handler: undefined, };
            registerModelRetirement({ pi: fakeHost(state,), },);
            state.handler?.({ type: 'session_start', }, {
              modelRegistry: {
                getAll: function getAll() {
                  return [chatModel({ provider: 'hyper', id: 'glm-5.3', },)];
                },
                getModelsOfType: function getModelsOfType() {
                  return [];
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
