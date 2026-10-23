/**
 Tests for the spend guard of the editor fidelity probe: what one call can cost at most, and the wrapper that refuses a
 call, and ends the arm, once the spend on the run meter plus that call's ceiling would pass `--max-usd`.

 The guard reads what the Claude client reports. Every priced reply and every attempt the client abandoned is a SPEND
 line that moves the run meter, so the cases here make their scripted clients write the meter as the client does. A call
 that throws, and a reply with no usage, wrote nothing a meter could hold, and the guard counts each at the call's
 ceiling by a SPEND line of its own, so the identity the read step checks (the sum of the arm's SPEND lines is the
 guard's total) holds by construction.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChatTextReply,
  createClaudeClient,
  type ModelClient,
} from '@monochromatic-dev/translation-repair-provider';
import { ProviderHttpError, } from '@monochromatic-dev/translation-repair-provider-stream';
import { StatedRefusalError, } from '@monochromatic-dev/translation-repair-glossary';
import {
  noteRunSpend,
  resetRunSpend,
  runSpendUsd,
} from '@monochromatic-dev/translation-repair-shared-contract';
import { infoLinesDuring, } from '@monochromatic-dev/translation-repair-typography/ts/console-warn-lines.test-fixture.ts';
import { anthropicFrameOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/anthropic-frames.test-fixture.ts';
import {
  CLAUDE_CAT_KEY,
  claudeStreamOf,
  PLAIN_USAGE,
} from '@monochromatic-dev/translation-repair-provider/ts/claude-client.test-fixture.ts';
import {
  ONE_QUICK_RETRY,
  scripted,
} from '@monochromatic-dev/translation-repair-provider/ts/direct-client.test-fixture.ts';
import {
  callCeilingUsd,
  guardLine,
  guardTotalLine,
  pricesOf,
  spendGuardedClient,
} from '../../dist/final/node/index.mjs';
import {
  HAIKU_CARD,
  LOW_CARD,
} from '../editor-fidelity.test-fixture.ts';

/**
 Usage a reply reports.
 */
type CompletionUsage = NonNullable<ChatTextReply['usage']>;

/**
 What a scripted reply reports, whose cost the scripted client puts on the meter itself: a thousand prompt tokens and
 ten thousand completion tokens.
 */
const REPORTED: CompletionUsage = {
  prompt_tokens: 1_000,
  completion_tokens: 10_000,
};

/**
 What one reported reply costs on the meter: (1000 x 2.5 + 10000 x 10) / 1e6 USD at the Sonnet prices.
 */
const REPLY_USD = 0.1025;

/**
 One user message of a thousand characters, which a Sonnet call can cost at most (1000 x 2 + 32000 x 10) / 1e6 =
 0.322 USD.
 */
const THOUSAND_CHARS = [{ role: 'user', content: 'x'.repeat(1_000,), },] as const;

/**
 What a scripted client does on each call, besides answering.

 @example
 ```ts
 const script: ClientScript = { asked: [], pricedUsd: 0.1025, reportsUsage: true, };
 ```
 */
type ClientScript = {
  /**
   Array each exchange's model id is appended to.
   */
  readonly asked: string[];

  /**
   Dollars the client puts on the meter for each reply it gives, as the Claude client's SPEND line does; absent for a
   client that writes no line.
   */
  readonly pricedUsd?: number;

  /**
   Dollars of each attempt the client abandoned before it answered, written to the meter first, in order.
   */
  readonly abandonedUsd?: readonly number[];

  /**
   Whether the reply reports its tokens.
   */
  readonly reportsUsage: boolean;
};

/**
 Puts what the script says on the meter, the way the client's SPEND lines do.

 @param script - what the client does

 @example
 ```ts
 writeMeter({ script, },);
 ```
 */
function writeMeter({ script, }: { readonly script: ClientScript; },): void {
  for (const abandoned of script.abandonedUsd ?? [])
    noteRunSpend({ provider: 'anthropic', costUsd: abandoned, },);
  if (script.pricedUsd !== undefined)
    noteRunSpend({ provider: 'anthropic', costUsd: script.pricedUsd, },);
}

/**
 Client that records the model of every exchange, writes the meter as a Claude client does, and answers.

 @param script - what the client does on each call

 @returns The inner client the guard wraps

 @example
 ```ts
 const inner = scriptedClient({ script: { asked: [], pricedUsd: REPLY_USD, reportsUsage: true, }, },);
 ```
 */
function scriptedClient({ script, }: { readonly script: ClientScript; },): ModelClient {
  return {
    chatText: (request,): Promise<ChatTextReply> => {
      script.asked.push(request.modelId,);
      writeMeter({ script, },);
      return Promise.resolve({
        text: 'meow',
        ...(script.reportsUsage ? { usage: REPORTED, } : {}),
      },);
    },
    chatJson: <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      script.asked.push(request.modelId,);
      writeMeter({ script, },);
      return Promise.resolve({
        kind: 'ok',
        value: { edits: [], } as ValueT,
        rawText: '{"edits":[]}',
        ...(script.reportsUsage ? { usage: REPORTED, } : {}),
      },);
    },
    quotas: () => Promise.reject(new Error('quotas unused',),),
  };
}

/**
 Asks the guarded client one JSON exchange of a thousand characters.

 @param client - the guarded client

 @param modelId - model named

 @param signal - the arm's signal

 @returns The outcome the client gives

 @example
 ```ts
 await askJson({ client, modelId: LOW_CARD, signal, },);
 ```
 */
function askJson(
  {
    client,
    modelId,
    signal,
  }: {
    readonly client: ModelClient;
    readonly modelId: ChatJsonRequest<unknown>['modelId'];
    readonly signal: AbortSignal;
  },
): Promise<ChatJsonOutcome<unknown>> {
  return client.chatJson({
    modelId,
    messages: THOUSAND_CHARS,
    signal,
    validate: (value: unknown,): value is unknown => value !== undefined,
  },);
}

/**
 What asking raised, caught so a case can read it.

 @param ask - the exchange

 @returns The raised value, or undefined when the exchange completed

 @example
 ```ts
 const raised = await raisedBy({ ask: () => askJson({ client, modelId, signal, },), },);
 ```
 */
async function raisedBy({ ask, }: { readonly ask: () => Promise<unknown>; },): Promise<unknown> {
  try {
    await ask();
  }
  catch (error) {
    return error;
  }
  return undefined;
}

/**
 Client over which every call fails with the error given.

 @param asked - array each exchange's model id is appended to

 @param failure - what each exchange throws

 @returns A client that answers nothing

 @example
 ```ts
 const inner = failingClient({ asked: [], failure: new Error('cut',), },);
 ```
 */
function failingClient({ asked, failure, }: { readonly asked: string[]; readonly failure: Error; },): ModelClient {
  return {
    ...scriptedClient({ script: { asked, reportsUsage: true, }, },),
    chatJson: () => Promise.reject(failure,),
  };
}

/**
 The USD each `cost=` field of the given SPEND lines holds, summed.

 @param lines - lines the logger wrote

 @returns Total of the costs on the lines that are SPEND records

 @example
 ```ts
 const total = costOfSpendLines({ lines: logged, },);
 ```
 */
function costOfSpendLines({ lines, }: { readonly lines: readonly string[]; },): number {
  /**
   Dollars of the SPEND lines read so far.
   */
  let total = 0;
  for (const line of lines) {
    if (line.includes('SPEND provider=',))
      total += Number((line.split(' cost=',)[1] ?? '0').split(' ',)[0],);
  }
  return total;
}

await describe({
  name: '',
  // SEQUENTIAL: the run spend meter is process-wide and the guard reads it, so cases must not overlap.
  concurrency: 1,
  children: [
    describe({
      name: callCeilingUsd.name,
      children: [
        it({
          name: 'PRICES THE MOST ONE CALL CAN COST: the prompt at one input token a character and the whole completion cap '
            + 'at the output rate',
          fn: async () => {
            expect(callCeilingUsd({
              prices: pricesOf({ cardId: LOW_CARD, },),
              promptTokens: 1_000,
            },),).toBeCloseTo(0.322, 10,);
          },
        },),
      ],
    },),

    describe({
      name: guardLine.name,
      children: [
        it({
          name: 'SAYS WHAT HOLDS THE ARM TO --max-usd and what it counts, so a log shows the guard was on, at what amount, '
            + 'and that a call that throws is counted at its ceiling',
          fn: async () => {
            expect(guardLine({ maxUsd: 2, },),).toBe(
              'spend guard: each call is refused, and the arm ends, when the spend so far plus that call\'s ceiling '
                + 'would pass --max-usd 2.0000; the spend so far is every SPEND line the client wrote, the attempts '
                + 'it abandoned included, and a call that throws, or a reply that reports no usage, is counted at its '
                + 'ceiling',
            );
          },
        },),
      ],
    },),

    describe({
      name: guardTotalLine.name,
      children: [
        it({
          name: 'SAYS WHAT THE GUARD COUNTED in the one grammar the read step totals: dollars, calls, and the calls it '
            + 'counted at their ceiling itself',
          fn: async () => {
            expect(guardTotalLine({ total: { usd: 0.322, calls: 3, atCeiling: 1, }, },),).toBe(
              'GUARD total=0.322000 calls=3 atCeiling=1',
            );
          },
        },),
      ],
    },),

    describe({
      name: spendGuardedClient.name,
      children: [
        it({
          name: 'PASSES A CALL whose ceiling fits what is left and hands back the inner reply untouched, JSON and text '
            + 'alike',
          fn: async () => {
            resetRunSpend();
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ script: { asked, pricedUsd: REPLY_USD, reportsUsage: true, }, },),
              maxUsd: 1,
              controller,
            },);
            expect(await askJson({ client, modelId: LOW_CARD, signal: controller.signal, },),).toStrictEqual({
              kind: 'ok',
              value: { edits: [], },
              rawText: '{"edits":[]}',
              usage: REPORTED,
            },);
            expect(await client.chatText({
              modelId: LOW_CARD,
              messages: THOUSAND_CHARS,
              signal: controller.signal,
            },),).toStrictEqual({ text: 'meow', usage: REPORTED, },);
            expect(asked,).toStrictEqual([LOW_CARD, LOW_CARD,],);
            expect(controller.signal.aborted,).toBe(false,);
            expect(client.guardTotal().usd,).toBeCloseTo(2 * REPLY_USD, 10,);
            expect(client.guardTotal().calls,).toBe(2,);
            expect(client.guardTotal().atCeiling,).toBe(0,);
          },
        },),

        it({
          name: 'STOPS THE ARM BEFORE THE CALL THAT WOULD PASS --max-usd: replies that cost 0.1025 USD each on the meter '
            + 'reach the cap, the seven calls that fit are made, the eighth is refused before the inner client is '
            + 'reached, and the refusal names the spend so far, that call\'s ceiling and --max-usd',
          fn: async () => {
            resetRunSpend();
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ script: { asked, pricedUsd: REPLY_USD, reportsUsage: true, }, },),
              maxUsd: 1,
              controller,
            },);
            for (let call = 0; call < 7; call += 1) {
              // oxlint-disable-next-line no-await-in-loop -- each call settles, and is measured, before the next is asked
              await askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
            }
            expect(asked.length,).toBe(7,);
            const raised = await raisedBy({
              ask: function eighth(): Promise<unknown> {
                return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect(raised,).toBeInstanceOf(StatedRefusalError,);
            expect((raised as StatedRefusalError).message,).toBe(
              `the editor fidelity probe will not ask ${LOW_CARD}: the spend so far is 0.7175 USD, this call can cost `
                + '0.3220 USD at most, and together they pass --max-usd 1.0000; the arm ends here, and the rows it '
                + 'finished stay in their files',
            );
            expect(asked.length,).toBe(7,);
          },
        },),

        it({
          name: 'ENDS THE ARM, not one voice of it: the refusal aborts the arm\'s signal with itself as the reason, so '
            + 'every layer that rethrows an abort carries it out, and every later call is refused the same way without '
            + 'reaching the inner client',
          fn: async () => {
            resetRunSpend();
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ script: { asked, pricedUsd: REPLY_USD, reportsUsage: true, }, },),
              maxUsd: 0.3,
              controller,
            },);
            const first = await raisedBy({
              ask: function firstCall(): Promise<unknown> {
                return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect(first,).toBeInstanceOf(StatedRefusalError,);
            expect(controller.signal.aborted,).toBe(true,);
            expect(controller.signal.reason,).toBe(first,);
            const second = await raisedBy({
              ask: function secondCall(): Promise<unknown> {
                return client.chatText({
                  modelId: LOW_CARD,
                  messages: THOUSAND_CHARS,
                  signal: controller.signal,
                },);
              },
            },);
            expect(second,).toBe(first,);
            expect(asked,).toStrictEqual([],);
          },
        },),

        it({
          name: 'REFUSES THE FIRST CALL when its ceiling alone passes --max-usd, naming a spend of nothing so far',
          fn: async () => {
            resetRunSpend();
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ script: { asked: [], pricedUsd: REPLY_USD, reportsUsage: true, }, },),
              maxUsd: 0.3,
              controller,
            },);
            const raised = await raisedBy({
              ask: function firstCall(): Promise<unknown> {
                return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect((raised as StatedRefusalError).message,).toBe(
              `the editor fidelity probe will not ask ${LOW_CARD}: the spend so far is 0.0000 USD, this call can cost `
                + '0.3220 USD at most, and together they pass --max-usd 0.3000; the arm ends here, and the rows it '
                + 'finished stay in their files',
            );
          },
        },),

        it({
          name: 'LETS A CALL THROUGH that brings the total exactly to --max-usd, since only a total past it is refused',
          fn: async () => {
            resetRunSpend();
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ script: { asked, pricedUsd: REPLY_USD, reportsUsage: true, }, },),
              maxUsd: 0.322,
              controller,
            },);
            await askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
            expect(asked,).toStrictEqual([LOW_CARD,],);
          },
        },),

        it({
          name: 'COUNTS A REPLY THAT REPORTS NO USAGE AT ITS CEILING, since its cost is unknown and an unknown cost may '
            + 'not be assumed small: the guard writes the SPEND line itself, marked unreported-bound, so two such calls '
            + 'of 0.322 USD stop an arm held to 0.6',
          fn: async () => {
            resetRunSpend();
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ script: { asked, reportsUsage: false, }, },),
              maxUsd: 0.6,
              controller,
            },);
            const { logged, } = await infoLinesDuring({
              run: async () => await askJson({ client, modelId: LOW_CARD, signal: controller.signal, },),
            },);
            const raised = await raisedBy({
              ask: function secondCall(): Promise<unknown> {
                return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect((raised as StatedRefusalError).message,).toContain('the spend so far is 0.3220 USD',);
            expect(asked,).toStrictEqual([LOW_CARD,],);
            expect(logged.filter(function isBound(line,): boolean {
              return line.includes(`SPEND provider=anthropic model=${LOW_CARD} prompt=1000 completion=32000 cost=0.322 `
                + 'estimated=unreported-bound',);
            },).length,).toBe(1,);
            expect(runSpendUsd({ provider: 'anthropic', },),).toBeCloseTo(0.322, 10,);
            expect(client.guardTotal().atCeiling,).toBe(1,);
          },
        },),

        it({
          name: 'COUNTS A CALL THAT THROWS AT ITS CEILING, since the client may have been billed for a stream it never '
            + 'delivered: the guard writes the SPEND line itself, marked abandoned-bound, and two such calls leave no '
            + 'room for a third under 0.7 USD',
          fn: async () => {
            resetRunSpend();
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: failingClient({ asked, failure: new Error('the stream was cut',), },),
              maxUsd: 0.7,
              controller,
            },);
            const { logged, } = await infoLinesDuring({
              run: async () => {
                for (let call = 0; call < 2; call += 1) {
                  // oxlint-disable-next-line no-await-in-loop -- each call fails before the next is asked
                  const raised = await raisedBy({
                    ask: function failingCall(): Promise<unknown> {
                      return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
                    },
                  },);
                  expect((raised as Error).message,).toBe('the stream was cut',);
                }
              },
            },);
            expect(controller.signal.aborted,).toBe(false,);
            expect(logged.filter(function isBound(line,): boolean {
              return line.includes(`SPEND provider=anthropic model=${LOW_CARD} prompt=1000 completion=32000 cost=0.322 `
                + 'estimated=abandoned-bound',);
            },).length,).toBe(2,);
            const third = await raisedBy({
              ask: function thirdCall(): Promise<unknown> {
                return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect(third,).toBeInstanceOf(StatedRefusalError,);
            expect((third as StatedRefusalError).message,).toContain('the spend so far is 0.6440 USD',);
            expect(client.guardTotal(),).toStrictEqual({ usd: 0.644, calls: 2, atCeiling: 2, },);
          },
        },),

        it({
          name: 'COUNTS NOTHING FOR AN HTTP ERROR THAT CARRIED NO BODY, which proves no billable body was delivered, and '
            + 'keeps asking; the same status with a body counts at the ceiling',
          fn: async () => {
            resetRunSpend();
            const asked: string[] = [];
            const controller = new AbortController();
            const bare = spendGuardedClient({
              inner: failingClient({
                asked,
                failure: new ProviderHttpError({ provider: 'anthropic', status: 529, bodyText: '', },),
              },),
              maxUsd: 0.4,
              controller,
            },);
            for (let call = 0; call < 3; call += 1) {
              // oxlint-disable-next-line no-await-in-loop -- each call fails before the next is asked
              const raised = await raisedBy({
                ask: function bareCall(): Promise<unknown> {
                  return askJson({ client: bare, modelId: LOW_CARD, signal: controller.signal, },);
                },
              },);
              expect(raised,).toBeInstanceOf(ProviderHttpError,);
            }
            expect(controller.signal.aborted,).toBe(false,);
            expect(bare.guardTotal(),).toStrictEqual({ usd: 0, calls: 3, atCeiling: 0, },);
            expect(runSpendUsd({ provider: 'anthropic', },),).toBe(0,);

            const bodied = spendGuardedClient({
              inner: failingClient({
                asked,
                failure: new ProviderHttpError({
                  provider: 'anthropic',
                  status: 529,
                  bodyText: '{"type":"error","error":{"type":"overloaded_error"}}',
                },),
              },),
              maxUsd: 0.4,
              controller,
            },);
            await raisedBy({
              ask: function bodiedCall(): Promise<unknown> {
                return askJson({ client: bodied, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect(bodied.guardTotal().usd,).toBeCloseTo(0.322, 10,);
          },
        },),

        it({
          name: 'COUNTS EACH ATTEMPT THE CLIENT ABANDONED BEFORE IT ANSWERED, because the client writes it on the meter: '
            + 'two abandoned attempts of 0.4 USD and a reply of 0.1 leave 0.9 USD spent by the first call, so the '
            + 'second is refused under 1.0',
          fn: async () => {
            resetRunSpend();
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({
                script: { asked, pricedUsd: 0.1, abandonedUsd: [0.4, 0.4,], reportsUsage: true, },
              },),
              maxUsd: 1,
              controller,
            },);
            await askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
            const raised = await raisedBy({
              ask: function secondCall(): Promise<unknown> {
                return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect((raised as StatedRefusalError).message,).toContain('the spend so far is 0.9000 USD',);
            expect(asked.length,).toBe(1,);
          },
        },),

        it({
          name: 'PRICES EACH CALL BY ITS OWN MODEL, so a Haiku call is not held to the Sonnet ceiling, and keeps the rest '
            + 'of the client it wraps',
          fn: async () => {
            resetRunSpend();
            const asked: string[] = [];
            const controller = new AbortController();
            const inner = {
              ...scriptedClient({ script: { asked, pricedUsd: 0.01, reportsUsage: true, }, },),
              providerHolds: 'held',
            };
            const client = spendGuardedClient({
              inner,
              maxUsd: 0.1,
              controller,
            },);
            await askJson({ client, modelId: HAIKU_CARD, signal: controller.signal, },);
            expect(asked,).toStrictEqual([HAIKU_CARD,],);
            expect((client as ModelClient & { readonly providerHolds: string; }).providerHolds,).toBe('held',);
          },
        },),

        it({
          name: 'TOTALS WHAT THE REAL CLAUDE CLIENT WRITES: over a scripted transport, a call whose two streams were cut '
            + 'before their end (two abandoned-bound lines of the client, then a throw the guard counts at its '
            + 'ceiling) and a call that answers hold a guard total equal to the sum of every SPEND line cost the '
            + 'arm logged, and the sum is not under what the client abandoned',
          fn: async () => {
            resetRunSpend();
            /**
             A whole stream with its terminator frame cut away.
             */
            const cut = claudeStreamOf({ text: '{"spot":"sun', stopReason: 'end_turn', usage: PLAIN_USAGE, })
              .replace(anthropicFrameOf({ body: { type: 'message_stop', }, },), '',);
            const { transport, } = scripted({
              replies: [
                { status: 200, bodyText: cut, },
                { status: 200, bodyText: cut, },
                {
                  status: 200,
                  bodyText: claudeStreamOf({
                    text: '{"spot":"sunbeam"}',
                    stopReason: 'end_turn',
                    usage: PLAIN_USAGE,
                  }),
                },
              ],
            },);
            const controller = new AbortController();
            const claude = createClaudeClient({ apiKey: CLAUDE_CAT_KEY, transport, retryPolicy: ONE_QUICK_RETRY, },);
            const client = spendGuardedClient({
              inner: {
                chatText: claude.chatText,
                chatJson: claude.chatJson,
                quotas: () => Promise.reject(new Error('quotas unused',),),
              },
              maxUsd: 5,
              controller,
            },);
            const { logged, } = await infoLinesDuring({
              run: async () => {
                await raisedBy({
                  ask: function cutCall(): Promise<unknown> {
                    return client.chatJson({
                      modelId: 'claude-sonnet-5-5-effort-low',
                      messages: THOUSAND_CHARS,
                      signal: controller.signal,
                      validate: (value: unknown,): value is unknown => value !== undefined,
                    },);
                  },
                },);
                await client.chatJson({
                  modelId: 'claude-sonnet-5-5-effort-low',
                  messages: THOUSAND_CHARS,
                  signal: controller.signal,
                  validate: (value: unknown,): value is unknown => value !== undefined,
                },);
              },
            },);
            /**
             Cost of every SPEND line the arm logged, the client's and the guard's together.
             */
            const logTotal = costOfSpendLines({ lines: logged, },);
            expect(client.guardTotal().usd,).toBeCloseTo(logTotal, 9,);
            expect(runSpendUsd({ provider: 'anthropic', },),).toBeCloseTo(logTotal, 9,);
            expect(client.guardTotal().calls,).toBe(2,);
            expect(client.guardTotal().atCeiling,).toBe(1,);
            expect(logged.filter(function isBound(line,): boolean {
              return line.includes('estimated=abandoned-bound',);
            },).length,).toBe(3,);
            expect(logTotal,).toBeGreaterThan(0.9,);
          },
        },),
      ],
    },),
  ],
},);
