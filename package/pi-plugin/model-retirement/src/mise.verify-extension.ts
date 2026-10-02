/**
 Verifies the built model-retirement extension registers and filters as designed.

 Runs against `dist/final/node/index.mjs`, the artifact pi loads, so a build that
 drops the handler or the type-aware model mapping fails here rather than in a live
 session.

 @module
 */

import type {
  ExtensionAPI,
  ExtensionFactory,
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
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

//region Constants

/**
 Built extension path pi consumes.
 */
const BUILT_EXTENSION_PATH = '../dist/final/node/index.mjs';

/**
 Provider the fixture catalog uses.
 */
const FIXTURE_PROVIDER = 'hyper';

/**
 Id the rule must retire in the fixture catalog.
 */
const RETIRED_MODEL_ID = 'glm-5.2';

/**
 Id the rule must keep in the fixture catalog.
 */
const KEPT_MODEL_ID = 'glm-5.3';

/**
 Image model the fixture catalog carries, which must survive re-registration.
 */
const IMAGE_MODEL_ID = 'flux';

/**
 Classifier model the fixture catalog carries, which must survive re-registration.
 */
const CLASSIFIER_MODEL_ID = 'judge';

//endregion Constants

//region Types

/**
 Built model-retirement extension module shape.
 */
type ModelRetirementModule = {
  /**
   Pi extension factory.
   */
  readonly default: ExtensionFactory;
};

/**
 Registration recorded by the fake host.
 */
type RecordedRegistration = {
  readonly name: string;
  readonly config: ProviderConfig;
};

/**
 State the fake host accumulates.
 */
type HarnessState = {
  readonly events: string[];
  readonly registrations: RecordedRegistration[];
  handler?: (
    payload: unknown,
    ctx: unknown,
  ) => Promise<void>;
};

//endregion Types

//region Fixtures

/**
 Build one chat model fixture for the fake registry.
 
 @param id - model id
 
 @returns chat model shaped like a registry read
 */
function chatModel(id: string,): Model<Api> {
  return {
    id,
    name: id,
    api: 'openai-completions',
    provider: FIXTURE_PROVIDER,
    baseUrl: 'https://example.invalid',
    input: ['text'],
    cost: {
      input: 1,
      output: 2,
      cacheRead: 0,
      cacheWrite: 0,
    },
    reasoning: true,
    contextWindow: 128_000,
    maxTokens: 4_096,
  };
}

/**
 Chat models the fixture registry reports, one retired and one kept.

 @returns chat models in registry order
 */
function fixtureChatModels(): Model<Api>[] {
  return [
    chatModel(RETIRED_MODEL_ID,),
    chatModel(KEPT_MODEL_ID,),
  ];
}

/**
 Image model the fixture registry reports, which must survive re-registration.

 @returns image model fixture
 */
function fixtureImageModel(): ImageModel<ImageApi> {
  return {
    id: IMAGE_MODEL_ID,
    name: IMAGE_MODEL_ID,
    api: 'openrouter-images',
    provider: FIXTURE_PROVIDER,
    baseUrl: 'https://example.invalid',
    input: [
      'text',
      'image',
    ],
    cost: {
      input: 1,
      output: 2,
      cacheRead: 0,
      cacheWrite: 0,
    },
    type: 'image',
    output: ['image'],
  };
}

/**
 Classifier model the fixture registry reports, which must survive re-registration.

 @returns classifier model fixture
 */
function fixtureClassifierModel(): ClassifierModel<ClassifierApi> {
  return {
    id: CLASSIFIER_MODEL_ID,
    name: CLASSIFIER_MODEL_ID,
    api: 'typesafe-system-one',
    provider: FIXTURE_PROVIDER,
    baseUrl: 'https://example.invalid',
    input: ['text'],
    cost: {
      input: 1,
      output: 2,
      cacheRead: 0,
      cacheWrite: 0,
    },
    type: 'classifier',
    contextWindow: 8_000,
  };
}

/**
 Read the non-chat models the fixture registry reports for one type.

 @param type - model type the registry was asked for

 @returns image models for `image`, classifier models for anything else
 */
function fixtureModelsOfType(
  type: string,
): readonly (ImageModel<ImageApi> | ClassifierModel<ClassifierApi>)[] {
  if (type === 'image')
    return [fixtureImageModel(),];
  return [fixtureClassifierModel(),];
}

/**
 Refresh stub standing in for pi's asynchronous `models.json` reload.

 @returns resolved promise, so the pass can await it

 @example
 ```typescript
 await fixtureRefresh();
 ```
 */
function fixtureRefresh(): Promise<unknown> {
  return Promise.resolve({
    aborted: false,
    errors: new Map(),
  },);
}

/**
 Build the session-start context the handler receives.

 @returns context carrying a fixture registry and no live model
 */
function fixtureContext(): unknown {
  return {
    modelRegistry: {
      getAll: fixtureChatModels,
      getModelsOfType: fixtureModelsOfType,
      refresh: fixtureRefresh,
    },
    model: undefined,
  };
}

/**
 Build the fake host and its recorded state.
 
 @param state - state the fake writes to
 
 @returns fake extension API implementing only what this extension touches
 */
function fakeHost(state: HarnessState,): ExtensionAPI {
  /**
   Object implementing `on` and `registerProvider`.
   */
  const fake = {
    on(
      event: string,
      handler: (
        payload: unknown,
        ctx: unknown,
      ) => Promise<void>,
    ): void {
      state.events
        .push(event,);
      state.handler = handler;
    },
    registerProvider(
      name: string,
      config: ProviderConfig,
    ): void {
      state.registrations
        .push({
          name,
          config,
        },);
    },
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the verifier implements only the two members the built extension touches
  return fake as unknown as ExtensionAPI;
}

/**
 Read the ids one registration carries.
 
 @param config - recorded provider configuration, owned by pi

 @returns model ids in registration order
 */
function registeredIds(config: ForeignBorrowed<ProviderConfig>,): string[] {
  return (config.models ?? []).map(function toId(model,) {
    return model.id;
  },);
}

//endregion Fixtures

//region Verification

/**
 Test whether an imported module is this extension's built shape.
 
 @param mod - value the dynamic import returned
 
 @returns whether the module exports a default factory
 */
function isModelRetirementModule(mod: unknown,): mod is ModelRetirementModule {
  return ((typeof mod) === 'object') && (mod !== null)
    && ((typeof (mod as { readonly default?: unknown; }).default) === 'function');
}

/**
 Verify the built artifact end to end against a fake host.
 
 @returns verification result text
 
 @throws when the artifact exports no factory, registers unexpected events, or
 re-registers a provider list that lost a model or a model type
 
 @example
 ```typescript
 console.log(await verifyBuiltExtension());
 ```
 */
async function verifyBuiltExtension(): Promise<string> {
  /**
   Built extension module imported through package output.
   */
  const mod: unknown = await import(BUILT_EXTENSION_PATH);
  if (!isModelRetirementModule(mod,))
    throw new Error('built model-retirement extension does not export a default factory',);
  /**
   State the fake host records into.
   */
  const state: HarnessState = {
    events: [],
    registrations: [],
  };
  await mod.default(fakeHost(state,),);
  if ((state.events
    .length
    !== 1) || (state.events[0] !== 'session_start'))
    throw new Error(`built extension must register only session_start, saw ${state.events
      .join(', ')}`,);
  if (state.registrations
    .length
    > 0)
    throw new Error('factory must not register providers before a session starts',);
  if (state.handler === undefined)
    throw new Error('built extension did not capture its session_start handler',);
  await state.handler(
    { type: 'session_start', },
    fixtureContext(),
  );
  /**
   Registration count after the handler ran, read into a fresh binding because the
   pre-handler check narrowed the array length to zero.
   */
  const registrationCount: number = state.registrations
    .length;
  if (registrationCount !== 1)
    throw new Error(`session start must re-register one provider, saw ${String(registrationCount,)}`,);
  /**
   Only registration the pass made.
   */
  const registration = nonNullishOrThrow(state.registrations[0],);
  if (registration.name !== FIXTURE_PROVIDER)
    throw new Error(`session start must re-register ${FIXTURE_PROVIDER}, saw ${registration.name}`,);
  /**
   Ids the registration carries.
   */
  const ids = registeredIds(registration.config,);
  if (ids.length === 0)
    throw new Error('a registration must never carry an empty model list',);
  if (ids.includes(RETIRED_MODEL_ID,))
    throw new Error(`registration still carries retired ${RETIRED_MODEL_ID}`,);
  for (const required of [
    KEPT_MODEL_ID,
    IMAGE_MODEL_ID,
    CLASSIFIER_MODEL_ID,
  ]) {
    if (!ids.includes(required,))
      throw new Error(`registration lost ${required}; image and classifier models must pass through`,);
  }
  return `model-retirement extension verified: session_start only, ${FIXTURE_PROVIDER} re-registered as ${ids.join(', ')}`;
}

console.log(await verifyBuiltExtension(),);

//endregion Verification
