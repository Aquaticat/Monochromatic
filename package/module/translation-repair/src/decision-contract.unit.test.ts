/**
 Tests for the decisions endpoint's documented reply shapes: what counts as
 an answer, and what a body must carry to be read at all.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isDecisionAnswer,
  readDecisionReplyBody,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 Reply carrying one answer of each documented kind and nothing else.
 */
const MINIMAL_BODY =
  '{"answers":{"a":{"type":"choice","choice":"cat"},"b":{"type":"noul","noul":0.5},'
    + '"c":{"type":"score","score":3}},"model":"kitty"}';

//endregion Fixtures

await describe({
  name: readDecisionReplyBody.name,
  children: [
    it({
      name: 'READS the three documented answers and REFUSES one that is none of them, a non-record, or a '
        + 'record whose value carries the wrong shape (ledger T8, the decision cluster)',
      fn: async () => {
        expect(isDecisionAnswer({
          type: 'choice',
          choice: 'cat',
        },),).toBe(true,);
        expect(isDecisionAnswer({
          type: 'noul',
          noul: 0.5,
        },),).toBe(true,);
        expect(isDecisionAnswer({
          type: 'score',
          score: 3,
        },),).toBe(true,);
        expect(isDecisionAnswer({
          type: 'meow',
        },),).toBe(false,);
        expect(isDecisionAnswer('cat',),).toBe(false,);
        expect(isDecisionAnswer({
          type: 'noul',
          noul: 'x',
        },),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES a body that is not JSON and one that is not an object (ledger T8, the decision '
        + 'cluster)',
      fn: async () => {
        expect(() => readDecisionReplyBody({
          bodyText: 'cat',
        },),).toThrow('body is not JSON',);
        expect(() => readDecisionReplyBody({
          bodyText: '"cat"',
        },),).toThrow('body is not an object',);
      },
    },),

    it({
      name: 'REFUSES a reply naming no model (ledger T8, the decision cluster)',
      fn: async () => {
        expect(() => readDecisionReplyBody({
          bodyText: '{"answers":{"a":{"type":"choice","choice":"cat"}}}',
        },),).toThrow('model missing',);
      },
    },),

    it({
      name: 'REFUSES a reply with no answers block and one carrying an answer that is none of the three '
        + '(ledger T8, the decision cluster)',
      fn: async () => {
        expect(() => readDecisionReplyBody({
          bodyText: '{"model":"kitty"}',
        },),).toThrow('answers missing',);
        expect(() => readDecisionReplyBody({
          bodyText: '{"answers":{"a":{"type":"meow"}},"model":"kitty"}',
        },),).toThrow('answer a is not a choice, noul or score',);
      },
    },),

    it({
      name: 'READS a reply carrying no usage as its answers and model alone (ledger T8, the decision '
        + 'cluster)',
      fn: async () => {
        expect(readDecisionReplyBody({
          bodyText: MINIMAL_BODY,
        },),).toEqual({
          answers: {
            a: {
              type: 'choice',
              choice: 'cat',
            },
            b: {
              type: 'noul',
              noul: 0.5,
            },
            c: {
              type: 'score',
              score: 3,
            },
          },
          model: 'kitty',
        },);
      },
    },),

    it({
      name: 'CARRIES usage only when both token counts are numbers, and costUsd only when cost is one '
        + '(ledger T8, the decision cluster)',
      fn: async () => {
        expect(readDecisionReplyBody({
          bodyText: '{"answers":{},"model":"kitty","usage":{"input_tokens":3}}',
        },),).toEqual({
          answers: {},
          model: 'kitty',
        },);
        expect(readDecisionReplyBody({
          bodyText: '{"answers":{},"model":"kitty","usage":{"input_tokens":3,"output_tokens":4}}',
        },),).toEqual({
          answers: {},
          model: 'kitty',
          usage: {
            prompt_tokens: 3,
            completion_tokens: 4,
            total_tokens: 7,
          },
        },);
        expect(readDecisionReplyBody({
          bodyText: '{"answers":{},"model":"kitty","usage":{"input_tokens":3,"output_tokens":4,"cost":0.5}}',
        },),).toEqual({
          answers: {},
          model: 'kitty',
          usage: {
            prompt_tokens: 3,
            completion_tokens: 4,
            total_tokens: 7,
          },
          costUsd: 0.5,
        },);
      },
    },),
  ],
},);
