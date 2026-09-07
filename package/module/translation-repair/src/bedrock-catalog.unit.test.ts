/**
 * Tests for the Bedrock catalog: the four approved models, the route and the
 * terminator each was measured to answer with, the seats they stand in for
 * and the prices the ledger meters by.
 *
 * Fixtures are the catalog's own rows; no corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  BEDROCK_MANTLE_BASE_URL,
  BEDROCK_MODELS,
  BEDROCK_ONLY_ROSTER_IDS,
  bedrockChatUrlFor,
  bedrockServesLabel,
  ROSTER_MODEL_IDS,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'BEDROCK_MODELS',
  children: [
    it({
      name: 'SERVES THE FOUR MODELS THE OWNER APPROVED AND KEPT on 2026-09-07: three Gemma 4 sizes and '
        + 'gpt-oss-120b, with Claude Sonnet 5 retracted',
      fn: async () => {
        expect(Object.keys(BEDROCK_MODELS,).toSorted(),).toEqual([
          'google.gemma-4-26b-a4b',
          'google.gemma-4-31b',
          'google.gemma-4-e2b',
          'openai.gpt-oss-120b',
        ],);
        for (const info of Object.values(BEDROCK_MODELS,))
          expect(info.id,).not.toContain('claude',);
      },
    },),

    it({
      name: 'STANDS IN FOR A ROSTER SEAT ON EVERY ROW: the shared two under the other providers\' '
        + 'spellings, the Bedrock-only two under their own, and every seat is a roster id',
      fn: async () => {
        expect(BEDROCK_MODELS['google.gemma-4-26b-a4b'].sharedWith,).toBe('gemma-4-26b-a4b-it',);
        expect(BEDROCK_MODELS['openai.gpt-oss-120b'].sharedWith,).toBe('hf:openai/gpt-oss-120b',);
        for (const modelId of BEDROCK_ONLY_ROSTER_IDS)
          expect(BEDROCK_MODELS[modelId].sharedWith,).toBe(modelId,);
        for (const info of Object.values(BEDROCK_MODELS,))
          expect(ROSTER_MODEL_IDS,).toContain(info.sharedWith,);
      },
    },),

    it({
      name: 'ROUTES EACH MODEL WHERE IT WAS MEASURED TO ANSWER: Gemma 4 under /openai/v1 ending on '
        + '[DONE], gpt-oss-120b under /v1 ending on its usage chunk (probes of 2026-09-07)',
      fn: async () => {
        for (const id of ['google.gemma-4-e2b', 'google.gemma-4-31b', 'google.gemma-4-26b-a4b',] as const) {
          expect(BEDROCK_MODELS[id].route,).toBe('openai-v1',);
          expect(BEDROCK_MODELS[id].streamEnd,).toBe('done-sentinel',);
          expect(bedrockChatUrlFor({
            baseUrl: BEDROCK_MANTLE_BASE_URL,
            servedId: id,
          },),).toBe('https://bedrock-mantle.us-east-1.api.aws/openai/v1/chat/completions',);
        }
        expect(BEDROCK_MODELS['openai.gpt-oss-120b'].route,).toBe('v1',);
        expect(BEDROCK_MODELS['openai.gpt-oss-120b'].streamEnd,).toBe('usage-chunk',);
        expect(bedrockChatUrlFor({
          baseUrl: BEDROCK_MANTLE_BASE_URL,
          servedId: 'openai.gpt-oss-120b',
        },),).toBe('https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions',);
      },
    },),

    it({
      name: 'HANGS EVERY ROUTE OFF THE INJECTED HOST, so a test transport can be addressed',
      fn: async () => {
        expect(bedrockChatUrlFor({
          baseUrl: 'https://mantle.invalid',
          servedId: 'google.gemma-4-e2b',
        },),).toBe('https://mantle.invalid/openai/v1/chat/completions',);
      },
    },),

    it({
      name: 'PRICES EVERY ROW ABOVE ZERO EACH WAY, with output dearer than input as the pricing page '
        + 'reads, so the ledger never meters a call as free',
      fn: async () => {
        for (const info of Object.values(BEDROCK_MODELS,)) {
          expect(info.promptUsdPerMillion,).toBeGreaterThan(0,);
          expect(info.completionUsdPerMillion,).toBeGreaterThan(info.promptUsdPerMillion,);
        }
      },
    },),

    it({
      name: 'KEEPS PICTURES OFF EVERY ROW until a transcription through this stack is measured, as the '
        + 'OpenRouter catalog holds gemma',
      fn: async () => {
        for (const info of Object.values(BEDROCK_MODELS,))
          expect(info.readsImages,).toBe(false,);
      },
    },),

    it({
      name: 'ANSWERS for a served spelling and not for a roster or other spelling',
      fn: async () => {
        expect(bedrockServesLabel('google.gemma-4-31b',),).toBe(true,);
        expect(bedrockServesLabel('gemma-4-26b-a4b-it',),).toBe(false,);
        expect(bedrockServesLabel('anthropic.claude-sonnet-5',),).toBe(false,);
        expect(bedrockServesLabel('',),).toBe(false,);
      },
    },),
  ],
},);
