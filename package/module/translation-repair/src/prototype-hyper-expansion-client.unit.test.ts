import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { TransportExchange, } from '../dist/final/node/prototype-hyper-expansion-client.mjs';
import {
  createHyperExpansionClient,
  HyperExpansionHttpError,
} from '../dist/final/node/prototype-hyper-expansion-client.mjs';

/** Recorded whole forced-tool stream. */
const TOOL_BODY = [
  { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 1, }, }, },
  {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'tool_use', name: 'answer', input: {}, },
  },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'input_json_delta', partial_json: '{"answer":"ok"}', },
  },
  { type: 'content_block_stop', index: 0, },
  {
    type: 'message_delta',
    delta: { stop_reason: 'tool_use', },
    usage: { output_tokens: 12, },
  },
  { type: 'message_stop', },
].map(function line(event,) { return `data: ${JSON.stringify(event,)}`; },).join('\n\n',) + '\n\n';

/** Guards test answer schema. */
function isAnswer(value: unknown,): value is { readonly answer: string; } {
  return (typeof value === 'object')
    && (value !== null)
    && ('answer' in value)
    && (value.answer === 'ok');
}

await describe({
  name: createHyperExpansionClient.name,
  children: [
    it({
      name: 'sends exact unadopted model with bounded forced schema and image',
      fn: async () => {
        let exchange: TransportExchange | undefined;
        const client = createHyperExpansionClient({
          apiKey: 'private-test-key',
          models: [{ id: 'qwen3.7-plus', requestOutputTokens: 32_000, },],
          transport: async function record(value,) {
            exchange = value;
            return { status: 200, bodyText: TOOL_BODY, };
          },
        },);
        const controller = new AbortController();
        const outcome = await client.chatJson({
          modelId: 'qwen3.7-plus' as never,
          messages: [
            { role: 'system', content: 'Return answer.', },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Read page image.', },
                { type: 'image_url', image_url: { url: 'data:image/webp;base64,AA==', }, },
              ],
            },
          ],
          signal: controller.signal,
          responseFormat: {
            type: 'json_schema',
            json_schema: {
              name: 'answer',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['answer',],
                properties: { answer: { type: 'string', }, },
              },
            },
          },
          validate: isAnswer,
        },);
        expect(outcome.kind,).toBe('ok',);
        expect(exchange?.url,).toBe('https://hyper.charm.land/v1/messages',);
        const body = JSON.parse(exchange?.bodyJson ?? '{}',) as Record<string, unknown>;
        expect(body.model,).toBe('qwen3.7-plus',);
        expect(body.max_tokens,).toBe(32_000,);
        expect(body.tool_choice,).toEqual({ type: 'tool', name: 'answer', },);
        expect(JSON.stringify(body.messages,),).toContain('"media_type":"image/webp"',);
        expect(JSON.stringify(body.messages,),).toContain('"data":"AA=="',);
      },
    },),
    it({
      name: 'refuses provider error without retry',
      fn: async () => {
        let attempts = 0;
        const client = createHyperExpansionClient({
          apiKey: 'private-test-key',
          models: [{ id: 'kimi-k2.6', requestOutputTokens: 26_214, },],
          transport: async function fail() {
            attempts += 1;
            return { status: 400, bodyText: 'restricted provider detail', };
          },
        },);
        let caught: unknown;
        try {
          await client.chatJson({
            modelId: 'kimi-k2.6' as never,
            messages: [
              { role: 'system', content: 'Return answer.', },
              { role: 'user', content: 'Evaluate.', },
            ],
            signal: new AbortController().signal,
            responseFormat: {
              type: 'json_schema',
              json_schema: {
                name: 'answer',
                schema: { type: 'object', },
              },
            },
            validate: isAnswer,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(HyperExpansionHttpError,);
        expect((caught as Error).message,).not.toContain('restricted provider detail',);
        expect(attempts,).toBe(1,);
      },
    },),
  ],
},);
