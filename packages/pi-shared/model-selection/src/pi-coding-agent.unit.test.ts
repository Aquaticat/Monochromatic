/**
 * Unit tests for optional pi-coding-agent wrappers.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import { estimateAdvisorInputTokens, } from './pi-coding-agent.ts';

await describe({
  name: estimateAdvisorInputTokens.name,
  children: [
    it({
      name: 'returns a positive token estimate for Advisor-shaped input',
      fn: async function testEstimateAdvisorInputTokens() {
        expect(estimateAdvisorInputTokens({
          systemPrompt: 'review carefully',
          contextText: 'hello world',
        },),)
          .toBeGreaterThan(0,);
      },
    },),
  ],
},);
