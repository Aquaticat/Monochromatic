import { readFile, } from 'node:fs/promises';

import {
  readSliceCosts,
  type SliceCostRow,
} from '../slice-cost-read.ts';

//region Slice cost report
// Reads the per-slice cost telemetry a pass writes, and answers the one
// question `#92` was left holding.
//
// WHY IT EXISTS AT ALL: `slice-cost-log.ts` writes a line per slice per lane and
// `slice-cost-read.ts` parses them back, and until now NOTHING CALLED THE
// READER. Telemetry written and never read is the failure `#71` names in as many
// words, and it is worse than no telemetry, because it looks like the question
// is covered.
//
// THE QUESTION. `#114` measured that per-slice cost FALLS as entries get larger,
// 7.07 minutes a slice on the smallest entry against 2.47 on the largest, and
// could not say why. Two explanations fit that equally: larger entries have
// larger slices and size is what costs, or cost is mostly a fixed per-slice
// overhead that a larger entry amortises over more content. They imply opposite
// remedies. If size dominates, slicing differently changes the bill; if overhead
// dominates, only asking fewer times does.
//
// THE READING THAT SEPARATES THEM is cost per CHARACTER against slice size. Under
// a size-dominated cost that figure is flat; under a fixed overhead it falls
// steeply as slices grow, because the same overhead is divided by more
// characters.
//
// COSTS NOTHING. It reads a log file and prints.

/**
 * Upper bound of the smallest band, where a slice is barely more than a heading.
 */
const TINY_SLICE_CHARS = 50;

/**
 * Upper bound of the band a short paragraph falls in.
 */
const SMALL_SLICE_CHARS = 200;

/**
 * Upper bound of the band an ordinary paragraph falls in.
 */
const MEDIUM_SLICE_CHARS = 500;

/**
 * Upper bound of the band a long passage falls in.
 */
const LARGE_SLICE_CHARS = 1_000;

/**
 * Upper bound of the last named band; anything above is open-ended.
 */
const HUGE_SLICE_CHARS = 2_000;

/**
 * Buckets slices are grouped into, by size of their original.
 *
 * BOUNDARIES ARE ROUND NUMBERS CHOSEN BEFORE READING ANY DATA, so a reader can
 * see they were not fitted to make a curve look like anything. They exist to
 * spread the corpus's slices across several groups, nothing more.
 */
const SIZE_BUCKETS = [
  TINY_SLICE_CHARS,
  SMALL_SLICE_CHARS,
  MEDIUM_SLICE_CHARS,
  LARGE_SLICE_CHARS,
  HUGE_SLICE_CHARS,
] as const;

/**
 * Milliseconds in a minute, for reporting.
 */
const MS_PER_MINUTE = 60_000;

/**
 * Column widths, so the bands line up under each other and a falling column is
 * visible as a shape rather than as numbers a reader has to compare by eye.
 */
const LABEL_WIDTH = 6;

/**
 * Width the slice count is padded to.
 */
const COUNT_WIDTH = 4;

/**
 * Width the per-slice minutes are padded to.
 */
const MINUTES_WIDTH = 6;

/**
 * Width the per-character milliseconds are padded to.
 */
const PER_CHAR_WIDTH = 7;

/**
 * Width a lane's total minutes are padded to.
 */
const TOTAL_WIDTH = 8;

/**
 * Width a lane name is padded to.
 */
const LANE_WIDTH = 10;

/**
 * Lanes a pass reports, in the order it runs them.
 */
const LANES = [
  'repair',
  'translate',
] as const;

/**
 * What one size bucket amounts to.
 *
 * @example
 * ```ts
 * const bucket: CostBucket = { upTo: 200, slices: 12, chars: 1400, ms: 90000, };
 * ```
 */
type CostBucket = {
  /**
   * Largest source size in this bucket, or `Infinity` for the last.
   */
  readonly upTo: number;

  /**
   * Slices that landed here.
   */
  readonly slices: number;

  /**
   * Characters they carried in total.
   */
  readonly chars: number;

  /**
   * Wall time they took in total.
   */
  readonly ms: number;
};

/**
 * Groups rows by the size of the original they translated.
 *
 * ONLY `computed` ROWS COUNT. A cached slice reports the microseconds it took to
 * read a file and a skipped one reports nothing worth pricing; averaging those
 * in would report a pipeline far cheaper than the one that runs.
 *
 * @param rows - every parsed cost line
 *
 * @returns One bucket per size band, smallest first
 *
 * @example
 * ```ts
 * const buckets = bucketBySize({ rows, },);
 * ```
 */
function bucketBySize(
  { rows, }: { readonly rows: readonly SliceCostRow[]; },
): readonly CostBucket[] {
  /**
   * Rows that priced real work.
   */
  const computed = rows.filter(function didWork(row,): boolean {
    return row.exit === 'computed';
  },);

  /**
   * Upper bounds, with an open-ended last band.
   */
  const bounds = [
    ...SIZE_BUCKETS,
    Number.POSITIVE_INFINITY,
  ];

  return bounds.map(function summarise(
    upTo,
    at,
  ): CostBucket {
    /**
     * Smallest size this band accepts.
     */
    const from = (at === 0) ? 0 : (bounds[at - 1] ?? 0);

    /**
     * Rows in this band.
     */
    const mine = computed.filter(function inBand(row,): boolean {
      return (row.sourceChars >= from) && (row.sourceChars < upTo);
    },);

    return {
      upTo,
      slices: mine.length,
      chars: mine.reduce(
        function addChars(
          sum,
          row,
        ): number {
          return sum + row.sourceChars;
        },
        0,
      ),
      ms: mine.reduce(
        function addMs(
          sum,
          row,
        ): number {
          return sum + row.elapsedMs;
        },
        0,
      ),
    };
  },);
}

/**
 * Prints one bucket, with the two figures that separate the explanations.
 *
 * @param bucket - one size band
 *
 * @example
 * ```ts
 * printBucket({ bucket, },);
 * ```
 */
function printBucket({ bucket, }: { readonly bucket: CostBucket; },): void {
  if (bucket.slices === 0)
    return;

  /**
   * Wall time a slice in this band costs.
   */
  const perSlice = bucket.ms / bucket.slices;

  /**
   * Wall time a CHARACTER in this band costs, which is the figure that tells a
   * fixed overhead from a size-driven cost.
   */
  const perChar = (bucket.chars === 0) ? 0 : (bucket.ms / bucket.chars);

  /**
   * Band label, open-ended for the last one.
   */
  const label = (bucket.upTo === Number.POSITIVE_INFINITY) ? 'any' : String(bucket.upTo,);

  /**
   * Minutes a slice costs here, rendered.
   */
  const minutes = (perSlice / MS_PER_MINUTE).toFixed(2,);

  /**
   * Milliseconds a character costs here, rendered.
   */
  const perCharText = perChar.toFixed(1,);

  /**
   * Slice count, rendered.
   */
  const count = String(bucket.slices,);

  console.log(
    `  under ${label.padStart(LABEL_WIDTH,)} chars  slices ${count.padStart(COUNT_WIDTH,)}`
      + `  min/slice ${minutes.padStart(MINUTES_WIDTH,)}`
      + `  ms/char ${perCharText.padStart(PER_CHAR_WIDTH,)}`,
  );
}

/**
 * Reads a pass log and reports what its slices cost.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Log to read, named on the command line.
   */
  const path = process.argv[2] ?? '';
  if (path === '')
    throw new Error('name a log file: slice-cost-report <path>',);

  /**
   * Everything its cost lines said.
   */
  const {
    rows,
    dropped,
  } = readSliceCosts({
    log: await readFile(
      path,
      'utf8',
    ),
  },);

  console.log(`${path}\n${String(rows.length,)} cost lines, ${String(dropped.length,)} dropped\n`,);
  if (rows.length === 0) {
    console.log('NOTHING TO READ YET. A pass writes these as it goes, so an empty'
      + ' reading means the run has not finished a slice rather than that slices are free.',);
    return;
  }

  console.log('WHAT A SLICE COSTS, BY THE SIZE OF ITS ORIGINAL',);
  /**
   * Every band, smallest first.
   */
  const buckets = bucketBySize({ rows, },);
  buckets.forEach(function show(bucket,): void {
    printBucket({ bucket, },);
  },);

  console.log(
    '\nREAD THE ms/char COLUMN. Flat across bands means size drives the cost and'
      + ' slicing differently changes the bill. Falling steeply as slices grow means'
      + ' a fixed per-slice overhead divided by more characters, and only asking'
      + ' fewer times changes anything. `#92` and `#114`.',
  );

  console.log('\nBY LANE',);
  LANES.forEach(function perLane(lane,): void {
    /**
     * This lane's computed slices.
     */
    const mine = rows.filter(function isMine(row,): boolean {
      return (row.lane === lane) && (row.exit === 'computed');
    },);
    if (mine.length === 0)
      return;

    /**
     * What it spent.
     */
    const ms = mine.reduce(
      function addMs(
        sum,
        row,
      ): number {
        return sum + row.elapsedMs;
      },
      0,
    );
    /**
     * Minutes this lane spent, rendered.
     */
    const spent = (ms / MS_PER_MINUTE).toFixed(1,);

    /**
     * Slice count for this lane, rendered.
     */
    const count = String(mine.length,);

    console.log(
      `  ${lane.padEnd(LANE_WIDTH,)} slices ${count.padStart(COUNT_WIDTH,)}`
        + `  total ${spent.padStart(TOTAL_WIDTH,)} min`,
    );
  },);
}

if (import.meta.main)
  await main();

//endregion Slice cost report
