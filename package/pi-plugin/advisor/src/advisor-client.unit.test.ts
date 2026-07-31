/**
 * Unit tests for Advisor provider client wiring.
 *
 * @module
 */

import type {
  Api,
  AssistantMessage,
  Context,
  Model,
  SimpleStreamOptions,
  ThinkingLevel,
  Usage,
} from '@earendil-works/pi-ai';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type AdvisorConfig,
  type AdvisorContext,
  completeAdvisor,
  type CompleteAdvisorModel,
  DEFAULT_CONFIG,
} from '../dist/final/node/index.mjs';

//region Constants

/** Fixture model context window. */
const CONTEXT_WINDOW = 1_000;

/** Fixture max output tokens. */
const MAX_TOKENS = 100;

/** Fixture provider timeout. */
const TIMEOUT_MS = 1_000;

/** Fixture Advisor output token budget. */
const ADVISOR_OUTPUT_TOKENS = 100;

/** Focused question fixture. */
const FOCUS_QUESTION = 'Which assumption is weakest?';

/** Provider call count expected after one no-text retry. */
const RETRY_PROVIDER_CALL_COUNT = 2;

/**
 * Build Advisor model fixture with selected reasoning capabilities.
 *
 * @param overrides - fixture identity and reasoning overrides
 *
 * @returns complete Advisor model fixture
 */
function createFixtureModel(
  overrides: Readonly<{
    id: string;
    reasoning: boolean;
    thinkingLevelMap?: Model<Api>['thinkingLevelMap'];
  }>,
): Model<Api> {
  return {
    id: overrides.id,
    name: 'Reviewer',
    api: 'faux',
    provider: 'faux-provider',
    baseUrl: 'https://example.invalid',
    reasoning: overrides.reasoning,
    ...(overrides.thinkingLevelMap
      === undefined ? {} : { thinkingLevelMap: overrides.thinkingLevelMap, }),
    input: ['text',],
    cost: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: CONTEXT_WINDOW,
    maxTokens: MAX_TOKENS,
  };
}

/** Fixture reasoning cases and highest expected simple-API effort. */
const REASONING_CASES: readonly {
  readonly name: string;
  readonly model: Model<Api>;
  readonly expectedReasoning?: ThinkingLevel;
}[] = [
  {
    name: 'omits reasoning for non-reasoning model',
    model: createFixtureModel({
      id: 'plain-reviewer',
      reasoning: false,
    },),
  },
  {
    name: 'selects high for standard reasoning model',
    model: createFixtureModel({
      id: 'standard-reviewer',
      reasoning: true,
    },),
    expectedReasoning: 'high',
  },
  {
    name: 'selects xhigh when model supports xhigh but not max',
    model: createFixtureModel({
      id: 'xhigh-reviewer',
      reasoning: true,
      thinkingLevelMap: {
        xhigh: 'xhigh',
      },
    },),
    expectedReasoning: 'xhigh',
  },
  {
    name: 'selects max when model supports max',
    model: createFixtureModel({
      id: 'max-reviewer',
      reasoning: true,
      thinkingLevelMap: {
        xhigh: 'xhigh',
        max: 'max',
      },
    },),
    expectedReasoning: 'max',
  },
];

//endregion Constants

//region Fixtures

/** Fixture usage metadata returned by fake provider. */
const usage: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
};

/** Fixture Advisor config. */
const advisorConfig: AdvisorConfig = {
  ...DEFAULT_CONFIG,
  timeoutMs: TIMEOUT_MS,
  maxAdvisorOutputTokens: ADVISOR_OUTPUT_TOKENS,
  source: {
    globalPath: '/home/test/.pi/agent/extensions/pi-advisor.json',
    projectPath: '/repo/.pi/extensions/pi-advisor.json',
    globalLoaded: false,
    projectLoaded: false,
  },
};

/** Fixture Advisor context. */
const advisorContext: AdvisorContext = {
  text: 'serialized evidence',
  maxContextChars: 1_000,
  originalChars: 19,
  finalChars: 19,
  truncated: false,
  includedMessageCount: 1,
  estimatedInputTokens: 10,
};

/** Fixture Advisor model. */
const fixtureModel: Model<Api> = createFixtureModel({
  id: 'reviewer',
  reasoning: false,
},);

/** Fixture assistant message returned by fake provider. */
const assistantMessage: AssistantMessage = {
  role: 'assistant',
  content: [{
    type: 'text',
    text: 'advisor answer',
  },],
  api: 'faux',
  provider: 'faux-provider',
  model: 'reviewer',
  usage,
  stopReason: 'stop',
  timestamp: 0,
};

/** Fixture assistant message without text content. */
const emptyAssistantMessage: AssistantMessage = {
  ...assistantMessage,
  content: [],
};

/** Fixture extension context with auth lookup. */
const extensionContext: ExtensionContext = {
  modelRegistry: {
    async getApiKeyAndHeaders() {
      return {
        ok: true,
        apiKey: 'test-key',
      };
    },
  },
} as unknown as ExtensionContext;

//endregion Fixtures

//region Helpers

/**
 * Build fake complete implementation capturing provider contexts.
 *
 * @param contexts - mutable capture sink for provider contexts
 *
 * @returns fake complete implementation
 */
function createCapturingCompleteModel(
  {
    contexts,
  }: {
    readonly contexts: Readonly<Context>[];
  },
): CompleteAdvisorModel {
  return async function completeModel(
    {
      model,
      context,
    },
  ) {
    void model;
    contexts.push(context,);
    return assistantMessage;
  };
}

/**
 * Build fake complete implementation returning responses in call order.
 *
 * @param contexts - mutable capture sink for provider contexts
 *
 * @param responses - provider responses returned in order
 *
 * @returns fake complete implementation
 */
function createSequencedCompleteModel(
  {
    contexts,
    responses,
    options,
  }: {
    readonly contexts: Readonly<Context>[];
    readonly responses: readonly AssistantMessage[];
    readonly options?: Readonly<SimpleStreamOptions>[];
  },
): CompleteAdvisorModel {
  /**
   * Queue of provider responses not yet returned.
   */
  const remainingResponses = [...responses,];
  return async function completeModel(
    {
      model,
      context,
      providerOptions,
    },
  ) {
    void model;
    contexts.push(context,);
    if (options !== undefined) {
      if (providerOptions === undefined)
        throw new Error('provider options were not supplied',);
      options.push(providerOptions,);
    }
    /**
     * Response selected for this provider invocation.
     */
    const response = remainingResponses.shift();
    if (response === undefined)
      throw new Error('fake complete was called too many times',);
    return response;
  };
}

//endregion Helpers

await describe({
  name: completeAdvisor.name,
  children: [
    ...REASONING_CASES.map(function mapReasoningCase(reasoningCase,) {
      return it({
        name: reasoningCase.name,
        fn: async function testHighestSupportedReasoning() {
          /** Captured provider contexts. */
          const contexts: Readonly<Context>[] = [];
          /** Captured simple provider options. */
          const options: Readonly<SimpleStreamOptions>[] = [];
          /** Fake complete implementation capturing provider options. */
          const completeModel = createSequencedCompleteModel({
            contexts,
            responses: [assistantMessage,],
            options,
          },);

          await completeAdvisor({
            ctx: extensionContext,
            model: reasoningCase.model,
            config: advisorConfig,
            advisorContext,
            completeModel,
          },);

          const [capturedOptions,] = options;
          if (capturedOptions === undefined)
            throw new Error('provider options were not captured',);
          expect(capturedOptions.reasoning,).toBe(
            reasoningCase.expectedReasoning,
          );
        },
      },);
    },),
    it({
      name: 'passes focused question into provider user message',
      fn: async function testFocusedQuestionProviderMessage() {
        /** Captured provider contexts. */
        const contexts: Readonly<Context>[] = [];
        /** Fake complete implementation capturing context. */
        const completeModel = createCapturingCompleteModel({ contexts, });

        await completeAdvisor({
          ctx: extensionContext,
          model: fixtureModel,
          config: advisorConfig,
          advisorContext,
          question: FOCUS_QUESTION,
          completeModel,
        },);

        const [capturedContext,] = contexts;
        if (capturedContext === undefined)
          throw new Error('fake complete was not called',);
        const [message,] = capturedContext.messages;
        if (message?.role !== 'user')
          throw new Error('captured provider message is not user message',);
        if (!Array.isArray(message.content))
          throw new Error('captured provider message has string content',);
        const [firstBlock,] = message.content;
        if (firstBlock?.type !== 'text')
          throw new Error('captured provider content is not text',);

        expect(firstBlock.text,).toContain('## Focus question',);
        expect(firstBlock.text,).toContain(FOCUS_QUESTION,);
        expect(firstBlock.text,).toContain('## Serialized conversation',);
        expect(firstBlock.text,).toContain(advisorContext.text,);
      },
    },),
    it({
      name: 'retries once when provider returns no text',
      fn: async function testNoTextRetry() {
        /** Captured provider contexts. */
        const contexts: Readonly<Context>[] = [];
        /** Captured provider options. */
        const options: Readonly<SimpleStreamOptions>[] = [];
        /** Fake complete implementation returning no text then text. */
        const completeModel = createSequencedCompleteModel({
          contexts,
          responses: [
            emptyAssistantMessage,
            assistantMessage,
          ],
          options,
        },);

        const result = await completeAdvisor({
          ctx: extensionContext,
          model: fixtureModel,
          config: advisorConfig,
          advisorContext,
          completeModel,
        },);

        expect(result,).toEqual(assistantMessage,);
        expect(contexts.length,).toBe(RETRY_PROVIDER_CALL_COUNT,);
        expect(options.length,).toBe(RETRY_PROVIDER_CALL_COUNT,);
        const [firstOptions, retryOptions,] = options;
        if ((firstOptions === undefined) || (retryOptions === undefined))
          throw new Error('provider options were not captured',);
        expect(firstOptions,).not.toBe(retryOptions,);
        expect(firstOptions.signal,).not.toBe(retryOptions.signal,);
      },
    },),
    it({
      name: 'returns no text after retry also returns no text',
      fn: async function testNoTextRetryExhausted() {
        /** Captured provider contexts. */
        const contexts: Readonly<Context>[] = [];
        /** Fake complete implementation returning no text twice. */
        const completeModel = createSequencedCompleteModel({
          contexts,
          responses: [
            emptyAssistantMessage,
            emptyAssistantMessage,
          ],
        },);

        const result = await completeAdvisor({
          ctx: extensionContext,
          model: fixtureModel,
          config: advisorConfig,
          advisorContext,
          completeModel,
        },);

        expect(result,).toEqual(emptyAssistantMessage,);
        expect(contexts.length,).toBe(RETRY_PROVIDER_CALL_COUNT,);
      },
    },),
  ],
},);
