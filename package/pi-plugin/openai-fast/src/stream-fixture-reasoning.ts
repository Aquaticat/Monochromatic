/**
 Native simple reasoning cases exercise capability-driven clamping. @module
 */
import type {
  OpenAICodexResponsesOptions,
  SimpleStreamOptions,
} from '@earendil-works/pi-ai';
import type { StreamFixtureModelOverrides, } from './stream-fixture.ts';

/**
 One caller intent and expected native effort after model capability clamping.
 */
export type StreamFixtureReasoningCase = {
  readonly name: string;
  readonly reasoning?: SimpleStreamOptions['reasoning'] | 'off';
  readonly modelOverrides?: StreamFixtureModelOverrides;
  readonly effort?: OpenAICodexResponsesOptions['reasoningEffort'];
};

/**
 Cases include unrequested and runtime off intent, plus supported and clamped high levels.
 */
export const STREAM_FIXTURE_REASONING_CASES: readonly StreamFixtureReasoningCase[] = [
  { name: 'undefined remains unrequested', },
  {
    name: 'runtime off becomes undefined native effort',
    // Native JavaScript callers can supply off although simple TypeScript options exclude it.
    reasoning: 'off',
  },
  {
    name: 'high remains high',
    reasoning: 'high',
    effort: 'high',
  },
  {
    name: 'high on non-reasoning model clamps to off',
    reasoning: 'high',
    modelOverrides: { reasoning: false, },
  },
  {
    name: 'xhigh without support clamps to high',
    reasoning: 'xhigh',
    effort: 'high',
  },
  {
    name: 'supported xhigh remains xhigh',
    reasoning: 'xhigh',
    modelOverrides: { thinkingLevelMap: { xhigh: 'xhigh', }, },
    effort: 'xhigh',
  },
  {
    name: 'unsupported xhigh clamps upward to supported max',
    reasoning: 'xhigh',
    modelOverrides: {
      thinkingLevelMap: {
        xhigh: null,
        max: 'max',
      },
    },
    effort: 'max',
  },
  {
    name: 'unsupported max clamps downward to high',
    reasoning: 'max',
    effort: 'high',
  },
  {
    name: 'supported max remains max',
    reasoning: 'max',
    modelOverrides: { thinkingLevelMap: { max: 'max', }, },
    effort: 'max',
  },
];
