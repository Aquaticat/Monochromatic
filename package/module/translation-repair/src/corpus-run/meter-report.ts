import { readFile, } from 'node:fs/promises';

import {
  PROVIDER_ORDER,
  type ProviderName,
} from '../provider-name.ts';
import {
  countStates,
  drySpans,
  dutyCycle,
  longestDrySpan,
  seriesFor,
  type DrySpan,
} from './meter-dry-span.ts';
import {
  readMeterLog,
  type MeterSample,
} from './meter-sample-read.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';

//region Meter report
// Reads run logs and says how much of the time each provider could be spent
// on, and the longest stretch it could not.
//
// THIS EXISTS TO PRICE A SEAT. Three writer seats sit on models only the second
// provider serves, and the argument for them rested on a 40-round quality pass
// plus an availability adjustment that was reasoned about rather than measured.
// A seat on a provider that is out a third of the time is a different seat from
// one on a provider that is out an hour a week, and nothing could tell those
// apart from a run log until the reading was promoted out of debug.
//
// SPENDS NO QUOTA AND TOUCHES NO MODEL. It reads files.
//
// WHAT IT WILL NOT DO IS TURN A SPARSE RECORD INTO A CONFIDENT NUMBER. Readings
// happen when a run asks for one, so the record is dense while work is running
// and empty otherwise, and every outage is reported as a range with its open
// ends named. A duty cycle here is availability WHEN WE WERE ASKING, which is
// the quantity that prices a seat, and is not the same as availability.

/**
 * Exit code left behind when the logs held no reading at all.
 */
const NOTHING_RECORDED = 1;

/**
 * Milliseconds in each unit a duration is rendered in.
 */
const UNIT_MS = {
  h: 3_600_000,
  m: 60_000,
  s: 1_000,
} as const;

/**
 * Renders a duration in hours, minutes and seconds, dropping empty leaders.
 *
 * @param ms - duration to render
 *
 * @returns Compact duration, `0s` for nothing
 *
 * @example
 * ```ts
 * spanText({ ms: 3_720_000, },);
 * // => '1h2m'
 * ```
 */
function spanText(
  { ms, }: { readonly ms: number; },
): string {
  /**
   * Whole hours the duration covers.
   */
  const hours = Math.floor(ms / UNIT_MS.h,);

  /**
   * Whole minutes left after those hours.
   */
  const minutes = Math.floor((ms % UNIT_MS.h) / UNIT_MS.m,);

  /**
   * Whole seconds left after those minutes.
   */
  const seconds = Math.floor((ms % UNIT_MS.m) / UNIT_MS.s,);

  /**
   * Units that carry anything, so `2h0m5s` reads as `2h5s`.
   */
  const carried = ((hours > 0) ? `${String(hours,)}h` : '')
    + ((minutes > 0) ? `${String(minutes,)}m` : '')
    + ((seconds > 0) ? `${String(seconds,)}s` : '');

  if (carried === '')
    return '0s';

  return carried;
}

/**
 * Renders an epoch stamp the way the log wrote it.
 *
 * @param at - epoch milliseconds
 *
 * @returns ISO stamp
 *
 * @example
 * ```ts
 * stampText({ at, },);
 * ```
 */
function stampText(
  { at, }: { readonly at: number; },
): string {
  return new Date(at,).toISOString();
}

/**
 * Renders what is known about the longest outage, bounds and open ends both.
 *
 * NAMES AN OPEN END RATHER THAN PRINTING A NUMBER FOR IT. A stretch with no
 * wet reading before it may have started before the record; one with none
 * after it may still be running now. Either way the upper bound is not a
 * number, and printing the confirmed length alone would read as the whole
 * outage.
 *
 * @param span - longest stretch, absent where none was found
 *
 * @returns Lines describing it
 *
 * @example
 * ```ts
 * for (const line of outageLines({ span, },)) console.log(line,);
 * ```
 */
function outageLines(
  { span, }: { readonly span: DrySpan | 'no-outage'; },
): readonly string[] {
  if (span === 'no-outage')
    return ['  longest outage: none, no reading found this provider out',];

  /**
   * How the upper bound reads, which is a number only when both ends closed.
   */
  const upper = (span.boundedByMs === undefined)
    ? 'and NOT BOUNDED ABOVE'
    : `at most ${spanText({ ms: span.boundedByMs, },)}`;

  /**
   * Why the bound is open, named so the reader knows which way to doubt it.
   */
  const openness = [
    ...(span.openBefore
      ? ['    no reading before it found this provider up, so it may have begun earlier than the record',]
      : []),
    ...(span.openAfter
      ? ['    no reading after it found this provider up, so it may still be running',]
      : []),
  ];

  return [
    `  longest outage: at least ${spanText({ ms: span.confirmedMs, },)}, ${upper} `
      + `(${stampText({ at: span.firstAt, },)} .. ${stampText({ at: span.lastAt, },)})`,
    ...openness,
  ];
}

/**
 * One reading that named a level for the provider being reported on.
 */
type LevelReading = {
  /**
   * Epoch milliseconds the reading was taken at.
   */
  readonly at: number;

  /**
   * That provider's fields on that reading.
   */
  readonly fields: readonly string[];
};

/**
 * A reading, or that it named no level for this provider.
 */
type LevelLookup = LevelReading | 'no-level';

/**
 * Narrows a lookup to a reading that named something.
 *
 * POSITIONAL RATHER THAN DESTRUCTURED, for the reason `isMeterState` in
 * `meter-sample-read.ts` is: TypeScript refuses a type predicate naming an
 * element of a binding pattern.
 *
 * @param lookup - what one reading yielded
 *
 * @returns Whether it named a level
 *
 * @example
 * ```ts
 * lookups.filter(namedALevel,);
 * ```
 */
function namedALevel(lookup: LevelLookup,): lookup is LevelReading {
  return lookup !== 'no-level';
}

/**
 * Renders what one provider's meter was reading, at both ends of the record.
 *
 * TWO ENDS RATHER THAN ONE. The last reading answers what the budget is now;
 * the first says which way it moved to get there, which is the difference
 * between a budget this run drained and one that was empty before it started.
 *
 * SAYS SO WHEN NOTHING WAS RECORDED. A run written before the levels were
 * added carries states and no numbers, and silence there would read as a
 * provider whose meter never said anything.
 *
 * @param samples - every reading, from every log
 *
 * @param provider - provider to report on
 *
 * @returns Lines describing what its meter read
 *
 * @example
 * ```ts
 * for (const line of levelLines({ samples, provider, },)) console.log(line,);
 * ```
 */
function levelLines(
  {
    samples,
    provider,
  }: {
    readonly samples: readonly MeterSample[];
    readonly provider: ProviderName;
  },
): readonly string[] {
  /**
   * Readings that named a level for this provider, in time order.
   *
   * ATTRIBUTED BY NAME PREFIX, which the record's field names are built to
   * carry: neither provider's name is a prefix of the other's.
   */
  const carried = samples
    .map(function forProvider(sample,): LevelLookup {
      /**
       * This provider's level fields on that reading.
       */
      const fields = sample
        .levels
        .filter(function mine(field,): boolean {
          return field.startsWith(provider,);
        },);

      if (fields.length === 0)
        return 'no-level';

      return {
        at: sample.at,
        fields,
      };
    },)
    .filter(namedALevel,);

  /**
   * Earliest reading that named a level.
   */
  const first = carried.at(0,);

  /**
   * Latest reading that named a level.
   */
  const last = carried.at(-1,);

  if ((first === undefined) || (last === undefined))
    return [
      '  level: NOT RECORDED. These readings predate the meter numbers being written down, so a '
        + 'dry one here cannot be told from a threshold that was wrong about a budget that was fine',
    ];

  /**
   * Earliest reading's numbers, rendered for the line.
   */
  const firstFields = first
    .fields
    .join(' ',);

  if (carried.length === 1)
    return [`  level ${stampText({ at: first.at, },)}: ${firstFields}`,];

  /**
   * Latest reading's numbers, rendered the same way.
   */
  const lastFields = last
    .fields
    .join(' ',);

  return [
    `  level first ${stampText({ at: first.at, },)}: ${firstFields}`,
    `  level last ${stampText({ at: last.at, },)}: ${lastFields}`,
  ];
}

/**
 * Reports one provider's availability across the whole record.
 *
 * @param samples - every reading, from every log
 *
 * @param provider - provider to report on
 *
 * @example
 * ```ts
 * reportProvider({ samples, provider: 'hyper', },);
 * ```
 */
function reportProvider(
  {
    samples,
    provider,
  }: {
    readonly samples: readonly MeterSample[];
    readonly provider: ProviderName;
  },
): void {
  /**
   * That provider's readings in time order.
   */
  const series = seriesFor({
    samples,
    provider,
  },);

  /**
   * How many readings fell in each state.
   */
  const counts = countStates({ series, },);

  /**
   * Fraction of answering readings that found budget, absent where none did.
   */
  const wetFraction = dutyCycle({ counts, },);

  /**
   * Readings whose meter answered, which is the fraction's denominator.
   */
  const answered = counts.wet + counts.dry;

  console.log(
    `\n${provider}: wet=${String(counts.wet,)} dry=${String(counts.dry,)} `
      + `unreadable=${String(counts.unreadable,)}`,
  );
  console.log(
    (wetFraction === 'none-answered')
      ? '  spendable on NO MEASURABLE FRACTION: no reading in this record answered'
      : `  spendable on ${(wetFraction * 100).toFixed(1,)}% of readings that answered `
        + `(${String(counts.wet,)} of ${String(answered,)})`,
  );

  for (const line of outageLines({ span: longestDrySpan({ spans: drySpans({ series, },), },), },)) {
    console.log(line,);
  }

  for (const line of levelLines({
    samples,
    provider,
  },)) {
    console.log(line,);
  }
}

/**
 * Reads every named log and reports both providers.
 *
 * Returns nothing: the report on stdout and the exit code ARE the output.
 *
 * @throws {@link Error} when no log path was named
 *
 * @example
 * ```ts
 * await reportMeters();
 * ```
 */
async function reportMeters(): Promise<void> {
  /**
   * Logs to read, named on the command line.
   */
  const paths = process
    .argv
    .slice(2,);

  if (paths.length === 0) {
    throw new StatedRefusalError({
      says: 'name at least one log file: meter-report <path> [<path> ...]. Any log a pass, '
        + 'probe or sample wrote will do, and passing several merges them into one record.',
    },);
  }

  /**
   * Everything every named log held.
   */
  const readings = await Promise.all(paths.map(async function one(path,) {
    return readMeterLog({
      text: await readFile(
        path,
        'utf8',
      ),
    },);
  },),);

  /**
   * Every reading from every log, with exact repeats collapsed so passing one
   * log twice cannot double its weight.
   */
  const samples = [
    ...new Map(readings
      .flatMap(function toSamples(reading,): readonly MeterSample[] {
        return reading.samples;
      },)
      .map(function keyed(sample,): readonly [
        string,
        MeterSample,
      ] {
        return [
          `${String(sample.at,)}/${sample.synthetic}/${sample.hyper}/${
            sample
              .levels
              .join(',',)
          }`,
          sample,
        ];
      },),).values(),
  ].toSorted(function byTime(
    left,
    right,
  ): number {
    return left.at - right.at;
  },);

  /**
   * Marked lines no log would yield a reading from.
   */
  const skipped = readings.reduce(
    function addSkipped(
      total,
      reading,
    ): number {
      return total + reading.skippedLines;
    },
    0,
  );

  console.log(
    `meter-report: logs=${String(paths.length,)} readings=${String(samples.length,)} `
      + `unread=${String(skipped,)}`,
  );

  /**
   * Earliest reading, which opens the window everything below sits in.
   */
  const first = samples.at(0,);

  /**
   * Latest reading, which closes it.
   */
  const last = samples.at(-1,);

  if ((first === undefined) || (last === undefined)) {
    console.log(
      '  NOTHING RECORDED. These logs carry no availability reading. Runs written before the '
        + 'reading was promoted out of debug level have none, so read a log from a pass or a '
        + '`budget-sample` taken after that landed.',
    );
    process.exitCode = NOTHING_RECORDED;
    return;
  }

  console.log(
    `  window ${stampText({ at: first.at, },)} .. ${stampText({ at: last.at, },)} `
      + `(${spanText({ ms: last.at - first.at, },)})`,
  );
  console.log(
    '  READINGS HAPPEN WHEN A RUN ASKS FOR ONE, so this window is dense while work ran and '
      + 'empty otherwise. Every figure below is availability WHEN WE WERE ASKING.',
  );

  // EVERY PROVIDER, in the order the record names them; one absent from a
  // sample contributes no reading to its series.
  for (const provider of PROVIDER_ORDER) {
    reportProvider({
      samples,
      provider,
    },);
  }
}

if (import.meta.main)
  await reportingRefusals({
    what: 'meter-report',
    run: reportMeters,
  },);

//endregion Meter report
