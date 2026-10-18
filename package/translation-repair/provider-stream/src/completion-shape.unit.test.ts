/**
 Tests for reading a completion's usage block and for the HTTP error a
 failed exchange raises: mistyped usage is dropped rather than trusted, and
 the error's body excerpt ends on a whole character. The non-streaming body
 parser these cases once shared a file with is gone, since every provider
 streams (ledger B30).

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  readUsage,
  SyntheticHttpError,
} from '../dist/final/node/index.mjs';

/**
 Character count of the body excerpt embedded in thrown HTTP errors,
 mirrored from the implementation bound under test.
 */
const BODY_EXCERPT_LIMIT = 600;

await describe({
  name: '',
  children: [
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
        it({
          name: 'ENDS THE EXCERPT BEFORE A CHARACTER THE LIMIT WOULD CUT IN HALF, so neither the excerpt nor '
            + 'the message carries half an emoji (ledger B21)',
          fn: async () => {
            /**
             Body whose emoji straddles the excerpt's limit.
             */
            const bodyText = `${'猫'.repeat(BODY_EXCERPT_LIMIT - 1,)}\u{1F431} purrs`;
            const error = new SyntheticHttpError({
              status: 503,
              bodyText,
            },);
            expect(error.bodyExcerpt,).toBe('猫'.repeat(BODY_EXCERPT_LIMIT - 1,),);
            expect(error.message.isWellFormed(),).toBe(true,);
          },
        },),
        it({
          name: 'WITHHOLDS the excerpt from a message that gives no summary, leaving the plain status line, and keeps '
            + 'the excerpt on the error for the log alone',
          fn: async () => {
            const error = new SyntheticHttpError({
              status: 502,
              bodyText: 'the cat knocked the bowl over',
              excerpt: 'withheld',
            },);
            expect(error.message,).toBe('provider API returned HTTP 502',);
            expect(error.bodyExcerpt,).toBe('the cat knocked the bowl over',);
          },
        },),
      ],
    },),
  ],
},);
