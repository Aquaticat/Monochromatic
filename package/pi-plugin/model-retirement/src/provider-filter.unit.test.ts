/**
 Tests for registry reads turning into provider re-registration plans.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type {
  Api,
  ClassifierApi,
  ClassifierModel,
  ImageApi,
  ImageModel,
  Model,
} from '@earendil-works/pi-ai';
import {
  planProviderFilters,
  toModelConfig,
  type CatalogRead,
} from '../dist/final/node/index.mjs';

//region Fixtures

/** API type used by chat fixtures. */
const CHAT_API: Api = 'openai-completions';

/** API type used by image fixtures. */
const IMAGE_API: ImageApi = 'openrouter-images';

/** API type used by classifier fixtures. */
const CLASSIFIER_API: ClassifierApi = 'typesafe-system-one';

/**
 Build one chat model fixture.
 
 @param provider - provider id owning the model
 
 @param id - model id
 
 @param api - API type the model is served under
 
 @param samplingParams - sampling overrides to prove optional metadata survives

 @param baseUrl - endpoint the model reports, empty to prove the planner skips it

 @returns chat model shaped like a registry read
 */
function chatModel(
  {
    provider,
    id,
    api = CHAT_API,
    samplingParams,
    baseUrl = 'https://example.invalid',
  }: {
    readonly provider: string;
    readonly id: string;
    readonly api?: Api;
    readonly samplingParams?: Record<string, unknown>;
    readonly baseUrl?: string;
  },
): Model<Api> {
  return {
    id,
    name: id,
    api,
    provider,
    baseUrl,
    input: ['text'],
    cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, },
    reasoning: true,
    contextWindow: 128_000,
    maxTokens: 4_096,
    ...(samplingParams === undefined ? {} : { samplingParams, }),
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
    api: IMAGE_API,
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
    api: CLASSIFIER_API,
    provider,
    baseUrl: 'https://example.invalid',
    input: ['text'],
    cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, },
    type: 'classifier',
    contextWindow: 8_000,
  };
}

/**
 Build the injected catalog read from three fixture lists.
 
 @param chat - chat models the registry reports
 
 @param images - image models the registry reports
 
 @param classifiers - classifier models the registry reports
 
 @returns reads the planner consumes
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
  };
}

/**
 Read the ids a plan carries, in order.
 
 @param models - configurations one plan would register
 
 @returns ids in registration order
 */
function planIds(models: readonly { readonly id: string; }[],): readonly string[] {
  return models.map(function toId(model,) {
    return model.id;
  },);
}

//endregion Fixtures

await describe({
  name: '',
  children: [
    describe({
      name: planProviderFilters.name,
      children: [
        it({
          name: 'plans only the provider that loses a model',
          fn: async function runProviderSelection() {
            /**
             Planning over one superseded pair and one unrelated model.
             */
            const planning = planProviderFilters({
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.2', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                  chatModel({ provider: 'openai', id: 'gpt-5.5', },),
                ],
              },),
            },);
            expect(planning.plans.length,).toBe(1,);
            expect(planning.plans[0]?.provider,).toBe('hyper',);
            expect(planning.retirements.length,).toBe(1,);
          },
        },),
        it({
          name: 'keeps the winner and drops the retired id',
          fn: async function runKeptModels() {
            /**
             Planning over one superseded pair.
             */
            const planning = planProviderFilters({
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.2', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                ],
              },),
            },);
            expect(planIds(planning.plans[0]?.models ?? [],),).toEqual(['glm-5.3'],);
          },
        },),
        it({
          name: 'carries image and classifier models through a filtered provider',
          fn: async function runOtherModelTypes() {
            /**
             Planning over a provider serving all three model types.
             */
            const planning = planProviderFilters({
              read: readOf({
                chat: [
                  chatModel({ provider: 'openrouter', id: 'vendor/gpt-5', },),
                  chatModel({ provider: 'openrouter', id: 'vendor/gpt-5.5', },),
                ],
                images: [imageModel({ provider: 'openrouter', id: 'vendor/flux', },)],
                classifiers: [classifierModel({ provider: 'openrouter', id: 'vendor/judge', },)],
              },),
            },);
            expect(planIds(planning.plans[0]?.models ?? [],),).toEqual([
              'vendor/gpt-5.5',
              'vendor/flux',
              'vendor/judge',
            ],);
          },
        },),
        it({
          name: 'reports the abstention it took on an unordered pair',
          fn: async function runAbstentionReporting() {
            /**
             Planning over the measured month-day against eight-digit pair.
             */
            const planning = planProviderFilters({
              read: readOf({
                chat: [
                  chatModel({ provider: 'openrouter', id: 'qwen/qwen3.5-plus-02-15', },),
                  chatModel({ provider: 'openrouter', id: 'qwen/qwen3.5-plus-20260420', },),
                ],
              },),
            },);
            expect(planning.plans,).toEqual([],);
            expect(planning.abstentions.keeperAmbiguity > 0,).toBe(true,);
          },
        },),
        it({
          name: 'skips a provider whose kept model carries no baseUrl',
          fn: async function runSkippedProvider() {
            /**
             Planning over a pair whose winner cannot be re-declared.
             */
            const planning = planProviderFilters({
              read: readOf({
                chat: [
                  chatModel({ provider: 'azure-openai-responses', id: 'gpt-4.1', },),
                  chatModel({
                    provider: 'azure-openai-responses',
                    id: 'gpt-5.5',
                    baseUrl: '',
                  },),
                ],
              },),
            },);
            expect(planning.plans,).toEqual([],);
            expect(planning.retirements.length,).toBe(1,);
            expect(planning.skippedProviders.length,).toBe(1,);
            expect(planning.skippedProviders[0]?.provider,).toBe('azure-openai-responses',);
            expect(planning.skippedProviders[0]?.reason.includes('baseUrl',),).toBe(true,);
          },
        },),
        it({
          name: 'plans nothing for a catalog with no superseded pair',
          fn: async function runEmptyPlanning() {
            /**
             Planning over two models in different families.
             */
            const planning = planProviderFilters({
              read: readOf({
                chat: [
                  chatModel({ provider: 'hyper', id: 'glm-5.3', },),
                  chatModel({ provider: 'hyper', id: 'glm-5.3-flash', },),
                ],
              },),
            },);
            expect(planning.plans,).toEqual([],);
            expect(planning.retirements,).toEqual([],);
          },
        },),
      ],
    },),
    describe({
      name: toModelConfig.name,
      children: [
        it({
          name: 'marks a chat model and keeps its sampling params',
          fn: async function runChatConfig() {
            /**
             Configuration for a chat model carrying a thinking map.
             */
            const config = toModelConfig(chatModel({
              provider: 'hyper',
              id: 'glm-5.3',
              samplingParams: { temperature: 0.5, },
            },),);
            expect(config.type ?? 'chat',).toBe('chat',);
            expect('samplingParams' in config,).toBe(true,);
          },
        },),
        it({
          name: 'marks an image model and keeps its output modalities',
          fn: async function runImageConfig() {
            /**
             Configuration for an image model.
             */
            const config = toModelConfig(imageModel({ provider: 'openrouter', id: 'vendor/flux', },),);
            expect(config.type,).toBe('image',);
            expect('output' in config,).toBe(true,);
          },
        },),
        it({
          name: 'marks a classifier model and keeps its context window',
          fn: async function runClassifierConfig() {
            /**
             Configuration for a classifier model.
             */
            const config = toModelConfig(classifierModel({
              provider: 'openrouter',
              id: 'vendor/judge',
            },),);
            expect(config.type,).toBe('classifier',);
            expect('contextWindow' in config,).toBe(true,);
          },
        },),
      ],
    },),
  ],
},);
