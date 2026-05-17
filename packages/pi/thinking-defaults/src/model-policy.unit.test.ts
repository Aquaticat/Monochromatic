/**
 * Tests for model-id thinking policy helpers.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  getModelIdLeaf,
  getThinkingDefaultForModel,
  isGptModelId,
} from './model-policy.ts';

//region Test cases

/** Model-id leaf extraction test case. */
type LeafCase = {
  /** Input model id. */
  modelId: string;
  /** Expected final slash-delimited segment. */
  expected: string;
};

/** GPT detection test case. */
type GptCase = {
  /** Input model id. */
  modelId: string;
  /** Expected GPT-shaped status. */
  expected: boolean;
};

/** Thinking default mapping test case. */
type DefaultCase = {
  /** Input model id. */
  modelId: string;
  /** Expected thinking default. */
  expected: 'high' | 'xhigh';
};

/** Cases covering bare, slash-prefixed, mixed-case, and non-GPT ids. */
const LEAF_CASES: readonly LeafCase[] = [
  { modelId: 'gpt-5.5', expected: 'gpt-5.5', },
  { modelId: 'openai/gpt-5.4', expected: 'gpt-5.4', },
  { modelId: 'synthetic/hf:moonshotai/Kimi-K2.6', expected: 'Kimi-K2.6', },
  { modelId: 'claude-sonnet-4-5', expected: 'claude-sonnet-4-5', },
];

/** Cases covering GPT-shaped and non-GPT-shaped ids. */
const GPT_CASES: readonly GptCase[] = [
  { modelId: 'gpt-5.5', expected: true, },
  { modelId: 'openai/gpt-5.4', expected: true, },
  { modelId: 'GPT-5.5', expected: true, },
  { modelId: 'synthetic/hf:moonshotai/Kimi-K2.6', expected: false, },
  { modelId: 'synthetic/hf:zai-org/GLM-5.1', expected: false, },
  { modelId: 'claude-sonnet-4-5', expected: false, },
];

/** Cases covering target level mapping from GPT detection. */
const DEFAULT_CASES: readonly DefaultCase[] = [
  { modelId: 'gpt-5.5', expected: 'xhigh', },
  { modelId: 'openai/gpt-5.4', expected: 'xhigh', },
  { modelId: 'synthetic/hf:moonshotai/Kimi-K2.6', expected: 'high', },
  { modelId: 'claude-sonnet-4-5', expected: 'high', },
];

//endregion Test cases

await describe({
  name: '',
  children: [
    describe({
      name: getModelIdLeaf.name,
      children: LEAF_CASES.map(function createLeafCase(testCase,) {
        return it({
          name: `returns ${testCase.expected} for ${testCase.modelId}`,
          fn: async function runLeafCase() {
            expect(getModelIdLeaf({ modelId: testCase.modelId, },),).toBe(
              testCase.expected,
            );
          },
        },);
      },),
    },),
    describe({
      name: isGptModelId.name,
      children: GPT_CASES.map(function createGptCase(testCase,) {
        return it({
          name: `returns ${String(testCase.expected,)} for ${testCase.modelId}`,
          fn: async function runGptCase() {
            expect(isGptModelId({ modelId: testCase.modelId, },),).toBe(
              testCase.expected,
            );
          },
        },);
      },),
    },),
    describe({
      name: getThinkingDefaultForModel.name,
      children: DEFAULT_CASES.map(function createDefaultCase(testCase,) {
        return it({
          name: `returns ${testCase.expected} for ${testCase.modelId}`,
          fn: async function runDefaultCase() {
            expect(
              getThinkingDefaultForModel({
                model: { id: testCase.modelId, },
              },),
            ).toBe(testCase.expected,);
          },
        },);
      },),
    },),
  ],
},);
