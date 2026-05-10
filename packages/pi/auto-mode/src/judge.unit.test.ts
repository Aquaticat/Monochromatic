/**
 * Tests for the judge module.
 *
 * Covers toolChoice mapping and verdict extraction logic.
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  toolChoiceForApi,
  VERDICT_TOOL,
} from './judge-tool.ts';
import {
  collectToolCall,
  extractJsonVerdict,
  parseVerdict,
} from './judge.ts';

await describe({
  name: 'toolChoiceForApi',
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
  name: 'extractJsonVerdict',
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
  name: 'collectToolCall',
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
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test mock matches AssistantMessageEvent shape
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
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test mock matches AssistantMessageEvent shape
        const result = await collectToolCall(mockStream() as never,);
        expect(result.verdict,).toBe('approve',);
        expect(result.reason,).toBe('tool path',);
      },
    },),
  ],
},);

await describe({
  name: 'parseVerdict',
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
