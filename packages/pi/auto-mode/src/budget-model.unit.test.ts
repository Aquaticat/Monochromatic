/**
 * Tests for the budget model.
 *
 * Covers version extraction, cheapest model finding, and error handling.
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  extractMajorVersion,
  extractVersionNumbers,
  findCheapestInMajorVersions,
} from './budget-model-version.ts';
import { NoBudgetModelError, } from './budget-model.ts';

/** Helper to create a minimal Model for testing. */
function createModel(
  id: string,
  costInput: number,
  costOutput: number,
): Model<Api> {
  return {
    id,
    name: id,
    api: 'openai-completions' as Api,
    provider: 'test',
    baseUrl: 'https://api.test.com',
    reasoning: false,
    input: ['text',],
    cost: {
      input: costInput,
      output: costOutput,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 128_000,
    maxTokens: 4_096,
  };
}

await describe({
  name: extractMajorVersion.name,
  children: [
    it({
      name: 'extracts version from gpt-4o-mini',
      fn: async () => {
        expect(extractMajorVersion('gpt-4o-mini',),).toBe(4,);
      },
    },),

    it({
      name: 'extracts version from claude-3.5-sonnet',
      fn: async () => {
        expect(extractMajorVersion('claude-3.5-sonnet',),).toBe(3,);
      },
    },),

    it({
      name: 'skips date-like tokens',
      fn: async () => {
        // 20240101 is 8+ digits, should be skipped
        expect(extractMajorVersion('model-20240101-v2',),).toBe(2,);
      },
    },),

    it({
      name: 'returns null for no version',
      fn: async () => {
        expect(extractMajorVersion('embedding-model',),).toBeNull();
      },
    },),
  ],
},);

await describe({
  name: extractVersionNumbers.name,
  children: [
    it({
      name: 'extracts all version numbers',
      fn: async () => {
        const result = extractVersionNumbers('claude-3.5-sonnet',);
        expect(result,).toEqual([3, 5,],);
      },
    },),

    it({
      name: 'skips date-like tokens',
      fn: async () => {
        const result = extractVersionNumbers('model-20240101-v2',);
        expect(result,).toEqual([2,],);
      },
    },),
  ],
},);

await describe({
  name: findCheapestInMajorVersions.name,
  children: [
    it({
      name: 'returns models sorted by cost',
      fn: async () => {
        const models = [
          createModel('gpt-4o', 2.5, 10,),
          createModel('gpt-4o-mini', 0.15, 0.6,),
        ];
        const result = findCheapestInMajorVersions(models, 1,);
        expect(result[0]?.id,).toBe('gpt-4o-mini',);
      },
    },),

    it({
      name: 'respects majorVersions=1 (latest only)',
      fn: async () => {
        const models = [
          createModel('gpt-3.5-turbo', 0.5, 1.5,),
          createModel('gpt-4o-mini', 0.15, 0.6,),
        ];
        const result = findCheapestInMajorVersions(models, 1,);
        // Only version 4 should be included (latest major = 4)
        expect(result.every(function isV4(m: Model<Api>,) {
          return m.id.startsWith('gpt-4',);
        },),)
          .toBe(true,);
      },
    },),

    it({
      name: 'includes previous major version when majorVersions=2',
      fn: async () => {
        const models = [
          createModel('gpt-3.5-turbo', 0.5, 1.5,),
          createModel('gpt-4o-mini', 0.15, 0.6,),
        ];
        const result = findCheapestInMajorVersions(models, 2,);
        expect(result.length,).toBeGreaterThanOrEqual(2,);
      },
    },),

    it({
      name: 'returns all versions when majorVersions=0',
      fn: async () => {
        const models = [
          createModel('gpt-3.5-turbo', 0.5, 1.5,),
          createModel('gpt-4o-mini', 0.15, 0.6,),
        ];
        const result = findCheapestInMajorVersions(models, 0,);
        expect(result,).toHaveLength(2,);
      },
    },),

    it({
      name: 'returns empty array for models without versions',
      fn: async () => {
        const models = [createModel('embedding-ada', 0.1, 0.1,),];
        const result = findCheapestInMajorVersions(models, 1,);
        expect(result,).toHaveLength(0,);
      },
    },),
  ],
},);

await describe({
  name: NoBudgetModelError.name,
  children: [
    it({
      name: 'includes reason in message',
      fn: async () => {
        const error = new NoBudgetModelError('no models found',);
        expect(error.message.includes('no models found',),).toBe(true,);
        expect(error.reason,).toBe('no models found',);
      },
    },),

    it({
      name: 'includes candidate info in message',
      fn: async () => {
        const error = new NoBudgetModelError('no API key', {
          sameProvider: {
            provider: 'openai',
            modelId: 'gpt-4o-mini',
            costInput: 0.15,
            costOutput: 0.6,
            hasApiKey: false,
          },
        },);
        expect(error.message.includes('gpt-4o-mini',),).toBe(true,);
        expect(error.sameProvider?.modelId,).toBe('gpt-4o-mini',);
      },
    },),
  ],
},);
