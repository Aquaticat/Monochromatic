/**
 * Tests for reading back what a slice cost.
 *
 * THE CASE THAT DECIDES THIS PAIR is the round trip. The writer and the reader
 * are the only two things that know this line's shape, and they live in separate
 * files, so a reformatted message would leave a pass logging costs nobody can
 * read while every other test still passed.
 *
 * The refusals matter for a second reason: a log is written WHILE a pass runs,
 * so its last line can be half-written. A reader that skipped malformed lines in
 * silence would report a smaller corpus without ever saying it had.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  armSliceCost,
  readSliceCosts,
} from '../dist/final/node/index.mjs';

/**
 * Collects what a lane logged, so a written line can be read back.
 *
 * @param lines - array every message is appended to
 *
 * @returns Logger writing only to that array
 *
 * @example
 * ```ts
 * const said: string[] = [];
 * const l = capturingLogger({ lines: said, },);
 * ```
 */
function capturingLogger({ lines, }: { readonly lines: string[]; },): Logger {
  /**
   * Appends one message, whatever level asked.
   */
  function keep(message: string,): void {
    lines.push(message,);
  }

  return {
    debug: keep,
    error: keep,
    fatal: keep,
    info: keep,
    trace: keep,
    warn: keep,
    flush: async function flush(): Promise<void> {},
  };
}

/**
 * Log holding one cost line per lane, among lines about other things.
 */
const TWO_LANE_LOG = [
  '[info] [2026-08-17T01:17:12.580Z] [Mittens] [repairPreparedDocument] critic stage: 6/6 heard',
  '[info] [2026-08-17T01:17:13.000Z] [Mittens] [repairPreparedDocument] SLICE-COST lane=repair '
  + 'chunk=0 sourceChars=812 ms=45210',
  '[info] [2026-08-17T01:17:14.000Z] [Mittens] [translateDocument] SLICE-COST lane=translate '
  + 'chunk=1 sourceChars=1204 ms=88130',
  '[info] [2026-08-17T01:17:15.000Z] [Mittens] [drainBody] stream finished, 671606 chars',
].join('\n',);

await describe({
  name: readSliceCosts.name,
  children: [
    it({
      name:
        'ACCEPTS a cost line from each lane and ignores every line that carries no marker, so a pass '
        + 'log can be read without being filtered first',
      fn: async () => {
        const { rows, dropped, } = readSliceCosts({ log: TWO_LANE_LOG, },);
        expect(dropped,).toHaveLength(0,);
        expect(rows,).toHaveLength(2,);
        expect(rows[0],).toEqual({
          lane: 'repair',
          chunkIndex: 0,
          sourceChars: 812,
          elapsedMs: 45210,
        },);
        expect(rows[1]
          ?.lane,).toBe('translate',);
        expect(rows[1]
          ?.elapsedMs,).toBe(88130,);
      },
    },),
    it({
      name:
        'REFUSES a half-written line and names every field it lacks, because a log is written while a '
        + 'pass runs and its last line can be cut mid-word',
      fn: async () => {
        const { rows, dropped, } = readSliceCosts({
          log: 'SLICE-COST lane=repair chunk=4 sourceCh',
        },);
        expect(rows,).toHaveLength(0,);
        expect(dropped,).toHaveLength(1,);
        expect(dropped[0],).toBe('sourceChars missing, ms missing',);
      },
    },),
    it({
      name: 'REFUSES a lane it does not know, rather than counting it under one it does',
      fn: async () => {
        const { rows, dropped, } = readSliceCosts({
          log: 'SLICE-COST lane=refine chunk=4 sourceChars=10 ms=20',
        },);
        expect(rows,).toHaveLength(0,);
        expect(dropped[0],).toBe('lane refine',);
      },
    },),
    it({
      name:
        'REFUSES a measurement that is not a whole number, which is what a truncated or garbled '
        + 'duration looks like',
      fn: async () => {
        const { rows, dropped, } = readSliceCosts({
          log: 'SLICE-COST lane=repair chunk=4 sourceChars=10 ms=45e',
        },);
        expect(rows,).toHaveLength(0,);
        expect(dropped[0],).toBe('ms 45e',);
      },
    },),
    it({
      name: 'reports nothing at all, not even a refusal, for a log that mentions no cost',
      fn: async () => {
        const { rows, dropped, } = readSliceCosts({ log: 'three cats, no costs\nnor here', },);
        expect(rows,).toHaveLength(0,);
        expect(dropped,).toHaveLength(0,);
      },
    },),
  ],
},);

await describe({
  name: armSliceCost.name,
  children: [
    it({
      name:
        'REPORTS a slice that was left EARLY, which is the case a closing call would miss: both lanes '
        + 'leave their loop body by more than one path',
      fn: async () => {
        const said: string[] = [];

        /**
         * Loop that leaves its body early for every slice, as a lane does for a
         * slice it has nothing to do with.
         */
        for (const chunkIndex of [
          0,
          1,
        ]) {
          using cost = armSliceCost({
            l: capturingLogger({ lines: said, },),
            lane: 'repair',
            chunkIndex,
            sourceChars: 7,
          },);

          continue;
        }

        expect(said,).toHaveLength(2,);
      },
    },),
    it({
      name:
        'writes a line THIS READER can read, which is the only thing keeping the two files agreed '
        + 'about a shape neither one owns',
      fn: async () => {
        const said: string[] = [];
        {
          using cost = armSliceCost({
            l: capturingLogger({ lines: said, },),
            lane: 'translate',
            chunkIndex: 12,
            sourceChars: 843,
          },);
        }

        const { rows, dropped, } = readSliceCosts({ log: said.join('\n',), },);
        expect(dropped,).toHaveLength(0,);
        expect(rows,).toHaveLength(1,);
        expect(rows[0]
          ?.lane,).toBe('translate',);
        expect(rows[0]
          ?.chunkIndex,).toBe(12,);
        expect(rows[0]
          ?.sourceChars,).toBe(843,);
      },
    },),
  ],
},);
