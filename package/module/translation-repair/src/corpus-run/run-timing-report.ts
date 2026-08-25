import { readFile, } from 'node:fs/promises';

import {
  type InFlight,
  measureInFlight,
  readRunTiming,
  type RunTiming,
} from './run-timing-read.ts';
import { reportingRefusals, } from './cli-refusal.ts';

//region Run timing report
// WHERE A RUN'S WALL-CLOCK WENT, read back off its own log. Spends no quota and
// touches no model.
//
// `#215` OPENED ON A LOG THAT COULD NOT ANSWER THIS.
// `doc/audit/every-volume-guard-is-blind-to-one-model.md` had to bound the
// straggler cost from above, at the grace window times the number of cut
// events, and recorded that confirming it "needs the dispatch timestamps the
// run does not currently record". Two lines now record them, and this reads
// them back.
//
// A LOG WITH NO TIMING LINES AND A RUN THAT WAITED ON NOTHING ARE DIFFERENT
// ANSWERS, and this says which. Every log written before `#215` carries no
// round line and no `elapsed`, so silence is the ordinary case for the archive.
//
// PRINTS IDS, COUNTS AND DURATIONS. Never a passage: a run log holds
// unlicensed corpus wording, and this reads run logs.

/**
 * Milliseconds in a second.
 */
const MS_PER_SECOND = 1_000;

/**
 * Milliseconds in a minute.
 */
const MS_PER_MINUTE = 60_000;

/**
 * Milliseconds in an hour.
 */
const MS_PER_HOUR = 3_600_000;

/**
 * Multiplier turning a fraction into a percentage.
 */
const PERCENT = 100;

/**
 * Decimal places every span column carries.
 */
const SPAN_PLACES = 2;

/**
 * Decimal places the mean-in-flight column carries.
 */
const MEAN_PLACES = 2;

/**
 * Decimal places the grace-share column carries.
 */
const SHARE_PLACES = 1;

/**
 * Round totals folded across a whole log.
 */
type RoundTotals = {
  /**
   * Wall-clock every round took together.
   */
  readonly totalMs: number;

  /**
   * Wall-clock every round spent waiting after quorum.
   */
  readonly graceMs: number;

  /**
   * Voices asked for and never heard, across every round.
   */
  readonly lost: number;
};

/**
 * Renders a span in the largest unit it fills.
 *
 * THREE UNITS RATHER THAN HOURS ALONE. The same report reads a six-hour corpus
 * pass and a thirty-second probe, and printing both in hours prints the probe
 * as `0.01h`, which is indistinguishable from a run that did nothing. Choosing
 * the unit per figure keeps a short span legible without making a long one
 * unreadable.
 *
 * @param ms - span to render
 *
 * @returns Text for a report column
 *
 * @example
 * ```ts
 * console.log(asSpan({ ms: 22_140_000, },),);
 * ```
 */
function asSpan({ ms, }: { readonly ms: number; },): string {
  if (ms >= MS_PER_HOUR)
    return `${(ms / MS_PER_HOUR).toFixed(SPAN_PLACES,)}h`;
  if (ms >= MS_PER_MINUTE)
    return `${(ms / MS_PER_MINUTE).toFixed(SPAN_PLACES,)}min`;
  return `${(ms / MS_PER_SECOND).toFixed(SPAN_PLACES,)}s`;
}

/**
 * Reports what the rounds spent, split into work and waiting.
 *
 * @param reading - every timing line the log held
 *
 * @example
 * ```ts
 * printRounds({ reading, },);
 * ```
 */
function printRounds({ reading, }: { readonly reading: RunTiming; },): void {
  /**
   * How many rounds the log reported.
   */
  const roundCount = reading
    .rounds
    .length;

  if (roundCount === 0) {
    console.log(
      'NO ROUND LINE. This log predates `#215`, so how long each fan-out took and how much of that '
        + 'was spent waiting after quorum are both unrecorded. That is not the same as a run that '
        + 'never waited.',
    );
    return;
  }

  /**
   * Totals across every round, folded in one pass.
   */
  const totals = reading
    .rounds
    .reduce(
      function addRound(
        carried,
        round,
      ): RoundTotals {
        return {
          totalMs: carried.totalMs + round.totalMs,
          graceMs: carried.graceMs + round.inGraceMs,
          lost: carried.lost + (round.asked - round.heard),
        };
      },
      {
        totalMs: 0,
        graceMs: 0,
        lost: 0,
      },
    );

  console.log(
    `rounds                 ${String(roundCount,)}, `
      + `${asSpan({ ms: totals.totalMs, },)} in total`,
  );
  /**
   * Share of round time spent waiting rather than working.
   */
  const graceShare = ((totals.graceMs / totals.totalMs) * PERCENT)
    .toFixed(SHARE_PLACES,);

  console.log(
    `  waiting after quorum ${asSpan({ ms: totals.graceMs, },)}, `
      + `${graceShare}% of round time`,
  );
  console.log(`  voices never heard   ${String(totals.lost,)}`,);
}

/**
 * Reports how many calls the run had in flight.
 *
 * @param flight - what the sweep counted
 *
 * @example
 * ```ts
 * printInFlight({ flight, },);
 * ```
 */
function printInFlight({ flight, }: { readonly flight: InFlight; },): void {
  /**
   * Mean in flight at the precision a fan-out is read in.
   */
  const meanShown = flight
    .meanInFlight
    .toFixed(MEAN_PLACES,);

  console.log(
    `calls in flight        mean ${meanShown}, `
      + `peak ${String(flight.peakInFlight,)}`,
  );
  console.log(
    `  busy against span    ${asSpan({ ms: flight.busyMs, },)} of calls `
      + `across ${asSpan({ ms: flight.spanMs, },)} of run`,
  );
}

/**
 * Reads every named log and reports where its wall-clock went.
 *
 * Returns nothing: the report on stdout IS the output.
 *
 * @throws Error when no log is named
 *
 * @example
 * ```ts
 * await reportRunTiming();
 * ```
 */
async function reportRunTiming(): Promise<void> {
  /**
   * Logs to read, named on the command line.
   */
  const paths = process
    .argv
    .slice(2,);

  if (paths.length === 0) {
    throw new Error(
      'name at least one log file: run-timing-report <path> [<path> ...]. Any log a pass, probe or '
        + 'calibration wrote will do, and passing several reads them as one run.',
    );
  }

  /**
   * Every line of every named log, in one list.
   */
  const lines = (await Promise.all(paths.map(async function one(path,): Promise<readonly string[]> {
    return (await readFile(
      path,
      'utf8',
    )).split('\n',);
  },),)).flat();

  /**
   * Every timing line those logs held.
   */
  const reading = readRunTiming({ lines, },);

  console.log(
    `run-timing-report: ${String(paths.length,)} logs, ${String(lines.length,)} lines`,
  );
  printRounds({ reading, },);

  if (reading.callsWithoutDuration > 0) {
    console.log(
      `${String(reading.callsWithoutDuration,)} completion lines carry no elapsed field, so they `
        + 'predate `#215` and no interval exists for them. Concurrency below, if any, describes '
        + 'only the calls that could be timed.',
    );
  }

  /**
   * How many calls the logs left an interval for.
   */
  const timedCalls = reading
    .calls
    .length;

  if (timedCalls === 0) {
    console.log(
      'NO TIMED CALL. Nothing here can be counted in flight, which is not the same as a run that '
        + 'made one call at a time.',
    );
    return;
  }

  printInFlight({ flight: measureInFlight({ calls: reading.calls, },), },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'run-timing-report',
    run: reportRunTiming,
  },);

//endregion Run timing report
