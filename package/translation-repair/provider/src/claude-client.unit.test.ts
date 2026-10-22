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

import {
  resetRunSpend,
  type RosterModelId,
  runSpendUsd,
} from '@monochromatic-dev/translation-repair-shared-contract';
import {
  infoLinesDuring,
  warnLinesDuring,
} from '@monochromatic-dev/translation-repair-typography/ts/console-warn-lines.test-fixture.ts';
import { rejectionOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/rejecting-call.test-fixture.ts';
import {
  exchangeFailureLogText,
  ProviderHttpError,
} from '@monochromatic-dev/translation-repair-provider-stream';
import {
  CLAUDE_PACE_WINDOW_MS,
  CLAUDE_REQUESTS_PER_MINUTE,
  createClaudeClient,
} from '../dist/final/node/index.mjs';
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
  headedReply,
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
    it({
      name: 'WRITES ONE SPEND LINE PER CALL IN USD FROM THE FOUR COUNTS, named by the card and not by the wire model: '
        + '100 plain, 50 written and 850 read prompt tokens and 10 completion tokens on a Haiku effort card are a '
        + '1,000-token prompt that cost 0.00002975, with 850 cached, and the run meter takes the same figure',
      fn: async () => {
        resetRunSpend();
        const { transport, } = scripted({
          replies: [{
            status: 200,
            bodyText: claudeStreamOf({
              text: '{"spot":"sunbeam"}',
              stopReason: 'end_turn',
              usage: { input: 100, cacheWrite: 50, cacheRead: 850, output: 10, },
            }),
          },],
        },);

        const { logged, } = await infoLinesDuring({
          run: async () =>
            await askCat({
              client: createClaudeClient({ apiKey: CLAUDE_CAT_KEY, transport, retryPolicy: ONE_QUICK_RETRY, },),
              modelId: 'claude-haiku-5-5-effort-low',
            },),
        },);

        /**
         The one SPEND line the call wrote.
         */
        const spendLines = logged.filter(function isSpend(line,): boolean {
          return line.includes('SPEND ',);
        },);
        expect(spendLines.length,).toBe(1,);
        const [line = '',] = spendLines;
        expect(line,).toContain('SPEND provider=anthropic model=claude-haiku-5-5-effort-low prompt=1000 completion=10 cost=',);
        expect(line,).toContain(' cached=850',);
        expect(Number(/ cost=(\S+)/u.exec(line,)?.[1],),).toBeCloseTo(0.00002975, 10,);
        expect(runSpendUsd({ provider: 'anthropic', },),).toBeCloseTo(0.00002975, 10,);
      },
    },),

    it({
      name: 'WRITES THE SPEND LINE OF A REFUSAL TOO, since a mid-stream decline bills the tokens it spent',
      fn: async () => {
        resetRunSpend();
        const { transport, } = scripted({
          replies: [{
            status: 200,
            bodyText: claudeStreamOf({
              text: 'The cat is on the',
              stopReason: 'refusal',
              stopDetails: { type: 'refusal', category: 'bio', explanation: 'declined', },
              usage: { input: 1_000, cacheWrite: 0, cacheRead: 0, output: 100, },
            }),
          },],
        },);

        const { logged, } = await infoLinesDuring({
          run: async () =>
            await warnLinesDuring({
              run: async () =>
                await askCat({
                  client: createClaudeClient({ apiKey: CLAUDE_CAT_KEY, transport, retryPolicy: ONE_QUICK_RETRY, },),
                  modelId: 'claude-sonnet-5-5',
                },),
            },),
        },);

        expect(logged.some(function spendOfRefusal(line,): boolean {
          return line.includes('SPEND provider=anthropic model=claude-sonnet-5-5 prompt=1000 completion=100 cost=',);
        },),).toBe(true,);
        // 1,000 plain tokens at 2 and 100 completion tokens at 10 USD a million.
        expect(runSpendUsd({ provider: 'anthropic', },),).toBeCloseTo(0.003, 10,);
      },
    },),
    it({
      name: 'LOGS THE RATE-LIMIT HEADERS ONCE, on the first reply of the run, and asks the transport for them and for '
        + 'retry-after on every exchange: the key lists 1000 requests, 2,000,000 input and 400,000 output tokens a '
        + 'minute, and a run should read its own limits off the wire rather than off a probe',
      fn: async () => {
        const { transport, exchanges, } = scripted({
          replies: [headedReply({
            bodyText: claudeStreamOf({ text: '{"spot":"sunbeam"}', stopReason: 'end_turn', usage: PLAIN_USAGE, }),
            headers: {
              'anthropic-ratelimit-requests-limit': '1000',
              'anthropic-ratelimit-requests-remaining': '999',
              'anthropic-ratelimit-input-tokens-limit': '2000000',
              'anthropic-ratelimit-output-tokens-limit': '400000',
            },
          },),],
        },);
        const client = createClaudeClient({ apiKey: CLAUDE_CAT_KEY, transport, retryPolicy: ONE_QUICK_RETRY, },);

        const { logged, } = await infoLinesDuring({
          run: async () => {
            await askCat({ client, modelId: 'claude-haiku-5-5', },);
            await askCat({ client, modelId: 'claude-haiku-5-5', },);
          },
        },);

        /**
         Lines that carry the headers.
         */
        const limitLines = logged.filter(function carriesLimits(line,): boolean {
          return line.includes('anthropic-ratelimit-',);
        },);
        expect(limitLines.length,).toBe(1,);
        const [limitLine = '',] = limitLines;
        expect(limitLine,).toContain('anthropic-ratelimit-requests-limit=1000',);
        expect(limitLine,).toContain('anthropic-ratelimit-requests-remaining=999',);
        expect(limitLine,).toContain('anthropic-ratelimit-input-tokens-limit=2000000',);
        expect(limitLine,).toContain('anthropic-ratelimit-output-tokens-limit=400000',);
        expect(limitLine,).not.toContain(CLAUDE_CAT_KEY,);
        for (const exchange of exchanges)
          expect(exchange.captureHeaders,).toEqual(['retry-after', 'anthropic-ratelimit-*',],);
      },
    },),

    it({
      name: 'PACES EVERY ATTEMPT THROUGH A REQUEST WINDOW of 1000 starts a minute, the key\'s stated rate: Haiku on the '
        + 'wide panel and the checker bench fans out hundreds of calls a run, and a window with no place left reads '
        + 'as a wait the router can see',
      fn: async () => {
        expect(CLAUDE_REQUESTS_PER_MINUTE,).toBe(1_000,);
        expect(CLAUDE_PACE_WINDOW_MS,).toBe(60_000,);
        const { transport, } = scripted({
          replies: [{
            status: 200,
            bodyText: claudeStreamOf({ text: '{"spot":"sunbeam"}', stopReason: 'end_turn', usage: PLAIN_USAGE, }),
          },],
        },);
        const client = createClaudeClient({
          apiKey: CLAUDE_CAT_KEY,
          transport,
          retryPolicy: ONE_QUICK_RETRY,
          requestsPerMinute: 2,
        },);

        expect(client.pace.waitMs(),).toBe(0,);
        await askCat({ client, modelId: 'claude-haiku-5-5', },);
        expect(client.pace.waitMs(),).toBe(0,);
        await askCat({ client, modelId: 'claude-sonnet-5-5', },);
        expect(client.pace.waitMs(),).toBeGreaterThan(0,);
      },
    },),
  ],
},);
