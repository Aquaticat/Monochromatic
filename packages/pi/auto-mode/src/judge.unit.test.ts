/**
 * Tests for the judge module.
 *
 * Covers toolChoice mapping and verdict extraction logic.
 */

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
  collectJudgeVerdictArgs,
  collectToolCall,
  extractJsonVerdict,
  parseVerdict,
} from './judge.ts';

await describe({
  name: toolChoiceForApi.name,
  children: [
    it({
      name: 'returns forced tool object for anthropic-messages',
      fn: async () => {
        const result = toolChoiceForApi('anthropic-messages',);
        expect(result,).toEqual({
          type: 'tool',
          name: 'render_verdict',
        },);
      },
    },),

    it({
      name: 'returns "required" for openai-completions',
      fn: async () => {
        expect(toolChoiceForApi('openai-completions',),).toBe('required',);
      },
    },),

    it({
      name: 'returns "required" for openai-responses',
      fn: async () => {
        expect(toolChoiceForApi('openai-responses',),).toBe('required',);
      },
    },),

    it({
      name: 'returns "required" for azure-openai-responses',
      fn: async () => {
        expect(toolChoiceForApi('azure-openai-responses',),).toBe('required',);
      },
    },),

    it({
      name: 'returns "required" for openai-codex-responses',
      fn: async () => {
        expect(toolChoiceForApi('openai-codex-responses',),).toBe('required',);
      },
    },),

    it({
      name: 'returns "any" for google-generative-ai',
      fn: async () => {
        expect(toolChoiceForApi('google-generative-ai',),).toBe('any',);
      },
    },),

    it({
      name: 'returns "any" for google-vertex',
      fn: async () => {
        expect(toolChoiceForApi('google-vertex',),).toBe('any',);
      },
    },),

    it({
      name: 'returns "any" for mistral-conversations',
      fn: async () => {
        expect(toolChoiceForApi('mistral-conversations',),).toBe('any',);
      },
    },),

    it({
      name: 'returns "any" for bedrock-converse-stream',
      fn: async () => {
        expect(toolChoiceForApi('bedrock-converse-stream',),).toBe('any',);
      },
    },),

    it({
      name: 'defaults to "any" for unknown APIs',
      fn: async () => {
        expect(toolChoiceForApi('custom-api',),).toBe('any',);
      },
    },),
  ],
},);

await describe({
  name: 'VERDICT_TOOL',
  children: [
    it({
      name: 'has name render_verdict',
      fn: async () => {
        expect(VERDICT_TOOL.name,).toBe('render_verdict',);
      },
    },),

    it({
      name: 'has description',
      fn: async () => {
        expect(VERDICT_TOOL.description.length,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'has parameters schema',
      fn: async () => {
        expect(VERDICT_TOOL.parameters,).toBeDefined();
      },
    },),
  ],
},);

await describe({
  name: extractJsonVerdict.name,
  children: [
    it({
      name: 'parses a clean JSON object',
      fn: async () => {
        const result = extractJsonVerdict('{"verdict":"approve","reason":"safe"}',);
        expect(result.verdict,).toBe('approve',);
        expect(result.reason,).toBe('safe',);
      },
    },),

    it({
      name: 'parses JSON with surrounding text',
      fn: async () => {
        const result = extractJsonVerdict(
          'Here is the verdict:\n{"verdict":"deny","reason":"dangerous"}\nthank you',
        );
        expect(result.verdict,).toBe('deny',);
      },
    },),

    it({
      name: 'respects braces inside string literals',
      fn: async () => {
        const result = extractJsonVerdict(
          '{"verdict":"deny","reason":"contains } literal","guidance":"{escape}"}',
        );
        expect(result.verdict,).toBe('deny',);
        expect(result.reason,).toBe('contains } literal',);
        expect(result.guidance,).toBe('{escape}',);
      },
    },),

    it({
      name: 'throws on text without JSON',
      fn: async () => {
        expect(() => extractJsonVerdict('no json here at all',)).toThrow();
      },
    },),
  ],
},);

await describe({
  name: collectToolCall.name,
  children: [
    it({
      name: 'concatenates text_end content across multiple blocks',
      fn: async () => {
        async function* mockStream(): AsyncIterable<unknown> {
          yield {
            type: 'text_start',
            contentIndex: 0,
            partial: {},
          };
          yield {
            type: 'text_end',
            contentIndex: 0,
            content: '{"verdict":"approve","reason":"first ',
            partial: {},
          };
          yield {
            type: 'text_start',
            contentIndex: 1,
            partial: {},
          };
          yield {
            type: 'text_end',
            contentIndex: 1,
            content: 'block","guidance":"second block"}',
            partial: {},
          };
        }
        const result = await collectToolCall(mockStream() as never,);
        expect(result.verdict,).toBe('approve',);
        expect(result.guidance,).toBe('second block',);
      },
    },),

    it({
      name: 'uses tool call when present',
      fn: async () => {
        async function* mockStream(): AsyncIterable<unknown> {
          yield {
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: {
              id: '1',
              name: 'render_verdict',
              arguments: {
                verdict: 'approve',
                reason: 'tool path',
              },
            },
            partial: {},
          };
        }
        const result = await collectToolCall(mockStream() as never,);
        expect(result.verdict,).toBe('approve',);
        expect(result.reason,).toBe('tool path',);
      },
    },),
  ],
},);

await describe({
  name: collectJudgeVerdictArgs.name,
  children: [
    it({
      name: 'uses first tool call without retrying',
      fn: async () => {
        async function* toolCallStream(): AsyncIterable<unknown> {
          yield {
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: {
              id: '1',
              name: 'render_verdict',
              arguments: {
                verdict: 'approve',
                reason: 'tool path',
              },
            },
            partial: {},
          };
        }

        function createJsonRetryStream(): AsyncIterable<unknown> {
          throw new Error('retry should not run when tool call is present',);
        }

        const result = await collectJudgeVerdictArgs({
          toolCallStream: toolCallStream() as never,
          createJsonRetryStream: createJsonRetryStream as never,
        },);
        expect(result.verdict,).toBe('approve',);
        expect(result.reason,).toBe('tool path',);
      },
    },),

    it({
      name: 'retries direct JSON when first stream has no tool call',
      fn: async () => {
        async function* firstStream(): AsyncIterable<unknown> {
          yield {
            type: 'text_end',
            contentIndex: 0,
            content: 'I did not use the tool.',
            partial: {},
          };
        }

        async function* jsonRetryStream(): AsyncIterable<unknown> {
          yield {
            type: 'text_end',
            contentIndex: 0,
            content: '{"verdict":"deny","reason":"dangerous","guidance":"use propose_trust"}',
            partial: {},
          };
        }

        function createJsonRetryStream(
          {
            firstAttemptTextContent,
          }: {
            readonly firstAttemptTextContent: string;
          },
        ): AsyncIterable<unknown> {
          expect(firstAttemptTextContent,).toBe('I did not use the tool.',);
          return jsonRetryStream();
        }

        const result = await collectJudgeVerdictArgs({
          toolCallStream: firstStream() as never,
          createJsonRetryStream: createJsonRetryStream as never,
        },);
        expect(result.verdict,).toBe('deny',);
        expect(result.guidance,).toBe('use propose_trust',);
      },
    },),

    it({
      name: 'retries direct JSON once more when retry emits no text',
      fn: async () => {
        /** Captured first-attempt text passed to each direct JSON retry. */
        const retryAttempts: string[] = [];

        async function* firstStream(): AsyncIterable<unknown> {
          yield {
            type: 'text_end',
            contentIndex: 0,
            content: 'I did not use the tool.',
            partial: {},
          };
        }

        async function* emptyJsonRetryStream(): AsyncIterable<unknown> {
          yield {
            type: 'text_end',
            contentIndex: 0,
            content: '',
            partial: {},
          };
        }

        async function* successfulJsonRetryStream(): AsyncIterable<unknown> {
          yield {
            type: 'text_end',
            contentIndex: 0,
            content: '{"verdict":"approve","reason":"second retry","guidance":""}',
            partial: {},
          };
        }

        function createJsonRetryStream(
          {
            firstAttemptTextContent,
          }: {
            readonly firstAttemptTextContent: string;
          },
        ): AsyncIterable<unknown> {
          retryAttempts.push(firstAttemptTextContent,);
          if (retryAttempts.length === 1)
            return emptyJsonRetryStream();
          if (retryAttempts.length === 2)
            return successfulJsonRetryStream();
          throw new Error('unexpected extra retry',);
        }

        const result = await collectJudgeVerdictArgs({
          toolCallStream: firstStream() as never,
          createJsonRetryStream: createJsonRetryStream as never,
        },);
        expect(result.verdict,).toBe('approve',);
        expect(result.reason,).toBe('second retry',);
        expect(retryAttempts,).toEqual([
          'I did not use the tool.',
          'I did not use the tool.',
        ],);
      },
    },),

    it({
      name: 'throws no-text error after extra direct JSON retry is also empty',
      fn: async () => {
        /** Captured first-attempt text passed to each direct JSON retry. */
        const retryAttempts: string[] = [];
        /** Error captured from the failed retry sequence. */
        const capturedErrors: unknown[] = [];

        async function* firstStream(): AsyncIterable<unknown> {
          yield {
            type: 'text_end',
            contentIndex: 0,
            content: 'I did not use the tool.',
            partial: {},
          };
        }

        async function* emptyJsonRetryStream(): AsyncIterable<unknown> {
          yield {
            type: 'text_end',
            contentIndex: 0,
            content: '',
            partial: {},
          };
        }

        function createJsonRetryStream(
          {
            firstAttemptTextContent,
          }: {
            readonly firstAttemptTextContent: string;
          },
        ): AsyncIterable<unknown> {
          retryAttempts.push(firstAttemptTextContent,);
          return emptyJsonRetryStream();
        }

        try {
          await collectJudgeVerdictArgs({
            toolCallStream: firstStream() as never,
            createJsonRetryStream: createJsonRetryStream as never,
          },);
        }
        catch (error) {
          capturedErrors.push(error,);
        }

        expect(retryAttempts,).toEqual([
          'I did not use the tool.',
          'I did not use the tool.',
        ],);
        expect(capturedErrors,).toHaveLength(1,);
        const [capturedError,] = capturedErrors;
        if (!(Error.isError(capturedError,)))
          throw new Error('expected no-text retry failure to throw Error instance',);
        expect(capturedError.message,).toBe('Judge JSON returned no text to parse',);
      },
    },),
  ],
},);

await describe({
  name: callJudge.name,
  children: [
    it({
      name: 'retries without tools and parses direct JSON',
      fn: async () => {
        /** Captured stream calls so the test can verify first-attempt and retry options. */
        const calls: {
          readonly context: unknown;
          readonly options: unknown;
        }[] = [];

        async function* firstStream(): AsyncIterable<unknown> {
          yield {
            type: 'text_end',
            contentIndex: 0,
            content: 'I did not use the tool.',
            partial: {},
          };
        }

        async function* retryStream(): AsyncIterable<unknown> {
          yield {
            type: 'text_end',
            contentIndex: 0,
            content: '{"verdict":"ask","reason":"needs user","guidance":""}',
            partial: {},
          };
        }

        const streamSimpleFns = {
          streamSimpleFn(
            this: void,
            _model: never,
            context: unknown,
            options?: unknown,
          ): AsyncIterable<unknown> {
            calls.push({
              context,
              options,
            },);
            if (calls.length === 1)
              return firstStream();
            return retryStream();
          },
        };

        const verdict = await callJudge({
          model: {
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
            contextWindow: 1,
            maxTokens: 1,
          } as never,
          auth: {
            apiKey: 'test-key',
            headers: {
              'x-test': 'yes',
            },
          },
          action: 'bash: echo hi',
          cwd: '/project',
          recentContext: '',
          trustDirectives: [],
          timeoutMs: 10_000,
          systemPrompt:
            'You MUST call the render_verdict tool to submit your evaluation. Do not respond with text; use the tool.',
          batchContext: [],
          streamSimpleFn: streamSimpleFns.streamSimpleFn as never,
        },);

        expect(verdict.verdict,).toBe('ask',);
        expect(calls,).toHaveLength(2,);

        /** First and retry stream invocations, narrowed after the length assertion above. */
        const [
          firstCall,
          retryCall,
        ] = calls;
        if ((firstCall === undefined)
          || (retryCall === undefined)) {
          throw new Error('expected first and retry stream calls',);
        }

        const firstContext = firstCall.context as {
          readonly tools?: readonly unknown[];
          readonly messages: readonly { readonly content: string; }[];
        };
        const retryContext = retryCall.context as {
          readonly tools?: readonly unknown[];
          readonly systemPrompt?: string;
          readonly messages: readonly { readonly content: string; }[];
        };
        const firstOptions = firstCall.options as Record<string, unknown>;
        const retryOptions = retryCall.options as Record<string, unknown>;

        expect(firstContext.tools,).toHaveLength(1,);
        expect(firstOptions.toolChoice,).toBe('required',);
        expect(firstOptions.apiKey,).toBe('test-key',);
        expect(retryContext.tools,).toBeUndefined();
        expect(retryOptions.toolChoice,).toBeUndefined();
        expect(retryOptions.apiKey,).toBe('test-key',);
        expect(retryContext.systemPrompt?.includes('Retry mode:',),).toBe(true,);
        expect(
          retryContext.systemPrompt?.includes(
            'For this retry, use the direct JSON transport described below.',
          ),
        ).toBe(true,);
        expect(
          retryContext.systemPrompt?.includes('Do not respond with text; use the tool.',),
        ).toBe(false,);
        expect(retryContext.messages[0]?.content.includes('I did not use the tool.',),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: parseVerdict.name,
  children: [
    it({
      name: 'passes through valid verdicts',
      fn: async () => {
        const result = parseVerdict({
          verdict: 'deny',
          reason: 'dangerous',
          guidance: 'use --dry-run first',
        },);
        expect(result.verdict,).toBe('deny',);
        expect(result.guidance,).toBe('use --dry-run first',);
      },
    },),

    it({
      name: 'fills missing fields with defaults',
      fn: async () => {
        const result = parseVerdict({},);
        expect(result.verdict,).toBe('ask',);
        expect(result.reason,).toBe('',);
        expect(result.guidance,).toBe('',);
      },
    },),

    it({
      name: 'downgrades unknown verdicts to ask',
      fn: async () => {
        const result = parseVerdict({
          verdict: 'permit',
          reason: 'n/a',
          guidance: '',
        },);
        expect(result.verdict,).toBe('ask',);
        expect(result.reason.includes('permit',),).toBe(true,);
      },
    },),
  ],
},);
