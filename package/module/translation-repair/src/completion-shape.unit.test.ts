/**
 * Tests for provider protocol parsing of completion bodies:
 * every contract violation throws with its own detail, refusals with
 * null content pass as valid replies, and mistyped usage is dropped
 * rather than trusted.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  extractCompletion,
  MalformedCompletionError,
  readUsage,
  SyntheticHttpError,
} from './completion-shape.ts';

/**
 * Character count of the body excerpt embedded in thrown HTTP errors,
 * mirrored from the implementation bound under test.
 */
const BODY_EXCERPT_LIMIT = 600;

/**
 * Runs one extraction expected to throw, returning the caught error.
 */
function caughtFrom({ bodyText, }: { readonly bodyText: string; },): unknown {
  try {
    extractCompletion({ bodyText, },);
  }
  catch (error) {
    return error;
  }
  throw new Error('extraction unexpectedly succeeded',);
}

/**
 * Contract-violating bodies paired with the detail each must throw.
 */
const VIOLATION_CASES = [
  ['{"cat":', 'body is not valid JSON',],
  ['"喵"', 'body is not a JSON object',],
  ['{"choices":{}}', 'choices is not an array',],
  ['{"choices":[]}', 'choices[0] is missing',],
  ['{"choices":[{"message":"喵"}]}', 'choices[0].message is not an object',],
  ['{"choices":[{"message":{"content":null}}]}', 'choices[0].message.content is not a string',],
] as const;

await describe({
  name: '',
  children: [
    describe({
      name: extractCompletion.name,
      children: [
        it({
          name: 'extracts content and usage from a conforming body',
          fn: async () => {
            expect(
              extractCompletion({
                bodyText:
                  '{"choices":[{"message":{"content":"喵"}}],"usage":{"prompt_tokens":3,"completion_tokens":7}}',
              },),
            ).toEqual({
              text: '喵',
              usage: {
                prompt_tokens: 3,
                completion_tokens: 7,
              },
            },);
          },
        },),
        it({
          name: 'passes a refusal with null content as a valid refusal reply',
          fn: async () => {
            expect(
              extractCompletion({
                bodyText:
                  '{"choices":[{"message":{"content":null,"refusal":"no cats today"}}]}',
              },),
            ).toEqual({
              text: '',
              refusal: 'no cats today',
            },);
          },
        },),
        it({
          name: 'carries a refusal beside delivered content',
          fn: async () => {
            expect(
              extractCompletion({
                bodyText:
                  '{"choices":[{"message":{"content":"喵","refusal":"reluctantly"}}]}',
              },),
            ).toEqual({
              text: '喵',
              refusal: 'reluctantly',
            },);
          },
        },),
        it({
          name: 'treats an empty refusal string as no refusal',
          fn: async () => {
            const caught = caughtFrom({
              bodyText: '{"choices":[{"message":{"content":null,"refusal":""}}]}',
            },);
            expect(caught,).toBeInstanceOf(MalformedCompletionError,);
          },
        },),
        ...VIOLATION_CASES.map(function toCase([bodyText, detail,],) {
          return it({
            name: `throws naming the violation: ${detail}`,
            fn: async () => {
              const caught = caughtFrom({ bodyText, },);
              expect(caught,).toBeInstanceOf(MalformedCompletionError,);
              expect((caught as Error).message,).toContain(detail,);
            },
          },);
        },),
      ],
    },),
    describe({
      name: readUsage.name,
      children: [
        it({
          name: 'reads both component counts',
          fn: async () => {
            expect(
              readUsage({ parsed: { usage: { prompt_tokens: 3, completion_tokens: 7, }, }, },),
            ).toEqual({
              usage: {
                prompt_tokens: 3,
                completion_tokens: 7,
              },
            },);
          },
        },),
        it({
          name: 'drops absent usage',
          fn: async () => {
            expect(readUsage({ parsed: {}, },),).toEqual({},);
          },
        },),
        it({
          name: 'drops mistyped component counts instead of trusting them',
          fn: async () => {
            expect(
              readUsage({ parsed: { usage: { prompt_tokens: '3', completion_tokens: 7, }, }, },),
            ).toEqual({},);
          },
        },),
        it({
          name: 'drops a non-record usage block',
          fn: async () => {
            expect(readUsage({ parsed: { usage: 'lots', }, },),).toEqual({},);
          },
        },),
      ],
    },),
    describe({
      name: SyntheticHttpError.name,
      children: [
        it({
          name: 'carries status and excerpts the body',
          fn: async () => {
            const error = new SyntheticHttpError({
              status: 429,
              bodyText: '猫'.repeat(BODY_EXCERPT_LIMIT * 2,),
            },);
            expect(error.status,).toBe(429,);
            expect(error.bodyExcerpt,).toHaveLength(BODY_EXCERPT_LIMIT,);
            expect(error.message,).toContain('HTTP 429',);
          },
        },),
      ],
    },),
  ],
},);
