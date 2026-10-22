import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isRecord,
  mapNeuralWattModel,
  mapNeuralWattProviders,
  mapReasoningEfforts,
  neuralWattListingSnapshot,
  thinkingLevelKeyForEffort,
  NEURALWATT_API,
  NEURALWATT_API_KEY_ENV,
  NEURALWATT_BASE_URL,
  NEURALWATT_ROUTE,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  children: [
    //region External JSON narrowing

    describe({
      name: isRecord.name,
      children: [
        it({
          name: 'accepts a plain object',
          fn: async () => {
            expect(isRecord({ a: 1, },),).toBe(true,);
          },
        },),
        it({
          name: 'rejects arrays, null, and primitives',
          fn: async () => {
            expect(isRecord([1],),).toBe(false,);
            expect(isRecord(null,),).toBe(false,);
            expect(isRecord('x',),).toBe(false,);
            expect(isRecord(5,),).toBe(false,);
          },
        },),
      ],
    },),

    //endregion External JSON narrowing

    //region Effort spellings to thinking levels

    describe({
      name: thinkingLevelKeyForEffort.name,
      children: [
        ...([
          ['none', 'off',],
          ['minimal', 'minimal',],
          ['low', 'low',],
          ['medium', 'medium',],
          ['high', 'high',],
          ['xhigh', 'xhigh',],
          ['max', 'max',],
        ] as const,).map(([effort, key],) =>
          it({
            name: `maps ${effort} to ${key}`,
            fn: async () => {
              expect(thinkingLevelKeyForEffort({ effort, },),).toBe(key,);
            },
          },),
        ),
        it({
          name: 'yields nothing for a spelling it cannot express',
          fn: async () => {
            expect(thinkingLevelKeyForEffort({ effort: 'ultra', },),).toBeUndefined();
          },
        },),
      ],
    },),

    //endregion Effort spellings to thinking levels

    //region Reasoning effort declarations

    describe({
      name: mapReasoningEfforts.name,
      children: [
        it({
          name: 'declares non-reasoning when capabilities mark the model non-reasoning',
          fn: async () => {
            expect(mapReasoningEfforts({
              metadata: {
                capabilities: { reasoning: false, },
                reasoning: { supported_efforts: ['high', 'none',], },
              },
            },),).toBe(false,);
          },
        },),
        it({
          name: 'offers supported efforts each sending its own spelling',
          fn: async () => {
            expect(mapReasoningEfforts({
              metadata: {
                reasoning: { supported_efforts: ['xhigh', 'medium', 'low', 'none',], },
              },
            },),).toEqual({
              off: 'none',
              xhigh: 'xhigh',
              medium: 'medium',
              low: 'low',
            },);
          },
        },),
        it({
          name: 'omits the off level when the listing does not accept none',
          fn: async () => {
            const efforts = mapReasoningEfforts({
              metadata: {
                reasoning: { supported_efforts: ['max', 'high', 'low',], },
              },
            },);
            if (efforts === undefined || efforts === false)
              throw new Error('expected an effort dict',);
            expect(Object.hasOwn(efforts, 'off',),).toBe(false,);
            expect(efforts,).toEqual({ max: 'max', high: 'high', low: 'low', },);
          },
        },),
        it({
          name: 'skips spellings it cannot express instead of guessing',
          fn: async () => {
            expect(mapReasoningEfforts({
              metadata: {
                reasoning: { supported_efforts: ['ultra', 'high', 'none',], },
              },
            },),).toEqual({ high: 'high', off: 'none', },);
          },
        },),
        it({
          name: 'declares non-reasoning when no level beyond off is selectable',
          fn: async () => {
            expect(mapReasoningEfforts({
              metadata: { reasoning: { supported_efforts: ['none',], }, },
            },),).toBe(false,);
          },
        },),
        it({
          name: 'falls back to accepted efforts minus alias spellings',
          fn: async () => {
            expect(mapReasoningEfforts({
              metadata: {
                reasoning: {
                  accepted_efforts: ['max', 'xhigh', 'high', 'low', 'minimal', 'none',],
                  effort_aliases: { max: 'xhigh', minimal: 'low', },
                },
              },
            },),).toEqual({
              off: 'none',
              xhigh: 'xhigh',
              high: 'high',
              low: 'low',
            },);
          },
        },),
        it({
          name: 'declares non-reasoning when the alias fallback leaves only off',
          fn: async () => {
            expect(mapReasoningEfforts({
              metadata: {
                reasoning: {
                  accepted_efforts: ['max', 'none',],
                  effort_aliases: { max: 'xhigh', },
                },
              },
            },),).toBe(false,);
          },
        },),
        it({
          name: 'yields nothing when neither effort list is present',
          fn: async () => {
            expect(mapReasoningEfforts({
              metadata: { capabilities: { reasoning: true, }, },
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'yields nothing when an effort list mixes in a non-string member',
          fn: async () => {
            expect(mapReasoningEfforts({
              metadata: { reasoning: { supported_efforts: ['high', 3,], }, },
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'yields nothing when an effort list is not an array',
          fn: async () => {
            expect(mapReasoningEfforts({
              metadata: { reasoning: { supported_efforts: 'high', }, },
            },),).toBeUndefined();
          },
        },),
      ],
    },),

    //endregion Reasoning effort declarations

    //region Listing entry to model profile

    describe({
      name: mapNeuralWattModel.name,
      children: [
        it({
          name: 'maps a vision reasoning model with its disclosed limits',
          fn: async () => {
            expect(mapNeuralWattModel({
              entry: {
                id: 'qwen-3.8-27b',
                max_model_len: 262128,
                deprecated: false,
                metadata: {
                  display_name: 'Qwen 3.8 27B',
                  capabilities: { reasoning: true, vision: true, },
                  reasoning: { supported_efforts: ['xhigh', 'medium', 'low', 'none',], },
                  limits: { max_context_length: 262128, max_output_tokens: 131072, },
                },
              },
            },),).toEqual({
              id: 'qwen-3.8-27b',
              name: 'Qwen 3.8 27B',
              contextWindow: 262128,
              maxTokens: 131072,
              input: ['text', 'image',],
              reasoningEfforts: {
                off: 'none',
                xhigh: 'xhigh',
                medium: 'medium',
                low: 'low',
              },
            },);
          },
        },),
        it({
          name: 'skips an entry the listing marks deprecated',
          fn: async () => {
            expect(mapNeuralWattModel({
              entry: { id: 'gone', deprecated: true, },
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'skips an entry without an id',
          fn: async () => {
            expect(mapNeuralWattModel({
              entry: { metadata: { display_name: 'nameless', }, },
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'skips an entry whose id is empty',
          fn: async () => {
            expect(mapNeuralWattModel({ entry: { id: '', }, },),).toBeUndefined();
          },
        },),
        it({
          name: 'falls back to the entry id for the name',
          fn: async () => {
            const model = mapNeuralWattModel({ entry: { id: 'nw-small', }, },);
            if (model === undefined)
              throw new Error('expected a model profile',);
            expect(model.name,).toBe('nw-small',);
          },
        },),
        it({
          name: 'reports text input for a model the listing marks without vision',
          fn: async () => {
            const model = mapNeuralWattModel({
              entry: { id: 'm', metadata: { capabilities: { vision: false, }, }, },
            },);
            if (model === undefined)
              throw new Error('expected a model profile',);
            expect(model.input,).toEqual(['text',],);
          },
        },),
        it({
          name: 'falls back to max_model_len for the context window and leaves maxTokens unset',
          fn: async () => {
            const model = mapNeuralWattModel({
              entry: { id: 'm', max_model_len: 262128, },
            },);
            if (model === undefined)
              throw new Error('expected a model profile',);
            expect(model.contextWindow,).toBe(262128,);
            expect(Object.hasOwn(model, 'maxTokens',),).toBe(false,);
          },
        },),
        it({
          name: 'leaves the context window unset when the listing sizes nothing',
          fn: async () => {
            const model = mapNeuralWattModel({ entry: { id: 'm', }, },);
            if (model === undefined)
              throw new Error('expected a model profile',);
            expect(Object.hasOwn(model, 'contextWindow',),).toBe(false,);
          },
        },),
        it({
          name: 'leaves maxTokens unset when the listing discloses no output limit',
          fn: async () => {
            const model = mapNeuralWattModel({
              entry: {
                id: 'm',
                metadata: {
                  limits: { max_context_length: 1048560, max_output_tokens: null, },
                },
              },
            },);
            if (model === undefined)
              throw new Error('expected a model profile',);
            expect(model.contextWindow,).toBe(1048560,);
            expect(Object.hasOwn(model, 'maxTokens',),).toBe(false,);
          },
        },),
        it({
          name: 'ignores non-positive and fractional context lengths',
          fn: async () => {
            const zeroed = mapNeuralWattModel({
              entry: {
                id: 'm',
                max_model_len: 262128,
                metadata: { limits: { max_context_length: 0, }, },
              },
            },);
            const fractional = mapNeuralWattModel({
              entry: {
                id: 'm',
                max_model_len: 262128,
                metadata: { limits: { max_context_length: 1024.5, }, },
              },
            },);
            if (zeroed === undefined || fractional === undefined)
              throw new Error('expected model profiles',);
            expect(zeroed.contextWindow,).toBe(262128,);
            expect(fractional.contextWindow,).toBe(262128,);
          },
        },),
        it({
          name: 'declares non-reasoning for a model capabilities mark non-reasoning',
          fn: async () => {
            const model = mapNeuralWattModel({
              entry: {
                id: 'kimi-k3-fast',
                metadata: { capabilities: { reasoning: false, }, },
              },
            },);
            if (model === undefined)
              throw new Error('expected a model profile',);
            expect(model.reasoningEfforts,).toBe(false,);
          },
        },),
        it({
          name: 'omits reasoning efforts a reasoning-capable entry does not list',
          fn: async () => {
            const model = mapNeuralWattModel({
              entry: {
                id: 'm',
                metadata: { capabilities: { reasoning: true, }, },
              },
            },);
            if (model === undefined)
              throw new Error('expected a model profile',);
            expect(Object.hasOwn(model, 'reasoningEfforts',),).toBe(false,);
          },
        },),
        it({
          name: 'treats a non-record metadata as absent',
          fn: async () => {
            expect(mapNeuralWattModel({
              entry: { id: 'm', max_model_len: 99, metadata: 5, },
            },),).toEqual({
              id: 'm',
              name: 'm',
              contextWindow: 99,
              input: ['text',],
            },);
          },
        },),
      ],
    },),

    //endregion Listing entry to model profile

    //region Listing to provider dict

    describe({
      name: mapNeuralWattProviders.name,
      children: [
        it({
          name: 'serves one route keyed by the route constant with only serviceable models',
          fn: async () => {
            const providers = mapNeuralWattProviders({
              listing: [
                { id: 'kept', },
                { id: 'dropped', deprecated: true, },
                { metadata: { display_name: 'no id', }, },
              ],
            },);
            expect(Object.keys(providers,),).toEqual([NEURALWATT_ROUTE,],);
            expect(providers[NEURALWATT_ROUTE]?.models,).toHaveLength(1,);
            expect(providers[NEURALWATT_ROUTE]?.models?.[0]?.id,).toBe('kept',);
          },
        },),
        it({
          name: 'pins the credential, protocol, endpoint, and effort dispatch',
          fn: async () => {
            const route = mapNeuralWattProviders({ listing: [], },)[NEURALWATT_ROUTE];
            if (route === undefined)
              throw new Error('expected a route profile',);
            expect(route.apiKeyEnv,).toBe(NEURALWATT_API_KEY_ENV,);
            expect(route.api,).toBe(NEURALWATT_API,);
            expect(route.baseURL,).toBe(NEURALWATT_BASE_URL,);
            expect(route.compat?.supportsReasoningEffort,).toBe(true,);
          },
        },),
        it({
          name: 'preserves listing order across serviceable models',
          fn: async () => {
            const providers = mapNeuralWattProviders({
              listing: [{ id: 'first', }, { id: 'second', }, { id: 'third', },],
            },);
            expect(providers[NEURALWATT_ROUTE]?.models?.map((model) => model.id,),)
              .toEqual(['first', 'second', 'third',],);
          },
        },),
      ],
    },),

    //endregion Listing to provider dict

    //region Checked-in snapshot

    describe({
      name: 'neuralWattListingSnapshot',
      children: [
        it({
          name: 'maps to the full snapshot catalog',
          fn: async () => {
            const providers = mapNeuralWattProviders({
              listing: neuralWattListingSnapshot,
            },);
            expect(providers[NEURALWATT_ROUTE]?.models,).toHaveLength(27,);
          },
        },),
        it({
          name: 'sizes mimo-v2.6-pro at its disclosed context window and off-level',
          fn: async () => {
            const providers = mapNeuralWattProviders({
              listing: neuralWattListingSnapshot,
            },);
            const mimo = providers[NEURALWATT_ROUTE]?.models
              ?.find((model) => model.id === 'mimo-v2.6-pro',);
            if (mimo === undefined)
              throw new Error('expected mimo-v2.6-pro in the snapshot',);
            expect(mimo.contextWindow,).toBe(1048560,);
            expect(mimo.maxTokens,).toBe(393216,);
            expect(mimo.input,).toEqual(['text', 'image',],);
            expect(mimo.reasoningEfforts,).toEqual({ off: 'none', high: 'high', },);
          },
        },),
        it({
          name: 'keeps glm-5.3 mandatory reasoning without an off level',
          fn: async () => {
            const providers = mapNeuralWattProviders({
              listing: neuralWattListingSnapshot,
            },);
            const glm = providers[NEURALWATT_ROUTE]?.models
              ?.find((model) => model.id === 'glm-5.3',);
            if (glm === undefined)
              throw new Error('expected glm-5.3 in the snapshot',);
            expect(glm.reasoningEfforts,).toEqual({ max: 'max', high: 'high', low: 'low', },);
            expect(glm.maxTokens,).toBeUndefined();
          },
        },),
        it({
          name: 'declares kimi-k3-fast non-reasoning',
          fn: async () => {
            const providers = mapNeuralWattProviders({
              listing: neuralWattListingSnapshot,
            },);
            const fast = providers[NEURALWATT_ROUTE]?.models
              ?.find((model) => model.id === 'kimi-k3-fast',);
            if (fast === undefined)
              throw new Error('expected kimi-k3-fast in the snapshot',);
            expect(fast.reasoningEfforts,).toBe(false,);
          },
        },),
      ],
    },),

    //endregion Checked-in snapshot
  ],
},);
