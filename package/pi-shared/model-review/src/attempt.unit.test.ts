/**
 * Built-artifact tests for structured reviewer transport.
 *
 * @module
 */

import { once, } from 'node:events';

import type {
  Api,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
  Tool,
} from '@earendil-works/pi-ai';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  extractStructuredJson,
  runStructuredReviewAttempt,
  toolChoiceForApi,
  type StructuredReviewContract,
} from '../dist/final/node/index.mjs';

/** Fixture reviewer context window. */
const CONTEXT_WINDOW = 128_000;

/** Fixture reviewer output capacity. */
const MAX_TOKENS = 16_384;

/** Test timeout that does not govern transport behavior. */
const TEST_TIMEOUT_MS = 10_000;

/**
 * Strict fixture verdict.
 *
 * @example
 * ```ts
 * const verdict: FixtureVerdict = { approved: true, feedback: 'complete' };
 * ```
 */
type FixtureVerdict = {
  /** Approval decision. */
  readonly approved: boolean;
  /** Reviewer feedback. */
  readonly feedback: string;
};

/** Fixture model consumed only by injected streams. */
const MODEL = {
  id: 'reviewer',
  name: 'Reviewer',
  api: 'openai-responses',
  provider: 'test',
  baseUrl: 'https://example.invalid',
  reasoning: false,
  input: ['text',],
  cost: {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
  },
  contextWindow: CONTEXT_WINDOW,
  maxTokens: MAX_TOKENS,
} satisfies Model<Api>;

/** Fixture structured verdict tool. */
const TOOL = {
  name: 'submit_fixture_review',
  description: 'Submit fixture review.',
  parameters: {
    type: 'object',
    properties: {
      approved: { type: 'boolean', },
      feedback: { type: 'string', },
    },
    required: ['approved', 'feedback',],
  },
} satisfies Tool;

/**
 * Strictly parse fixture verdict.
 *
 * @param value - unknown provider output
 *
 * @returns validated fixture verdict
 *
 * @throws when either required field is absent or mistyped
 *
 * @example
 * ```ts
 * parseFixtureVerdict({ approved: true, feedback: 'done' });
 * ```
 */
function parseFixtureVerdict(value: unknown,): FixtureVerdict {
  if ((value === null) || ((typeof value) !== 'object'))
    throw new Error('fixture verdict must be object',);
  if ((!('approved' in value)) || ((typeof value.approved) !== 'boolean'))
    throw new Error('fixture verdict approved must be boolean',);
  if ((!('feedback' in value)) || ((typeof value.feedback) !== 'string'))
    throw new Error('fixture verdict feedback must be string',);
  return {
    approved: value.approved,
    feedback: value.feedback,
  };
}

/** Fixture caller-owned structured contract. */
const CONTRACT: StructuredReviewContract<FixtureVerdict> = {
  toolName: TOOL.name,
  tool: TOOL,
  parse: parseFixtureVerdict,
  buildJsonRetryPrompt({ initialPrompt, firstAttemptTextContent, },) {
    return {
      systemPrompt: `${initialPrompt.systemPrompt}\nReturn direct JSON.`,
      userContent: `${initialPrompt.userContent}\nFirst response: ${firstAttemptTextContent}`,
    };
  },
};

/**
 * Build one async event stream from fixed event list.
 *
 * @param events - ordered provider events
 *
 * @returns async event stream
 *
 * @example
 * ```ts
 * eventStream([{ type: 'text_end', content: '{}', contentIndex: 0, partial: {} } as never]);
 * ```
 */
async function* eventStream(
  events: readonly AssistantMessageEvent[],
): AsyncIterable<AssistantMessageEvent> {
  for (const event of events)
    yield event;
}

/**
 * Capture async error without promise matcher indirection.
 *
 * @param action - action expected to fail
 *
 * @returns thrown value
 *
 * @example
 * ```ts
 * const error = await captureError(async () => { throw new Error('x'); });
 * ```
 */
async function captureError(action: () => Promise<unknown>,): Promise<unknown> {
  try {
    await action();
  }
  catch (error) {
    return error;
  }
  throw new Error('expected action to fail',);
}

await describe({
  name: runStructuredReviewAttempt.name,
  children: [
    it({
      name: 'returns strict verdict from forced tool',
      fn: async () => {
        /**
         * Injected provider stream returning expected tool.
         *
         * @returns forced-tool event stream
         */
        function fixtureStream(): AssistantMessageEventStream {
          return eventStream([{
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: {
              type: 'toolCall',
              id: 'review-1',
              name: TOOL.name,
              arguments: {
                approved: true,
                feedback: 'complete',
              },
            },
            partial: {} as never,
          },],) as never;
        }
        /** Parsed review verdict. */
        const verdict = await runStructuredReviewAttempt({
          model: MODEL,
          auth: {},
          prompt: {
            systemPrompt: 'Judge.',
            userContent: 'Evidence.',
          },
          contract: CONTRACT,
          timeoutMs: TEST_TIMEOUT_MS,
          stream: fixtureStream,
        },);
        expect(verdict,).toEqual({
          approved: true,
          feedback: 'complete',
        },);
      },
    },),
    it({
      name: 'rejects unexpected tool',
      fn: async () => {
        /**
         * Provider stream returning wrong tool.
         *
         * @returns unexpected-tool event stream
         */
        function wrongToolStream(): AssistantMessageEventStream {
          return eventStream([{
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: {
              type: 'toolCall',
              id: 'wrong-1',
              name: 'different_tool',
              arguments: {},
            },
            partial: {} as never,
          },],) as never;
        }
        /** Unexpected-tool failure. */
        const error = await captureError(async function runWrongTool() {
          return runStructuredReviewAttempt({
            model: MODEL,
            auth: {},
            prompt: { systemPrompt: 'Judge.', userContent: 'Evidence.', },
            contract: CONTRACT,
            timeoutMs: TEST_TIMEOUT_MS,
            stream: wrongToolStream,
          },);
        },);
        expect(error,).toBeInstanceOf(Error,);
        expect((error as Error).message,).toContain('different_tool',);
      },
    },),
    it({
      name: 'retries omitted tool with direct JSON',
      fn: async () => {
        /** Stream-call count distinguishes forced and direct transport. */
        const calls: unknown[] = [];
        /**
         * Provider stream returning omission then JSON.
         *
         * @param _model - unused fixture model
         *
         * @param context - captured provider context
         *
         * @param _options - unused provider options
         *
         * @returns reviewer event stream
         */
        function retryStream(
          _model: Model<Api>,
          context: Context,
          _options?: SimpleStreamOptions,
        ): AssistantMessageEventStream {
          calls.push(context,);
          if (calls.length === 1) {
            return eventStream([{
              type: 'text_end',
              contentIndex: 0,
              content: 'tool omitted',
              partial: {} as never,
            },],) as never;
          }
          return eventStream([{
            type: 'text_end',
            contentIndex: 0,
            content: '{"approved":false,"feedback":"missing evidence"}',
            partial: {} as never,
          },],) as never;
        }
        /** Parsed direct-JSON verdict. */
        const verdict = await runStructuredReviewAttempt({
          model: MODEL,
          auth: {},
          prompt: { systemPrompt: 'Judge.', userContent: 'Evidence.', },
          contract: CONTRACT,
          timeoutMs: TEST_TIMEOUT_MS,
          stream: retryStream,
        },);
        expect(verdict.approved,).toBe(false,);
        expect(verdict.feedback,).toBe('missing evidence',);
        expect(calls,).toHaveLength(2,);
      },
    },),
    it({
      name: 'retries direct JSON once more only after empty text',
      fn: async () => {
        /** Stream-call count across forced and direct attempts. */
        const calls: unknown[] = [];
        /**
         * Provider stream returning omitted, empty, then valid output.
         *
         * @param _model - unused fixture model
         *
         * @param context - captured provider context
         *
         * @param _options - unused provider options
         *
         * @returns reviewer event stream
         */
        function emptyRetryStream(
          _model: Model<Api>,
          context: Context,
          _options?: SimpleStreamOptions,
        ): AssistantMessageEventStream {
          calls.push(context,);
          if (calls.length < 3) {
            return eventStream([{
              type: 'text_end',
              contentIndex: 0,
              content: calls.length === 1 ? 'tool omitted' : '',
              partial: {} as never,
            },],) as never;
          }
          return eventStream([{
            type: 'text_end',
            contentIndex: 0,
            content: 'prefix {"approved":true,"feedback":"third response"} suffix',
            partial: {} as never,
          },],) as never;
        }
        /** Parsed final retry verdict. */
        const verdict = await runStructuredReviewAttempt({
          model: MODEL,
          auth: {},
          prompt: { systemPrompt: 'Judge.', userContent: 'Evidence.', },
          contract: CONTRACT,
          timeoutMs: TEST_TIMEOUT_MS,
          stream: emptyRetryStream,
        },);
        expect(verdict.feedback,).toBe('third response',);
        expect(calls,).toHaveLength(3,);
      },
    },),
    it({
      name: 'propagates timeout and caller abort signals',
      fn: async () => {
        /**
         * Provider stream that rejects only after supplied signal aborts.
         *
         * @param _model - unused fixture model
         *
         * @param _context - unused provider context
         *
         * @param options - provider options carrying attempt signal
         *
         * @returns event stream that rejects on abort
         */
        function abortingStream(
          _model: Model<Api>,
          _context: Context,
          options?: SimpleStreamOptions,
        ): AssistantMessageEventStream {
          /** Attempt signal supplied to provider. */
          const attemptAbortSignal = options?.signal;
          if (attemptAbortSignal === undefined)
            throw new Error('missing attempt signal',);
          /**
           * Narrowed attempt signal retained by nested async generator.
           */
          const signalForAttempt: AbortSignal = attemptAbortSignal;
          /**
           * Wait for attempt abort and reject stream with signal reason.
           *
           * @returns async abort-aware event stream
           */
          async function* abortAfterSignal(): AsyncIterable<AssistantMessageEvent> {
            if (!signalForAttempt.aborted)
              await once(signalForAttempt, 'abort',);
            yield {
              type: 'text_end',
              contentIndex: 0,
              content: '',
              partial: {} as never,
            };
            throw signalForAttempt.reason;
          }
          return abortAfterSignal() as never;
        }

        /** Timeout-triggered transport failure. */
        const timeoutError = await captureError(async function waitForTimeout() {
          return runStructuredReviewAttempt({
            model: MODEL,
            auth: {},
            prompt: { systemPrompt: 'Judge.', userContent: 'Evidence.', },
            contract: CONTRACT,
            timeoutMs: 1,
            stream: abortingStream,
          },);
        },);
        expect(timeoutError,).toBeDefined();

        /** Caller cancellation already active before transport. */
        const controller = new AbortController();
        controller.abort(new Error('caller cancelled review',),);
        /** Caller-abort transport failure. */
        const abortError = await captureError(async function runCallerAbort() {
          return runStructuredReviewAttempt({
            model: MODEL,
            auth: {},
            prompt: { systemPrompt: 'Judge.', userContent: 'Evidence.', },
            contract: CONTRACT,
            timeoutMs: TEST_TIMEOUT_MS,
            signal: controller.signal,
            stream: abortingStream,
          },);
        },);
        expect(abortError,).toBeInstanceOf(Error,);
        expect((abortError as Error).message,).toBe('caller cancelled review',);
      },
    },),
    it({
      name: 'rejects malformed JSON and strict contract mismatch',
      fn: async () => {
        /**
         * Malformed direct JSON provider stream.
         *
         * @returns malformed text event stream
         */
        function malformedStream(): AssistantMessageEventStream {
          return eventStream([{
            type: 'text_end',
            contentIndex: 0,
            content: 'not structured',
            partial: {} as never,
          },],) as never;
        }
        /** Malformed output failure. */
        const malformedError = await captureError(async function runMalformed() {
          return runStructuredReviewAttempt({
            model: MODEL,
            auth: {},
            prompt: { systemPrompt: 'Judge.', userContent: 'Evidence.', },
            contract: CONTRACT,
            timeoutMs: TEST_TIMEOUT_MS,
            stream: malformedStream,
          },);
        },);
        expect(malformedError,).toBeInstanceOf(Error,);

        /**
         * Contract-invalid forced-tool stream.
         *
         * @returns invalid structured event stream
         */
        function invalidContractStream(): AssistantMessageEventStream {
          return eventStream([{
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: {
              type: 'toolCall',
              id: 'invalid-1',
              name: TOOL.name,
              arguments: { approved: 'yes', feedback: 'wrong type', },
            },
            partial: {} as never,
          },],) as never;
        }
        /** Strict parser failure. */
        const contractError = await captureError(async function runInvalidContract() {
          return runStructuredReviewAttempt({
            model: MODEL,
            auth: {},
            prompt: { systemPrompt: 'Judge.', userContent: 'Evidence.', },
            contract: CONTRACT,
            timeoutMs: TEST_TIMEOUT_MS,
            stream: invalidContractStream,
          },);
        },);
        expect(contractError,).toBeInstanceOf(Error,);
        expect((contractError as Error).message,).toContain('approved must be boolean',);
      },
    },),
  ],
},);

await describe({
  name: extractStructuredJson.name,
  children: [
    it({
      name: 'preserves braces inside quoted feedback',
      fn: async () => {
        /** Parsed JSON object with brace-bearing string. */
        const parsed = extractStructuredJson(
          'prefix {"approved":true,"feedback":"keeps } and { inside"} suffix',
        ) as FixtureVerdict;
        expect(parsed.feedback,).toBe('keeps } and { inside',);
      },
    },),
  ],
},);

await describe({
  name: toolChoiceForApi.name,
  children: [
    it({
      name: 'uses caller tool name for Anthropic and required for OpenAI',
      fn: async () => {
        expect(toolChoiceForApi({ api: 'anthropic-messages', toolName: TOOL.name, },),).toEqual({
          type: 'tool',
          name: TOOL.name,
        },);
        expect(toolChoiceForApi({ api: 'openai-responses', toolName: TOOL.name, },),).toBe('required',);
      },
    },),
  ],
},);
