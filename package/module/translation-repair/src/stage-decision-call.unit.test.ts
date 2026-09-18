/**
 Tests for the typed half of a stage exchange (2026-09-18): a decision seat
 is asked the stage's question through the client's `decide` and never the
 sheet; a stage with no question or a client with no decisions transport
 loses that voice without a chat call; a router refusal reads as an
 unreachable seat. Cat-themed invention.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  attemptStageCall,
  NoProviderForModelError,
  SEAT_OPENROUTER_DECISIONS,
  type StageDecision,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 Logger the stage writes its progress to.
 */
const l = tagged({ tag: 'stage-decision-call-test', },);

/**
 Guard admitting the read ballot.

 @param value - candidate from the reading

 @returns Whether it carries a numeric best

 @example
 ```ts
 isBallot({ best: 2, },);
 ```
 */
function isBallot(value: unknown,): value is { readonly best: number; } {
  return ((typeof value) === 'object') && (value !== null) && ((typeof (value as { best?: unknown; }).best) === 'number');
}

/**
 One typed question over two cat renderings.
 */
const DECISION: StageDecision = {
  state: { candidates: { '1': 'The cat naps.', '2': 'The cat dozes.', }, },
  questions: {
    best: {
      type: 'choice',
      instructions: 'Which is best?',
      criteria: {
        '0': 'none',
        '1': 'candidate 1',
        '2': 'candidate 2',
      },
    },
  },
  read: function read(answers,) {
    /**
     The one answer.
     */
    const { best, } = answers;
    return ((best !== undefined) && (best.type === 'choice')) ? { best: Number(best.choice,), } : {};
  },
};

/**
 Client whose chat surface must never be reached and whose decide answers
 as scripted.

 @param decide - what a typed exchange does, or nothing for a client without one

 @returns Client for the stage call

 @example
 ```ts
 const client = clientWith({ decide: async () => reply, },);
 ```
 */
function clientWith(
  { decide, }: { readonly decide?: SyntheticClient['decide']; },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('a decision seat must never be asked for chat',);
    },
    chatJson: async () => {
      throw new Error('a decision seat must never be asked for chat',);
    },
    quotas: async () => {
      throw new Error('quotas unused',);
    },
    ...((decide === undefined) ? {} : { decide, }),
  };
}

/**
 Arguments every case shares.
 */
const SHARED = {
  modelId: SEAT_OPENROUTER_DECISIONS,
  messages: [{ role: 'user' as const, content: 'the sheet a decision seat never sees', },],
  signal: AbortSignal.timeout(5_000,),
  exchangeTimeoutMs: 5_000,
  responseFormat: {
    type: 'json_schema' as const,
    json_schema: { name: 'ballot', schema: { type: 'object', }, },
  },
  validate: isBallot,
  stage: 'select',
  l,
};

await describe({
  name: 'a decision seat in a stage call',
  children: [
    it({
      name: 'IS ASKED THE TYPED QUESTION and heard through the stage guard',
      fn: async () => {
        const voice = await attemptStageCall({
          ...SHARED,
          client: clientWith({
            decide: async () => ({
              model: 'typesafe/jev-1.13',
              answers: { best: { type: 'choice', choice: '2', }, },
            }),
          },),
          decision: DECISION,
        },);
        expect(voice,).toEqual({
          heard: true,
          value: { best: 2, },
        },);
      },
    },),

    it({
      name: 'LOSES ITS VOICE without a chat call when the stage has no question or the client no '
        + 'decisions transport, and reads as unreachable when the router refuses',
      fn: async () => {
        const noQuestion = await attemptStageCall({
          ...SHARED,
          client: clientWith({
            decide: async () => {
              throw new Error('must not be asked without a question',);
            },
          },),
        },);
        expect(noQuestion,).toEqual({
          heard: false,
          answered: false,
          unreachable: false,
        },);

        const noTransport = await attemptStageCall({
          ...SHARED,
          client: clientWith({},),
          decision: DECISION,
        },);
        expect(noTransport,).toEqual({
          heard: false,
          answered: false,
          unreachable: false,
        },);

        const refused = await attemptStageCall({
          ...SHARED,
          client: clientWith({
            decide: async () => {
              throw new NoProviderForModelError({
                modelId: SEAT_OPENROUTER_DECISIONS,
                reason: 'the decisions endpoint reads dry',
              },);
            },
          },),
          decision: DECISION,
        },);
        expect(refused,).toEqual({
          heard: false,
          answered: false,
          unreachable: true,
        },);
      },
    },),
  ],
},);
