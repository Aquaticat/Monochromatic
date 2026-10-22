/**
 Tests for the Claude client, the first-party route on the owner's own Claude key.

 NOTHING HERE REACHES A PROVIDER: every transport is an in-memory script, and every key is invented. The body the
 client builds is tested in `claude-body.unit.test.ts`; these cases pin what a call does around it. Fixtures are
 cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { RosterModelId, } from '@monochromatic-dev/translation-repair-shared-contract';
import { warnLinesDuring, } from '@monochromatic-dev/translation-repair-typography/ts/console-warn-lines.test-fixture.ts';
import { rejectionOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/rejecting-call.test-fixture.ts';
import {
  exchangeFailureLogText,
  ProviderHttpError,
} from '@monochromatic-dev/translation-repair-provider-stream';
import { createClaudeClient, } from '../dist/final/node/index.mjs';
import {
  askCat,
  errorChainText,
  firstBodyOf,
  ONE_QUICK_RETRY,
  scripted,
} from './direct-client.test-fixture.ts';
import {
  CLAUDE_CAT_KEY,
  claudeStreamOf,
  PLAIN_USAGE,
} from './claude-client.test-fixture.ts';

await describe({
  name: 'the Claude client',
  // SEQUENTIAL: the run spend meter is process-wide, so cases that read its change must not overlap.
  concurrency: 1,
  children: [
    it({
      name: 'ANSWERS from the text blocks of a streamed Messages reply, dropping the thinking, and posts it to the '
        + 'messages endpoint with the key in x-api-key, the API version header and the anthropic wire format',
      fn: async () => {
        const { transport, exchanges, } = scripted({
          replies: [{
            status: 200,
            bodyText: claudeStreamOf({ text: '{"spot":"sunbeam"}', stopReason: 'end_turn', usage: PLAIN_USAGE, }),
          },],
        },);

        const reply = await askCat({
          client: createClaudeClient({ apiKey: CLAUDE_CAT_KEY, transport, retryPolicy: ONE_QUICK_RETRY, },),
          modelId: 'claude-haiku-5-5',
        },);

        expect(reply.text,).toBe('{"spot":"sunbeam"}',);
        expect(reply.finishReason,).toBe('end_turn',);
        expect(reply.usage,).toEqual({ prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, },);
        expect(exchanges.length,).toBe(1,);
        const [exchange,] = exchanges;
        expect(exchange?.url,).toBe('https://api.anthropic.com/v1/messages',);
        expect(exchange?.method,).toBe('POST',);
        expect(exchange?.headers['x-api-key'],).toBe(CLAUDE_CAT_KEY,);
        expect(exchange?.headers['anthropic-version'],).toBe('2023-06-01',);
        expect(exchange?.headers['Authorization'],).toBeUndefined();
        expect(exchange?.wireFormat,).toBe('anthropic',);
        expect(firstBodyOf({ exchanges, },)['stream'],).toBe(true,);
      },
    },),

    it({
      name: 'DROPS the provider\'s words from a 401, which may echo a fragment of the key, and still fails as a 401 '
        + 'after one request',
      fn: async () => {
        const { transport, exchanges, } = scripted({
          replies: [{
            status: 401,
            bodyText: '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key ****Qx4d"}}',
          },],
        },);

        const failure: unknown = await rejectionOf(
          () =>
            askCat({
              client: createClaudeClient({ apiKey: CLAUDE_CAT_KEY, transport, retryPolicy: ONE_QUICK_RETRY, },),
              modelId: 'claude-haiku-5-5',
            },),
        );

        expect(failure,).toBeInstanceOf(ProviderHttpError,);
        expect((failure as ProviderHttpError).status,).toBe(401,);
        expect((failure as ProviderHttpError).provider,).toBe('anthropic',);
        expect(exchangeFailureLogText({ error: failure, },),).not.toContain('Qx4d',);
        expect(errorChainText({ error: failure, },),).not.toContain('Qx4d',);
        expect(exchanges.length,).toBe(1,);
      },
    },),
    it({
      name: 'REFUSES EVERY MODEL BUT THE EIGHT CLAUDE CARDS before any request is built, by a named error: the key lists '
        + 'Opus, Fable and older models, so a roster model of another provider and an Opus id both stop at the client',
      fn: async () => {
        for (const modelId of [
          'hf:moonshotai/Kimi-K3',
          'deepseek-v4.1-flash',
          'claude-opus-5-5',
          'claude-sonnet-5',
          'claude-haiku-4-5',
        ] as readonly string[]) {
          const { transport, exchanges, } = scripted({
            replies: [{
              status: 200,
              bodyText: claudeStreamOf({ text: '{"spot":"sunbeam"}', stopReason: 'end_turn', usage: PLAIN_USAGE, }),
            },],
          },);

          const failure: unknown = await rejectionOf(
            () =>
              askCat({
                client: createClaudeClient({ apiKey: CLAUDE_CAT_KEY, transport, retryPolicy: ONE_QUICK_RETRY, },),
                modelId: modelId as RosterModelId,
              },),
          );

          expect((failure as Error).name,).toBe('ClaudeModelNotServedError',);
          expect((failure as Error).message,).toContain(modelId,);
          expect((failure as Error).message,).not.toContain(CLAUDE_CAT_KEY,);
          expect(exchanges.length,).toBe(0,);
        }
      },
    },),
    it({
      name: 'ANSWERS A REFUSAL AS A REFUSAL OUTCOME AND NOT AS AN OUTAGE: stop_reason refusal is a 200, so the seat has '
        + 'no answer for that call, the partial text is discarded, the category is logged, and nothing is retried or '
        + 'thrown for the router to hold the provider out for',
      fn: async () => {
        const { transport, exchanges, } = scripted({
          replies: [{
            status: 200,
            bodyText: claudeStreamOf({
              text: 'The cat is on the',
              stopReason: 'refusal',
              stopDetails: { type: 'refusal', category: 'cyber', explanation: 'declined', },
              usage: PLAIN_USAGE,
            }),
          },],
        },);

        const { result: reply, warned, } = await warnLinesDuring({
          run: async () =>
            await askCat({
              client: createClaudeClient({ apiKey: CLAUDE_CAT_KEY, transport, retryPolicy: ONE_QUICK_RETRY, },),
              modelId: 'claude-haiku-5-5',
            },),
        },);

        expect(reply.text,).toBe('',);
        expect(reply.finishReason,).toBe('refusal',);
        expect(reply.refusal,).toContain('cyber',);
        expect(reply.usage,).toEqual({ prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, },);
        expect(exchanges.length,).toBe(1,);
        expect(warned.some(function namesCategory(line,): boolean {
          return line.includes('claude-haiku-5-5',) && line.includes('refusal',) && line.includes('cyber',);
        },),).toBe(true,);
      },
    },),

    it({
      name: 'READS A REFUSAL WITH NO CATEGORY as a refusal too, the category null being a permanent valid state, and '
        + 'hands it to the caller as the refusal-shaped outcome',
      fn: async () => {
        const { transport, exchanges, } = scripted({
          replies: [{
            status: 200,
            bodyText: claudeStreamOf({
              text: '',
              stopReason: 'refusal',
              stopDetails: { type: 'refusal', category: null, explanation: null, },
              usage: PLAIN_USAGE,
            }),
          },],
        },);

        const outcome = await createClaudeClient({ apiKey: CLAUDE_CAT_KEY, transport, retryPolicy: ONE_QUICK_RETRY, },)
          .chatJson({
            modelId: 'claude-sonnet-5-5',
            messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
            signal: new AbortController().signal,
            validate: function isSpot(value: unknown,): value is { readonly spot: string; } {
              return (typeof value) === 'object';
            },
          },);

        expect(outcome.kind,).toBe('refusal-shaped',);
        expect(exchanges.length,).toBe(1,);
      },
    },),
  ],
},);
