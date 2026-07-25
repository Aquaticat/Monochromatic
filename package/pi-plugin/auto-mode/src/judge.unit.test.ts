/**
 * Characterization tests for auto-mode adapter over shared model review.
 *
 * @module
 */

import type {
  Api,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
} from '@earendil-works/pi-ai';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  toolChoiceForApi,
  VERDICT_TOOL,
} from './judge-tool.ts';
import {
  callJudge,
  extractJsonVerdict,
  parseVerdict,
} from './judge.ts';

/** Fixture context window. */
const CONTEXT_WINDOW = 128_000;

/** Fixture model output cap. */
const MAX_TOKENS = 4_096;

/** Complete adapter-test timeout. */
const JUDGE_TIMEOUT_MS = 10_000;

/** JSON tool input carrying file content that must reach judge provider context unchanged. */
const WRITE_ACTION_INPUT_FIXTURE = `{"path":"/project/src/example.ts","content":"export const judgeCanInspectThisBody = true;\\n"}`;

/**
 * Provider API cases proving auto-mode wrapper preserves shared tool choice.
 */
const TOOL_CHOICE_CASES: readonly {
  readonly api: string;
  readonly expected: unknown;
}[] = [
  { api: 'anthropic-messages', expected: { type: 'tool', name: 'render_verdict', }, },
  { api: 'openai-completions', expected: 'required', },
  { api: 'openai-responses', expected: 'required', },
  { api: 'azure-openai-responses', expected: 'required', },
  { api: 'openai-codex-responses', expected: 'required', },
  { api: 'google-generative-ai', expected: 'any', },
  { api: 'google-vertex', expected: 'any', },
  { api: 'mistral-conversations', expected: 'any', },
  { api: 'bedrock-converse-stream', expected: 'any', },
  { api: 'custom-api', expected: 'any', },
];

/** Fixture model consumed by injected stream only. */
const MODEL = {
  id: 'test-model',
  name: 'Test model',
  api: 'openai-completions',
  provider: 'openai',
  baseUrl: 'https://example.invalid',
  reasoning: false,
  input: ['text',],
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  contextWindow: CONTEXT_WINDOW,
  maxTokens: MAX_TOKENS,
} satisfies Model<Api>;

/**
 * Captured provider call used by retry characterization.
 */
type CapturedStreamCall = {
  /** Reviewer provider context. */
  readonly context: Context;
  /** Provider options when supplied. */
  readonly options?: SimpleStreamOptions;
};

/**
 * Build async event stream from fixed events.
 *
 * @param entries - ordered provider events
 *
 * @returns async reviewer stream
 *
 * @example
 * ```ts
 * events([{ type: 'text_end', content: '{}', contentIndex: 0, partial: {} } as never]);
 * ```
 */
async function* events(
  entries: readonly AssistantMessageEvent[],
): AsyncIterable<AssistantMessageEvent> {
  for (const entry of entries)
    yield entry;
}

/**
 * Read provider-specific tool choice absent from base simple-options type.
 *
 * @param options - captured provider options
 *
 * @returns tool choice or undefined
 *
 * @example
 * ```ts
 * toolChoiceOption(options);
 * ```
 */
function toolChoiceOption(
  { options, }: Pick<CapturedStreamCall, 'options'>,
): unknown {
  if (options === undefined)
    return undefined;
  if ('toolChoice' in options)
    return options.toolChoice;
  return undefined;
}

await describe({
  name: toolChoiceForApi.name,
  children: TOOL_CHOICE_CASES.map(function toolChoiceCase(
    { api, expected, },
  ) {
    return it({
      name: `projects ${api}`,
      fn: async () => {
        /** Shared projection returned through auto-mode wrapper. */
        const result = toolChoiceForApi(api,);
        expect(result,).toEqual(expected,);
      },
    },);
  },),
},);

await describe({
  name: 'VERDICT_TOOL',
  children: [
    it({
      name: 'retains render_verdict contract',
      fn: async () => {
        expect(VERDICT_TOOL.name,).toBe('render_verdict',);
        expect(VERDICT_TOOL.description.length,).toBeGreaterThan(0,);
        expect(VERDICT_TOOL.parameters,).toBeDefined();
      },
    },),
  ],
},);

await describe({
  name: extractJsonVerdict.name,
  children: [
    it({
      name: 'parses whole and balanced JSON with quoted braces',
      fn: async () => {
        /** Whole-output JSON parse. */
        const whole = extractJsonVerdict('{"verdict":"approve","reason":"safe"}',);
        /** Balanced-object JSON parse. */
        const embedded = extractJsonVerdict(
          'prefix {"verdict":"deny","reason":"contains } literal","guidance":"{escape}"} suffix',
        );
        expect(whole.verdict,).toBe('approve',);
        expect(embedded.reason,).toBe('contains } literal',);
        expect(embedded.guidance,).toBe('{escape}',);
      },
    },),
    it({
      name: 'rejects output without JSON',
      fn: async () => {
        expect(() => extractJsonVerdict('no json here',),).toThrow();
      },
    },),
  ],
},);

await describe({
  name: parseVerdict.name,
  children: [
    it({
      name: 'retains valid, missing, and unknown verdict behavior',
      fn: async () => {
        expect(parseVerdict({
          verdict: 'deny',
          reason: 'dangerous',
          guidance: 'use dry run',
        },),).toEqual({
          verdict: 'deny',
          reason: 'dangerous',
          guidance: 'use dry run',
        },);
        expect(parseVerdict({},),).toEqual({
          verdict: 'ask',
          reason: '',
          guidance: '',
        },);
        expect(parseVerdict({
          verdict: 'permit',
          reason: 'n/a',
          guidance: '',
        },).reason,).toContain('permit',);
      },
    },),
  ],
},);

await describe({
  name: callJudge.name,
  children: [
    it({
      name: 'preserves forced-tool verdict path',
      fn: async () => {
        /**
         * Forced-tool provider fixture.
         *
         * @returns valid render_verdict event stream
         */
        function forcedToolStream(): AssistantMessageEventStream {
          return events([{
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: {
              type: 'toolCall',
              id: 'verdict-1',
              name: 'render_verdict',
              arguments: {
                verdict: 'approve',
                reason: 'safe',
                guidance: '',
              },
            },
            partial: {} as never,
          },],) as never;
        }
        /** Adapter verdict from shared forced-tool transport. */
        const verdict = await callJudge({
          model: MODEL,
          auth: { apiKey: 'test-key', },
          action: 'bash: echo hi',
          actionInput: '{"command":"echo hi"}',
          cwd: '/project',
          recentContext: '',
          trustDirectives: [],
          timeoutMs: JUDGE_TIMEOUT_MS,
          systemPrompt: 'Use render_verdict.',
          batchContext: [],
          streamSimpleFn: forcedToolStream,
        },);
        expect(verdict,).toEqual({
          verdict: 'approve',
          reason: 'safe',
          guidance: '',
        },);
      },
    },),
    it({
      name: 'includes complete write input in provider request',
      fn: async function includesCompleteWriteInputInProviderRequest(): Promise<void> {
        /** Provider contexts captured at final reviewer transport boundary. */
        const contexts: Context[] = [];
        /**
         * Forced-tool provider fixture capturing final request context.
         *
         * @param _model - Unused fixture model.
         *
         * @param context - Final provider context under test.
         *
         * @returns Valid render-verdict event stream.
         */
        function captureContextStream(
          _model: Model<Api>,
          context: Context,
        ): AssistantMessageEventStream {
          contexts.push(context,);
          return events([{
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: {
              type: 'toolCall',
              id: 'verdict-write-input',
              name: 'render_verdict',
              arguments: {
                verdict: 'approve',
                reason: 'safe',
                guidance: '',
              },
            },
            partial: {} as never,
          },],) as never;
        }

        await callJudge({
          model: MODEL,
          auth: { apiKey: 'test-key', },
          action: 'write /project/src/example.ts',
          actionInput: WRITE_ACTION_INPUT_FIXTURE,
          cwd: '/project',
          recentContext: '',
          trustDirectives: [],
          timeoutMs: JUDGE_TIMEOUT_MS,
          systemPrompt: 'Use render_verdict.',
          batchContext: [],
          streamSimpleFn: captureContextStream,
        },);

        /** Final reviewer provider context captured by fixture stream. */
        const [context,] = contexts;
        if (context === undefined)
          throw new Error('Expected reviewer provider context.',);
        /** User message sent to reviewer provider. */
        const [message,] = context.messages;
        if ((message === undefined) || ((typeof message.content) !== 'string'))
          throw new Error('Expected string reviewer user message.',);
        expect(message.content,).toContain(WRITE_ACTION_INPUT_FIXTURE,);
      },
    },),
    it({
      name: 'preserves omitted-tool direct-JSON retry prompts and options',
      fn: async () => {
        /** Captured shared transport calls. */
        const calls: CapturedStreamCall[] = [];
        /**
         * Omitted-tool then direct-JSON provider fixture.
         *
         * @param _model - unused fixture model
         *
         * @param context - captured reviewer context
         *
         * @param options - captured auth and tool-choice options
         *
         * @returns current attempt event stream
         */
        function retryStream(
          _model: Model<Api>,
          context: Context,
          options?: SimpleStreamOptions,
        ): AssistantMessageEventStream {
          calls.push({
            context,
            ...(options === undefined ? {} : { options, }),
          },);
          if (calls.length === 1) {
            return events([{
              type: 'text_end',
              contentIndex: 0,
              content: 'I did not use the tool.',
              partial: {} as never,
            },],) as never;
          }
          return events([{
            type: 'text_end',
            contentIndex: 0,
            content: '{"verdict":"ask","reason":"needs user","guidance":""}',
            partial: {} as never,
          },],) as never;
        }
        /** Adapter verdict from shared JSON retry transport. */
        const verdict = await callJudge({
          model: MODEL,
          auth: {
            apiKey: 'test-key',
            headers: { 'x-test': 'yes', },
          },
          action: 'bash: echo hi',
          actionInput: '{"command":"echo hi"}',
          cwd: '/project',
          recentContext: '',
          trustDirectives: [],
          timeoutMs: JUDGE_TIMEOUT_MS,
          systemPrompt: 'You MUST call the render_verdict tool to submit your evaluation. Do not respond with text; use the tool.',
          batchContext: [],
          streamSimpleFn: retryStream,
        },);
        expect(verdict.verdict,).toBe('ask',);
        expect(calls,).toHaveLength(2,);
        /** Forced-tool and direct-JSON retry calls in transport order. */
        const [first, retry,] = calls;
        if ((first === undefined) || (retry === undefined))
          throw new Error('expected forced and retry calls',);
        expect(first.context.tools,).toHaveLength(1,);
        expect(toolChoiceOption(first,),).toBe('required',);
        expect(first.options?.apiKey,).toBe('test-key',);
        expect(retry.context.tools,).toBeUndefined();
        expect(toolChoiceOption(retry,),).toBeUndefined();
        expect(retry.context.systemPrompt,).toContain('Retry mode:',);
        expect(retry.context.systemPrompt,).not.toContain('Do not respond with text; use the tool.',);
      },
    },),
  ],
},);
