/**
 Tests for the reckoned spend line an abandoned OpenRouter stream writes.
 
 Between the top-up of 2026-09-08 and the refusal of 2026-09-09 the log
 summed 141.62 USD where the meter moved 199.92, the difference being
 streams the rounds abandoned and no line recorded. These cases pin the
 reckoning, the line's mark, the run meter moving, and silence where the
 error says nothing about what was delivered.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  deliveredCharsOf,
  estimateAbandonedSpend,
  exchangeReportingAbandon,
  OPENROUTER_MODELS,
  reportAbandonedSpend,
  resetRunSpend,
  runSpendUsd,
  StreamCutShortError,
  StreamOverrunError,
} from '../dist/final/node/index.mjs';

/**
 A cut stream that delivered 1,370 raw characters, ten tokens at MiniMax
 M3's measured 137 characters a token.
 */
const CUT = new StreamCutShortError({
  label: 'minimax/minimax-m3',
  partialText: 'x'.repeat(1_370,),
  progress: {
    firstByteMs: 500,
    maxGapMs: 100,
    elapsedMs: 4_000,
    chars: 1_370,
  },
  cause: new Error('abandoned',),
},);

/**
 Raw characters the reckoning divides by for MiniMax M3.
 */
const MINIMAX_RAW_CHARS_PER_TOKEN = 137;

/**
 Tokens in one million, the listing's unit.
 */
const MILLION = 1_000_000;

await describe({
  name: deliveredCharsOf.name,
  children: [
    it({
      name: 'READS the delivered characters off a cut stream and off a stream this pipeline ended for '
        + 'overrunning, and answers nothing-known for any other error',
      fn: async () => {
        expect(deliveredCharsOf({ error: CUT, },),).toBe(1_370,);
        expect(deliveredCharsOf({
          error: new StreamOverrunError({
            label: 'minimax/minimax-m3',
            channel: 'reasoning',
            charsSeen: 274,
            cap: 200,
          },),
        },),).toBe(274,);
        expect(deliveredCharsOf({ error: new Error('HTTP 502',), },),).toBe('nothing-known',);
      },
    },),
  ],
},);

await describe({
  name: estimateAbandonedSpend.name,
  children: [
    it({
      name: 'RECKONS completion tokens from raw characters at the measured ratio, prompt tokens from '
        + 'body bytes, and prices both at the listing\'s rates',
      fn: async () => {
        /**
         Listing prices for MiniMax M3.
         */
        const info = OPENROUTER_MODELS['minimax/minimax-m3'];
        /**
         Reckoning for ten tokens delivered on a four-thousand-byte body.
         */
        const estimate = estimateAbandonedSpend({
          servedId: 'minimax/minimax-m3',
          deliveredChars: 10 * MINIMAX_RAW_CHARS_PER_TOKEN,
          requestBodyBytes: 4_000,
        },);
        expect(estimate.completionTokens,).toBe(10,);
        expect(estimate.promptTokens,).toBe(1_000,);
        expect(estimate.usd,).toBeCloseTo(
          ((1_000 * info.promptUsdPerMillion) + (10 * info.completionUsdPerMillion)) / MILLION,
          12,
        );
      },
    },),
  ],
},);

await describe({
  name: reportAbandonedSpend.name,
  children: [
    it({
      name: 'WRITES a SPEND line marked estimated=abandoned for a cut stream, in the grammar the '
        + 'reader already parses, and moves the run meter by the reckoned USD',
      fn: async () => {
        resetRunSpend();
        /**
         Line the report logged.
         */
        const report = reportAbandonedSpend({
          servedId: 'minimax/minimax-m3',
          error: CUT,
          requestBodyBytes: 4_000,
        },);
        if (report === 'not-reported')
          throw new Error('expected a line',);
        expect(report.line.startsWith('SPEND provider=openrouter model=minimax/minimax-m3 prompt=1000 completion=10 cost=',),).toBe(true,);
        expect(report.line.endsWith(' estimated=abandoned',),).toBe(true,);
        expect(runSpendUsd({ provider: 'openrouter', },),).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'WRITES NOTHING for an error that says nothing about what was delivered, since a reckoning '
        + 'off nothing would be a number nobody measured',
      fn: async () => {
        resetRunSpend();
        expect(reportAbandonedSpend({
          servedId: 'minimax/minimax-m3',
          error: new Error('HTTP 502',),
          requestBodyBytes: 4_000,
        },),).toBe('not-reported',);
        expect(runSpendUsd({ provider: 'openrouter', },),).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: exchangeReportingAbandon.name,
  children: [
    it({
      name: 'RETURNS the exchange\'s reply untouched when it completes, and on a cut stream writes '
        + 'the reckoned line and rethrows the same error',
      fn: async () => {
        resetRunSpend();
        expect(await exchangeReportingAbandon({
          servedId: 'minimax/minimax-m3',
          requestBodyBytes: 10,
          exchange: async () => ({ status: 200, bodyText: 'data: [DONE]\n\n', }),
        },),).toEqual({ status: 200, bodyText: 'data: [DONE]\n\n', },);
        expect(runSpendUsd({ provider: 'openrouter', },),).toBe(0,);
        await expect(exchangeReportingAbandon({
          servedId: 'minimax/minimax-m3',
          requestBodyBytes: 4_000,
          exchange: async () => {
            throw CUT;
          },
        },),).rejects.toBe(CUT,);
        expect(runSpendUsd({ provider: 'openrouter', },),).toBeGreaterThan(0,);
      },
    },),
  ],
},);
