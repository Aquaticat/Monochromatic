/**
 * Tests for reading `SPEND` lines back out of a run log.
 *
 * THE CASE THAT BINDS THE PAIR is the round trip: a line `reportSpend` returned
 * is handed straight to `readSpendLine`. Writing that case is what found the
 * defect it now guards, since the marker originally carried a leading space and
 * the writer's own output read as prose.
 *
 * PROSE MENTIONING THE MARKER IS NOT A RECORD, and gets its own case. A run log
 * carries commit messages, task notes and test output, any of which may write
 * the word. `meter-sample-read.ts` learned this from its own summary line,
 * which claimed a hole in a log that had none.
 *
 * A RECORD THAT WILL NOT PARSE IS COUNTED, NOT DROPPED, which is the other half
 * of the same discipline: a reader that skipped malformed records would report
 * a cleaner log than the one it read, and interleaved writes from concurrent
 * stages produce them.
 *
 * Model identifiers come from the catalog. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  readSpendLine,
  reportSpend,
  tallySpend,
} from '../../dist/final/node/index.mjs';

/**
 * Log line as a logger writes one, tags and stamp in front of the record.
 *
 * @param tail - record text, marker word onward
 *
 * @returns Line shaped the way a run log holds it
 *
 * @example
 * ```ts
 * const line = logged({ tail: 'SPEND provider=hyper model=m prompt=1 completion=2', },);
 * ```
 */
function logged({ tail, }: { readonly tail: string; },): string {
  return `[info] [2026-08-25T01:28:57.289Z] [translation-repair] [reportSpend] ${tail}`;
}

/**
 * Record naming the metered provider, used wherever a case needs a valid one.
 */
const HYPER_TAIL = 'SPEND provider=hyper model=qwen3.8-max prompt=5120 completion=3072';

await describe({
  name: readSpendLine.name,
  children: [
    it({
      name: 'READS a record out of a logged line, which is the control the rest '
        + 'of these cases depart from one field at a time',
      fn: async () => {
        expect(readSpendLine({ line: logged({ tail: HYPER_TAIL, },), },),)
          .toEqual({
            provider: 'hyper',
            model: 'qwen3.8-max',
            prompt: 5_120,
            completion: 3_072,
          },);
      },
    },),

    it({
      name: 'READS a line the writer returned, with no logger prefix in front '
        + 'of it, so what `reportSpend` hands back round-trips through this '
        + 'reader rather than reading as prose',
      fn: async () => {
        expect(
          readSpendLine({
            line: reportSpend({
              provider: 'hyper',
              label: 'minimax-m3',
              extracted: {
                text: 'The cat approved this rendering.',
                usage: {
                  prompt_tokens: 12,
                  completion_tokens: 34,
                },
              },
            },),
          },),
        )
          .toEqual({
            provider: 'hyper',
            model: 'minimax-m3',
            prompt: 12,
            completion: 34,
          },);
      },
    },),

    it({
      name: 'KEEPS a provider silence as the named absence rather than folding '
        + 'it into zero, since a run nobody metered and a run that spent nothing '
        + 'are not the same run',
      fn: async () => {
        expect(
          readSpendLine({
            line: logged({
              tail: 'SPEND provider=hyper model=qwen3.8-max prompt=unreported completion=unreported',
            },),
          },),
        )
          .toEqual({
            provider: 'hyper',
            model: 'qwen3.8-max',
            prompt: 'unreported',
            completion: 'unreported',
          },);
      },
    },),

    it({
      name: 'READS a model id carrying colons, slashes and dots, which every '
        + 'Synthetic seat does',
      fn: async () => {
        expect(
          readSpendLine({
            line: logged({
              tail: 'SPEND provider=synthetic model=hf:zai-org/GLM-5.2 prompt=1 completion=2',
            },),
          },),
        )
          .toEqual({
            provider: 'synthetic',
            model: 'hf:zai-org/GLM-5.2',
            prompt: 1,
            completion: 2,
          },);
      },
    },),

    it({
      name: 'REPORTS an ordinary log line as no record at all',
      fn: async () => {
        expect(
          readSpendLine({
            line: logged({ tail: 'stream qwen3.8-max: completed, firstByte 2111ms', },),
          },),
        )
          .toBe('not-a-record',);
      },
    },),

    it({
      name: 'REPORTS prose that mentions the marker as no record, since a run '
        + 'log carries notes and test output that write the word and a hole '
        + 'claimed in a whole log is worse than a line skipped',
      fn: async () => {
        expect(
          readSpendLine({
            line: logged({ tail: 'the SPEND line above is the record for this call', },),
          },),
        )
          .toBe('not-a-record',);
      },
    },),

    it({
      name: 'REPORTS a record truncated before its model as unreadable rather '
        + 'than as no record, so an interleaved write is counted',
      fn: async () => {
        expect(readSpendLine({ line: logged({ tail: 'SPEND provider=hyper mod', },), },),)
          .toBe('unreadable',);
      },
    },),

    it({
      name: 'REPORTS a count that is not a number as unreadable, against the '
        + 'same rule that just accepted the named absence: one is a value this '
        + 'writer emits and the other is damage',
      fn: async () => {
        expect(
          readSpendLine({
            line: logged({
              tail: 'SPEND provider=hyper model=qwen3.8-max prompt=lots completion=3072',
            },),
          },),
        )
          .toBe('unreadable',);
      },
    },),

    it({
      name: 'REPORTS a negative count as unreadable, since a token count is a '
        + 'count and a sum over one would understate the bill',
      fn: async () => {
        expect(
          readSpendLine({
            line: logged({
              tail: 'SPEND provider=hyper model=qwen3.8-max prompt=-1 completion=3072',
            },),
          },),
        )
          .toBe('unreadable',);
      },
    },),

    it({
      name: 'REPORTS an empty count as unreadable rather than as zero, which is '
        + 'what `Number` alone would have made of it',
      fn: async () => {
        expect(
          readSpendLine({
            line: logged({
              tail: 'SPEND provider=hyper model=qwen3.8-max prompt= completion=3072',
            },),
          },),
        )
          .toBe('unreadable',);
      },
    },),

    it({
      name: 'REPORTS an unknown provider as unreadable, so a third meter added '
        + 'later cannot be silently totalled against the two that are priced',
      fn: async () => {
        expect(
          readSpendLine({
            line: logged({
              tail: 'SPEND provider=bookshop model=qwen3.8-max prompt=1 completion=2',
            },),
          },),
        )
          .toBe('unreadable',);
      },
    },),
  ],
},);

await describe({
  name: tallySpend.name,
  children: [
    it({
      name: 'SUMS calls and both token counts per seat',
      fn: async () => {
        expect(
          tallySpend({
            lines: [
              logged({ tail: HYPER_TAIL, },),
              logged({ tail: HYPER_TAIL, },),
            ],
          },).seats,
        )
          .toEqual([
            {
              provider: 'hyper',
              model: 'qwen3.8-max',
              calls: 2,
              promptTokens: 10_240,
              completionTokens: 6_144,
              unreportedCalls: 0,
            },
          ],);
      },
    },),

    it({
      name: 'KEEPS one model served by both providers as two seats, since only '
        + 'one of the two meters is priced per token',
      fn: async () => {
        expect(
          tallySpend({
            lines: [
              logged({ tail: 'SPEND provider=hyper model=kimi-k3 prompt=1 completion=2', },),
              logged({ tail: 'SPEND provider=synthetic model=kimi-k3 prompt=3 completion=4', },),
            ],
          },)
            .seats
            .length,
        )
          .toBe(2,);
      },
    },),

    it({
      name: 'COUNTS an unreported call beside the totals rather than inside '
        + 'them, so a reader can see how much of the run the floor covers',
      fn: async () => {
        expect(
          tallySpend({
            lines: [
              logged({ tail: HYPER_TAIL, },),
              logged({
                tail: 'SPEND provider=hyper model=qwen3.8-max prompt=unreported completion=unreported',
              },),
            ],
          },).seats,
        )
          .toEqual([
            {
              provider: 'hyper',
              model: 'qwen3.8-max',
              calls: 2,
              promptTokens: 5_120,
              completionTokens: 3_072,
              unreportedCalls: 1,
            },
          ],);
      },
    },),

    it({
      name: 'COUNTS a record that will not parse rather than dropping it, so a '
        + 'damaged log cannot report as a clean one',
      fn: async () => {
        expect(
          tallySpend({
            lines: [
              logged({ tail: HYPER_TAIL, },),
              logged({ tail: 'SPEND provider=hyper mod', },),
              logged({ tail: 'an ordinary line', },),
            ],
          },).unreadableLines,
        )
          .toBe(1,);
      },
    },),

    it({
      name: 'ORDERS the seats by completion tokens, so the seat that cost the '
        + 'most reads first and thinking is what ranks it',
      fn: async () => {
        expect(
          tallySpend({
            lines: [
              logged({ tail: 'SPEND provider=hyper model=gemma-4-26b-a4b-it prompt=9 completion=1', },),
              logged({ tail: 'SPEND provider=hyper model=qwen3.8-max prompt=1 completion=99', },),
            ],
          },)
            .seats
            .map(function named(seat,): string {
              return seat.model;
            },),
        )
          .toEqual([
            'qwen3.8-max',
            'gemma-4-26b-a4b-it',
          ],);
      },
    },),

    it({
      name: 'REPORTS no seats and no damage for a log that never called a '
        + 'model, rather than inventing a zero-cost seat',
      fn: async () => {
        expect(tallySpend({ lines: [logged({ tail: 'nothing happened', },),], },),)
          .toEqual({
            seats: [],
            unreadableLines: 0,
          },);
      },
    },),
  ],
},);
