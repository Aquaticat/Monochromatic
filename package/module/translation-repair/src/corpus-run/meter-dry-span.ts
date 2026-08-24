import type {
  MeterState,
  ProviderName,
} from '../provider-budget.ts';
import type { MeterSample, } from './meter-sample-read.ts';

//region Meter dry span
// Turns a series of meter readings into the two numbers that price a provider
// seat: how much of the time it was spendable, and the longest stretch it was
// not.
//
// EVERY OUTAGE IS REPORTED AS A RANGE, because the sampling is irregular by
// construction. A reading happens when a run asks for one, so two samples can
// be a minute apart or a day apart, and an outage seen at one sample and gone
// by the next started and ended somewhere in between. Reporting the gap
// between two dry samples as "the outage" understates it; reporting the gap
// between the surrounding wet samples overstates it. Both bounds are kept.
//
// ONLY `wet` PROVES RECOVERY AND ONLY `dry` PROVES OUTAGE. An `unreadable`
// meter proves neither, so it ends a CONFIRMED stretch, because the provider
// could have recovered and failed again behind it, while never closing the
// upper bound, which runs to the nearest sample that actually answered wet. Two
// confirmed stretches either side of an unreadable therefore share one upper
// bound covering the whole thing, which is what is really known.
//
// THE DENOMINATOR EXCLUDES UNREADABLE READINGS. A duty cycle is a fraction of
// the readings that answered; counting readings that did not would push the
// number toward whichever way the meter endpoint happened to fail.

/**
 * How many readings fell in each state.
 */
export type StateCounts = {
  /**
   * Readings where the meter reported budget left.
   */
  readonly wet: number;

  /**
   * Readings where the meter reported nothing left.
   */
  readonly dry: number;

  /**
   * Readings where the meter could not be reached at all.
   */
  readonly unreadable: number;
};

/**
 * One stretch a provider is known to have been out for.
 */
export type DrySpan = {
  /**
   * Milliseconds between the first and last reading that confirmed the outage.
   * Zero where a single reading caught it.
   */
  readonly confirmedMs: number;

  /**
   * Milliseconds between the last wet reading before and the first wet reading
   * after, absent where the record does not carry one of them.
   */
  readonly boundedByMs: number | undefined;

  /**
   * Whether no wet reading precedes this stretch, so it may have started
   * before the record does.
   */
  readonly openBefore: boolean;

  /**
   * Whether no wet reading follows this stretch, so it may still be running.
   */
  readonly openAfter: boolean;

  /**
   * When the outage was first confirmed.
   */
  readonly firstAt: number;

  /**
   * When the outage was last confirmed.
   */
  readonly lastAt: number;
};

/**
 * One provider's readings in time order.
 */
type StateSeries = readonly {
  readonly at: number;
  readonly state: MeterState;
}[];

/**
 * Pulls one provider's column out of the samples, in time order.
 *
 * @param samples - readings of both providers
 *
 * @param provider - which column to read
 *
 * @returns That provider's states, sorted by when they were read
 *
 * @example
 * ```ts
 * const series = seriesFor({ samples, provider: 'hyper', },);
 * ```
 */
export function seriesFor(
  {
    samples,
    provider,
  }: {
    readonly samples: readonly MeterSample[];
    readonly provider: ProviderName;
  },
): StateSeries {
  return samples
    .map(function toReading(sample,): { readonly at: number; readonly state: MeterState; } {
      return {
        at: sample.at,
        state: sample[provider],
      };
    },)
    .toSorted(function byTime(left, right,): number {
      return left.at - right.at;
    },);
}

/**
 * Counts a provider's readings by state.
 *
 * @param series - that provider's readings
 *
 * @returns How many fell in each state
 *
 * @example
 * ```ts
 * const counts = countStates({ series, },);
 * ```
 */
export function countStates(
  { series, }: { readonly series: StateSeries; },
): StateCounts {
  return series.reduce(
    function tally(counts: StateCounts, reading,): StateCounts {
      return {
        wet: counts.wet + ((reading.state === 'wet') ? 1 : 0),
        dry: counts.dry + ((reading.state === 'dry') ? 1 : 0),
        unreadable: counts.unreadable + ((reading.state === 'unreadable') ? 1 : 0),
      };
    },
    {
      wet: 0,
      dry: 0,
      unreadable: 0,
    },
  );
}

/**
 * Fraction of answering readings that found budget left.
 *
 * @param counts - readings by state
 *
 * @returns Wet fraction, absent where no reading answered
 *
 * @example
 * ```ts
 * const wetFraction = dutyCycle({ counts, },);
 * ```
 */
export function dutyCycle(
  { counts, }: { readonly counts: StateCounts; },
): number | undefined {
  /**
   * Readings whose meter answered, which is the only honest denominator.
   */
  const answered = counts.wet + counts.dry;

  if (answered === 0)
    return undefined;

  return counts.wet / answered;
}

/**
 * For each reading, when the nearest wet reading before it was, walking
 * forward once.
 *
 * @param series - that provider's readings
 *
 * @returns Timestamps aligned to `series`, absent where none precedes
 *
 * @example
 * ```ts
 * const before = wetBefore({ series, },);
 * ```
 */
function wetBefore(
  { series, }: { readonly series: StateSeries; },
): readonly (number | undefined)[] {
  /**
   * Nearest preceding wet reading per index, filled as the walk proceeds.
   */
  const found: (number | undefined)[] = [];

  /**
   * Most recent wet reading seen so far.
   */
  let seen: number | undefined = undefined;

  for (const reading of series) {
    found.push(seen,);
    if (reading.state === 'wet')
      seen = reading.at;
  }

  return found;
}

/**
 * For each reading, when the nearest wet reading after it was.
 *
 * @param series - that provider's readings
 *
 * @returns Timestamps aligned to `series`, absent where none follows
 *
 * @example
 * ```ts
 * const after = wetAfter({ series, },);
 * ```
 */
function wetAfter(
  { series, }: { readonly series: StateSeries; },
): readonly (number | undefined)[] {
  return wetBefore({ series: series.toReversed(), },).toReversed();
}

/**
 * One reading with the nearest wet reading on each side already attached, so
 * a span can be closed without indexing back into the series.
 */
type BoundedReading = {
  readonly at: number;
  readonly state: MeterState;
  readonly wetBefore: number | undefined;
  readonly wetAfter: number | undefined;
};

/**
 * Closes one confirmed stretch into a span.
 *
 * @param first - reading that first confirmed the outage
 *
 * @param last - reading that last confirmed it
 *
 * @returns Stretch with both bounds and whether either end is open
 *
 * @example
 * ```ts
 * const span = closeSpan({ first, last, },);
 * ```
 */
function closeSpan(
  {
    first,
    last,
  }: {
    readonly first: BoundedReading;
    readonly last: BoundedReading;
  },
): DrySpan {
  /**
   * Last moment the provider was known up before this stretch.
   */
  const opened = first.wetBefore;

  /**
   * First moment it was known up again after it.
   */
  const closed = last.wetAfter;

  return {
    confirmedMs: last.at - first.at,
    boundedByMs: ((opened === undefined) || (closed === undefined))
      ? undefined
      : closed - opened,
    openBefore: opened === undefined,
    openAfter: closed === undefined,
    firstAt: first.at,
    lastAt: last.at,
  };
}

/**
 * Every stretch a provider is known to have been out for.
 *
 * @param series - that provider's readings
 *
 * @returns Stretches in time order, empty where no reading found it out
 *
 * @example
 * ```ts
 * const spans = drySpans({ series, },);
 * ```
 */
export function drySpans(
  { series, }: { readonly series: StateSeries; },
): readonly DrySpan[] {
  /**
   * Nearest wet reading before each position.
   */
  const before = wetBefore({ series, },);

  /**
   * Nearest wet reading after each position.
   */
  const after = wetAfter({ series, },);

  /**
   * Readings carrying their own bounds, so closing a span never indexes back.
   */
  const bounded: readonly BoundedReading[] = series
    .map(function attach(reading, index,): BoundedReading {
      return {
        at: reading.at,
        state: reading.state,
        wetBefore: before[index],
        wetAfter: after[index],
      };
    },);

  /**
   * Stretches closed so far.
   */
  const spans: DrySpan[] = [];

  /**
   * Stretch currently being confirmed, absent between stretches.
   */
  let open: { first: BoundedReading; last: BoundedReading; } | undefined = undefined;

  for (const reading of bounded) {
    if (reading.state === 'dry') {
      open = {
        first: open?.first ?? reading,
        last: reading,
      };
      continue;
    }

    // Anything that is not a confirmed dry reading ends confirmation, whether
    // it proved recovery or proved nothing. The upper bound already carries
    // what an unreadable meter left unknown.
    if (open !== undefined) {
      spans.push(closeSpan(open,),);
      open = undefined;
    }
  }

  if (open !== undefined)
    spans.push(closeSpan(open,),);

  return spans;
}

/**
 * Longest stretch a provider is known to have been out for.
 *
 * RANKED BY CONFIRMED LENGTH, not by upper bound, because the upper bound of a
 * stretch surrounded by distant readings can exceed the confirmed length of a
 * genuinely longer outage that happened to be sampled closely.
 *
 * @param spans - stretches to rank
 *
 * @returns Longest stretch, absent where the provider was never found out
 *
 * @example
 * ```ts
 * const worst = longestDrySpan({ spans, },);
 * ```
 */
export function longestDrySpan(
  { spans, }: { readonly spans: readonly DrySpan[]; },
): DrySpan | undefined {
  return spans.reduce(
    function longer(worst: DrySpan | undefined, span,): DrySpan {
      if ((worst === undefined) || (span.confirmedMs > worst.confirmedMs))
        return span;
      return worst;
    },
    undefined,
  );
}

//endregion Meter dry span
