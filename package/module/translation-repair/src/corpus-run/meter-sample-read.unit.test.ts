/**
 * Tests for reading availability records back out of a log.
 *
 * THE FIXTURE LINES ARE REAL SHAPES, copied from what the console sink writes:
 * `[level] [iso] [tag] [tag] message`. A test built on an invented prefix would
 * pass while the reader failed on every line the pipeline actually produces.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  readMeterLine,
  readMeterLog,
} from '../../dist/final/node/index.mjs';

/**
 * A record exactly as `takeReading` writes one.
 */
const REAL_LINE =
  '[info] [2026-08-24T18:17:35.383Z] [translation-repair] [takeReading] '
    + 'METERS synthetic=wet hyper=dry';

/**
 * The sampler's own summary, which mentions the marker in prose.
 *
 * THIS LINE IS WHY THE GATE EXISTS. Read back off a real sample, it counted
 * as a record that would not parse and reported a hole in an intact log.
 */
const PROSE_LINE =
  '[info] [2026-08-24T18:17:35.383Z] [translation-repair] [sampleBudgets] '
    + 'SAMPLED: routing would use synthetic. The METERS line above is the record';

await describe({
  name: readMeterLine.name,
  children: [
    it({
      name: 'reads a record the pipeline actually wrote',
      fn: async () => {
        expect(readMeterLine({ line: REAL_LINE, },),).toEqual({
          at: Date.parse('2026-08-24T18:17:35.383Z',),
          synthetic: 'wet',
          hyper: 'dry',
        },);
      },
    },),

    it({
      name: 'reads an unreadable meter as its own state rather than as budget left',
      fn: async () => {
        /**
         * A record taken while one provider's meter endpoint was down.
         */
        const line = '[info] [2026-08-24T10:00:00.000Z] [t] [takeReading] '
          + 'METERS synthetic=unreadable hyper=wet';

        expect(readMeterLine({ line, },),).toEqual({
          at: Date.parse('2026-08-24T10:00:00.000Z',),
          synthetic: 'unreadable',
          hyper: 'wet',
        },);
      },
    },),

    it({
      name: 'REFUSES to treat prose mentioning the marker as a record',
      fn: async () => {
        expect(readMeterLine({ line: PROSE_LINE, },),).toBe('not-a-record',);
      },
    },),

    it({
      name: 'ignores an ordinary log line',
      fn: async () => {
        /**
         * A line from elsewhere in the pipeline entirely.
         */
        const line = '[info] [2026-08-24T10:00:00.000Z] [t] [runEntry] settled XYZ';

        expect(readMeterLine({ line, },),).toBe('not-a-record',);
      },
    },),

    it({
      name: 'ACCEPTS a record with no readable stamp as a skip, not as a reading',
      fn: async () => {
        /**
         * A record whose prefix was mangled, which a truncated write produces.
         */
        const line = '[info] [not-a-date] [t] [takeReading] METERS synthetic=wet hyper=wet';

        expect(readMeterLine({ line, },),).toBe('skipped',);
      },
    },),

    it({
      name: 'ACCEPTS a record cut off part way as a skip, so the hole stays visible',
      fn: async () => {
        /**
         * A record whose second field never made it to disk. Its first field
         * still parses, which is what keeps it counted rather than ignored.
         */
        const line = '[info] [2026-08-24T10:00:00.000Z] [t] [takeReading] METERS synthetic=wet hyp';

        expect(readMeterLine({ line, },),).toBe('skipped',);
      },
    },),
  ],
},);

await describe({
  name: readMeterLog.name,
  children: [
    it({
      name: 'separates readings from holes across a whole log',
      fn: async () => {
        /**
         * A log carrying one good record, one prose mention, one ordinary
         * line, and one truncated record.
         */
        const text = [
          REAL_LINE,
          PROSE_LINE,
          '[info] [2026-08-24T10:00:00.000Z] [t] [runEntry] settled XYZ',
          '[info] [2026-08-24T10:00:00.000Z] [t] [takeReading] METERS synthetic=dry hyp',
        ].join('\n',);

        /**
         * What the log yielded.
         */
        const {
          samples,
          skippedLines,
        } = readMeterLog({ text, },);

        expect(samples.length,).toBe(1,);
        expect(skippedLines,).toBe(1,);
        expect(samples[0]?.hyper,).toBe('dry',);
      },
    },),

    it({
      name: 'ACCEPTS a log with no records at all, reporting neither readings nor holes',
      fn: async () => {
        expect(readMeterLog({ text: 'nothing here\nnor here\n', },),).toEqual({
          samples: [],
          skippedLines: 0,
        },);
      },
    },),
  ],
},);
