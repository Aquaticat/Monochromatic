/**
 Tests for the decisions client (2026-09-18): one POST to OpenRouter's
 decisions endpoint, the reply read into the typed contract, spend reported
 on the OpenRouter meter, a non-success status refused, a body off the
 documented shape refused. Recorded transport; cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createDecisionsClient,
  DecisionReplyShapeError,
  type ModelTransport,
  SEAT_OPENROUTER_DECISIONS,
  SyntheticHttpError,
} from '../dist/final/node/index.mjs';

/**
 Retry pacing that never waits, so a refused status returns at once.
 */
const NO_RETRY = {
  limit: 0,
  baseMs: 0,
};

/**
 What the endpoint answered the cat noticeboard question with.
 */
const REPLY_BODY = JSON.stringify({
  model: 'typesafe/jev-1.13-20260917',
  answers: {
    best: {
      type: 'choice',
      choice: '2',
      probabilities: {
        '0': 0.02,
        '1': 0.08,
        '2': 0.9,
      },
      confidence: 0.86,
    },
    urgent: {
      type: 'noul',
      noul: 0.12,
    },
  },
  usage: {
    input_tokens: 512,
    output_tokens: 7,
    cost: 0.0000215,
  },
  id: 'gen-dec-cat',
  provider: 'TypeSafe',
},);

/**
 Recorded transport answering every exchange the same way and keeping what
 it was sent.

 @param status - HTTP status to answer with

 @param bodyText - body to answer with

 @returns Transport plus the exchanges it saw

 @example
 ```ts
 const rig = recordedTransport({ status: 200, bodyText: REPLY_BODY, },);
 ```
 */
function recordedTransport(
  {
    status,
    bodyText,
  }: {
    readonly status: number;
    readonly bodyText: string;
  },
): {
  readonly transport: ModelTransport;
  readonly sent: { readonly bodies: string[]; readonly urls: string[]; };
} {
  /**
   Exchanges as they arrived.
   */
  const sent = {
    bodies: [] as string[],
    urls: [] as string[],
  };
  return {
    sent,
    transport: async (exchange,) => {
      sent.bodies.push(exchange.bodyJson ?? '',);
      sent.urls.push(exchange.url,);
      return {
        status,
        bodyText,
      };
    },
  };
}

await describe({
  name: createDecisionsClient.name,
  children: [
    it({
      name: 'POSTS the seat\'s served id, the state and the questions, and reads the answers, model and '
        + 'usage back',
      fn: async () => {
        const rig = recordedTransport({
          status: 200,
          bodyText: REPLY_BODY,
        },);
        const client = createDecisionsClient({
          apiKey: 'test-key',
          transport: rig.transport,
          retryPolicy: NO_RETRY,
        },);
        const reply = await client.decide({
          modelId: SEAT_OPENROUTER_DECISIONS,
          state: { notice: '走失猫咪 Mittens', },
          questions: {
            best: {
              type: 'choice',
              instructions: 'Which candidate is best?',
              criteria: {
                '0': 'none',
                '1': 'candidate 1',
                '2': 'candidate 2',
              },
            },
            urgent: {
              type: 'noul',
              instructions: 'Is the notice urgent?',
            },
          },
          signal: AbortSignal.timeout(5_000,),
          exchangeTimeoutMs: 5_000,
        },);
        expect(rig.sent.urls,).toEqual(['https://openrouter.ai/api/alpha/decisions',],);
        /**
         Body as the endpoint would have parsed it.
         */
        const body: unknown = JSON.parse(rig.sent.bodies[0] ?? '{}',);
        expect(body,).toMatchObject({
          model: 'typesafe/jev-1.13',
          state: { notice: '走失猫咪 Mittens', },
        },);
        expect(reply.model,).toBe('typesafe/jev-1.13-20260917',);
        expect(reply.answers.best,).toMatchObject({
          type: 'choice',
          choice: '2',
        },);
        expect(reply.answers.urgent,).toEqual({
          type: 'noul',
          noul: 0.12,
        },);
        expect(reply.usage,).toEqual({
          prompt_tokens: 512,
          completion_tokens: 7,
          total_tokens: 519,
        },);
        expect(reply.costUsd,).toBe(0.0000215,);
      },
    },),

    it({
      name: 'REFUSES a non-success status as an HTTP error and a body off the documented shape as a '
        + 'shape error, never as an answer',
      fn: async () => {
        const refused = createDecisionsClient({
          apiKey: 'test-key',
          transport: recordedTransport({
            status: 402,
            bodyText: '{"error":{"code":402,"message":"the bookshop is closed"}}',
          },).transport,
          retryPolicy: NO_RETRY,
        },);
        await expect(refused.decide({
          modelId: SEAT_OPENROUTER_DECISIONS,
          state: 'a cat',
          questions: { asleep: { type: 'noul', instructions: 'Asleep?', }, },
          signal: AbortSignal.timeout(5_000,),
        },),).rejects.toBeInstanceOf(SyntheticHttpError,);

        const malformed = createDecisionsClient({
          apiKey: 'test-key',
          transport: recordedTransport({
            status: 200,
            bodyText: '{"model":"typesafe/jev-1.13","answers":{"asleep":{"type":"noul"}}}',
          },).transport,
          retryPolicy: NO_RETRY,
        },);
        await expect(malformed.decide({
          modelId: SEAT_OPENROUTER_DECISIONS,
          state: 'a cat',
          questions: { asleep: { type: 'noul', instructions: 'Asleep?', }, },
          signal: AbortSignal.timeout(5_000,),
        },),).rejects.toBeInstanceOf(DecisionReplyShapeError,);
      },
    },),
  ],
},);
