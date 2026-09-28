/**
 Tests for the reckoned spend line an abandoned OpenRouter stream writes.
 
 Between the top-up of 2026-09-08 and the refusal of 2026-09-09 the log
 summed 141.62 USD where the meter moved 199.92, the difference being
 streams the rounds abandoned and no line recorded. These cases pin the
 reckoning, the line's mark, the run meter moving, and silence where the
 error says nothing about what was delivered.

 ONE UNIT (ledger P7, 2026-09-28). The reckoning divides raw wire characters
 by a raw-characters-per-token ratio, and a cut stream carried raw
 characters while an overrun or a degenerate ending carried one channel's
 decoded count, so those two read about a hundredth of what they cost
 (`completion=5` for 1,633 content characters on shihai4h2). And no call is
 billed past the `max_tokens` it sent, so neither is the reckoning.
 
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
  MODEL_CARDS,
  OPENROUTER_MODELS,
  reportAbandonedSpend,
  resetRunSpend,
  runSpendUsd,
  StreamCutShortError,
  StreamDegenerateError,
  StreamOverrunError,
} from '../dist/final/node/index.mjs';

/**
 Raw characters the reckoning divides by for MiniMax M3, as its card
 measured them.
 */
const MINIMAX_RAW_CHARS_PER_TOKEN = (function measuredRatio(): number {
  /**
   Ratio the card carries.
   */
  const ratio = MODEL_CARDS['minimax-m3'].openrouter?.rawCharsPerToken;
  if ((typeof ratio) !== 'number')
    throw new Error('the MiniMax M3 card carries a measured ratio',);
  return ratio as number;
})();

/**
 Raw characters a cut stream delivered, ten tokens at MiniMax M3's ratio.
 */
const TEN_TOKENS_RAW = 10 * MINIMAX_RAW_CHARS_PER_TOKEN;

/**
 A cut stream that delivered ten tokens' worth of raw characters.
 */
const CUT = new StreamCutShortError({
  label: 'minimax/minimax-m3',
  partialText: 'x'.repeat(TEN_TOKENS_RAW,),
  progress: {
    firstByteMs: 500,
    maxGapMs: 100,
    elapsedMs: 4_000,
    chars: TEN_TOKENS_RAW,
  },
  cause: new Error('abandoned',),
},);

/**
 Ceiling far above anything these fixtures deliver, for the cases that are
 not about the ceiling.
 */
const ROOMY_MAX_TOKENS = 100_000;

/**
 Tokens in one million, the listing's unit.
 */
const MILLION = 1_000_000;

await describe({
  name: deliveredCharsOf.name,
  children: [
    it({
      name: 'READS RAW WIRE CHARACTERS off a cut stream and off both streams this pipeline ends, never one '
        + 'channel\'s decoded count, and answers nothing-known for any other error',
      fn: async () => {
        expect({
          cut: deliveredCharsOf({ error: CUT, },),
          overrun: deliveredCharsOf({
            error: new StreamOverrunError({
              label: 'minimax/minimax-m3',
              channel: 'reasoning',
              charsSeen: 274,
              cap: 200,
              rawChars: 27_400,
            },),
          },),
          degenerate: deliveredCharsOf({
            error: new StreamDegenerateError({
              label: 'minimax/minimax-m3',
              channel: 'content',
              distinctRatio: 0.02,
              charsSeen: 500,
              rawChars: 50_000,
            },),
          },),
          other: deliveredCharsOf({ error: new Error('HTTP 502',), },),
        },).toEqual({
          cut: TEN_TOKENS_RAW,
          overrun: 27_400,
          degenerate: 50_000,
          other: 'nothing-known',
        },);
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
          deliveredChars: TEN_TOKENS_RAW,
          requestBodyBytes: 4_000,
          maxTokens: ROOMY_MAX_TOKENS,
        },);
        expect(estimate.completionTokens,).toBe(10,);
        expect(estimate.promptTokens,).toBe(1_000,);
        expect(estimate.usd,).toBeCloseTo(
          ((1_000 * info.promptUsdPerMillion) + (10 * info.completionUsdPerMillion)) / MILLION,
          12,
        );
      },
    },),
    it({
      name: 'NEVER RECKONS MORE COMPLETION TOKENS THAN THE CALL SENT AS max_tokens, since the endpoint '
        + 'bills none past it',
      fn: async () => {
        /**
         Ceiling the call sent, below what the delivered characters stand for.
         */
        const maxTokens = 4;
        expect(estimateAbandonedSpend({
          servedId: 'minimax/minimax-m3',
          deliveredChars: TEN_TOKENS_RAW,
          requestBodyBytes: 4_000,
          maxTokens,
        },).completionTokens,).toBe(maxTokens,);
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
          maxTokens: ROOMY_MAX_TOKENS,
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
          maxTokens: ROOMY_MAX_TOKENS,
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
          maxTokens: ROOMY_MAX_TOKENS,
          exchange: async () => ({ status: 200, bodyText: 'data: [DONE]\n\n', }),
        },),).toEqual({ status: 200, bodyText: 'data: [DONE]\n\n', },);
        expect(runSpendUsd({ provider: 'openrouter', },),).toBe(0,);
        await expect(exchangeReportingAbandon({
          servedId: 'minimax/minimax-m3',
          requestBodyBytes: 4_000,
          maxTokens: ROOMY_MAX_TOKENS,
          exchange: async () => {
            throw CUT;
          },
        },),).rejects.toBe(CUT,);
        expect(runSpendUsd({ provider: 'openrouter', },),).toBeGreaterThan(0,);
      },
    },),
  ],
},);
