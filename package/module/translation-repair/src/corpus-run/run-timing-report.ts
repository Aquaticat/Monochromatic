import { readFile, } from 'node:fs/promises';

import {
  type InFlight,
  measureInFlight,
  NothingInFlightError,
  readRunTiming,
  type RunTiming,
  summariseRounds,
} from './run-timing-read.ts';
import { wordForCount, } from '../count-word.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';

//region Run timing report
// WHERE A RUN'S HOURS WENT, read back off its own log. Spends no quota and
// touches no model.
//
// THE TIMING WORK OPENED ON A LOG THAT COULD NOT ANSWER THIS.
// `doc/audit/every-volume-guard-is-blind-to-one-model.md` had to bound the
// straggler cost from above, at the grace window times the number of cut
// events, and recorded that confirming it "needs the dispatch timestamps the
// run does not currently record". Two lines now record them, and this reads
// them back.
//
// A LOG WITH NO TIMING LINES AND A RUN THAT WAITED ON NOTHING ARE DIFFERENT
// ANSWERS, and this says which. Every log written before the timing work carries no
// round line and no `elapsed`, so silence is the ordinary case for the archive.
//
// PRINTS IDS, COUNTS AND DURATIONS. Never a passage: a run log holds
// unlicensed corpus wording, and this reads run logs.

/**
 Milliseconds in a second.
 */
const MS_PER_SECOND = 1_000;

/**
 Milliseconds in a minute.
 */
const MS_PER_MINUTE = 60_000;

/**
 Milliseconds in an hour.
 */
const MS_PER_HOUR = 3_600_000;

/**
 Multiplier turning a fraction into a percentage.
 */
const PERCENT = 100;

/**
 Decimal places every span column carries.
 */
const SPAN_PLACES = 2;

/**
 Decimal places the mean-in-flight column carries.
 */
const MEAN_PLACES = 2;

/**
 Decimal places the grace-share column carries.
 */
const SHARE_PLACES = 1;

/**
 Renders a span in the largest unit it fills.

 THREE UNITS RATHER THAN HOURS ALONE. The same report reads a six-hour corpus
 pass and a thirty-second probe, and printing both in hours prints the probe
 as `0.01h`, which is indistinguishable from a run that did nothing. Choosing
 the unit per figure keeps a short span legible without making a long one
 unreadable.

 @param ms - span to render

 @returns Text for a report column

 @example
 ```ts
 console.log(asSpan({ ms: 22_140_000, },),);
 ```
 */
function asSpan({ ms, }: { readonly ms: number; },): string {
  if (ms >= MS_PER_HOUR)
    return `${(ms / MS_PER_HOUR).toFixed(SPAN_PLACES,)}h`;
  if (ms >= MS_PER_MINUTE)
    return `${(ms / MS_PER_MINUTE).toFixed(SPAN_PLACES,)}min`;
  return `${(ms / MS_PER_SECOND).toFixed(SPAN_PLACES,)}s`;
}

/**
 Reports what the rounds spent, split into work and waiting.

 @param reading - every timing line the log held

 @example
 ```ts
 printRounds({ reading, },);
 ```
 */
function printRounds({ reading, }: { readonly reading: RunTiming; },): void {
  /**
   How many rounds the log reported.
   */
  const roundCount = reading
    .rounds
    .length;

  if (roundCount === 0) {
    console.log(
      'NO ROUND LINE. This log predates round lines and call durations, so how long each fan-out took and how much of that '
        + 'was spent waiting after quorum are both unrecorded. That is not the same as a run that '
        + 'never waited.',
    );
    return;
  }

  /**
   Totals across every round, of either kind (T8, nineteenth batch).
   */
  const summary = summariseRounds({ rounds: reading.rounds, },);

  console.log(
    `rounds                 ${String(roundCount,)}, `
      + `${asSpan({ ms: summary.totalMs, },)} in total`,
  );
  console.log(`  without quorum       ${String(summary.withoutQuorum,)}`,);
  // NO SHARE OF NO TIME: rounds that all took no time leave nothing to divide
  // the grace by, and a NaN percentage reads as a measurement.
  /**
   Share of round time spent waiting rather than working, where there was any.
   */
  const graceShare = (summary.totalMs === 0)
    ? 'no round time to share'
    : `${((summary.graceMs / summary.totalMs) * PERCENT).toFixed(SHARE_PLACES,)}% of round time`;

  console.log(`  waiting after quorum ${asSpan({ ms: summary.graceMs, },)}, ${graceShare}`,);
  console.log(`  voices never heard   ${String(summary.lost,)}`,);
}

/**
 Reports how many calls the run had in flight.

 @param flight - what the sweep counted

 @example
 ```ts
 printInFlight({ flight, },);
 ```
 */
function printInFlight({ flight, }: { readonly flight: InFlight; },): void {
  /**
   Mean in flight at the precision a fan-out is read in.
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
 Reads every named log and reports where its hours went.

 Returns nothing: the report on stdout IS the output.

 @param line - the report's command line, read whole by `reportingRefusals`,
 which refuses it when no log is named: any log a pass, probe or calibration
 wrote will do, and passing several reads them as one run

 @example
 ```ts
 await reportRunTiming({ line, },);
 ```
 */
async function reportRunTiming({ line, }: { readonly line: CommandLineOf<'run-timing-report'>; },): Promise<void> {
  /**
   Logs to read, named on the command line.
   */
  const paths = line.positionals;

  /**
   Every line of every named log, in one list.
   */
  const lines = (await Promise.all(paths.map(async function one(path,): Promise<readonly string[]> {
    return (await readFile(
      path,
      'utf8',
    )).split('\n',);
  },),)).flat();

  /**
   Every timing line those logs held.
   */
  const reading = readRunTiming({ lines, },);

  console.log(
    `run-timing-report: ${String(paths.length,)} ${
      wordForCount({
        count: paths.length,
        one: 'log',
        many: 'logs',
      },)
    }, ${String(lines.length,)} ${
      wordForCount({
        count: lines.length,
        one: 'line',
        many: 'lines',
      },)
    }`,
  );
  printRounds({ reading, },);

  if (reading.callsWithoutDuration > 0) {
    console.log(
      `${String(reading.callsWithoutDuration,)} completion ${
        wordForCount({
          count: reading.callsWithoutDuration,
          one: 'line',
          many: 'lines',
        },)
      } ${
        wordForCount({
          count: reading.callsWithoutDuration,
          one: 'carries',
          many: 'carry',
        },)
      } no elapsed field, predating call durations and leaving no interval to report. Any concurrency `
        + 'this report prints describes only the calls that could be timed.',
    );
  }

  if (reading.callsWithoutStamp > 0) {
    console.log(
      `Completion lines whose stamp the logger did not write: ${String(reading.callsWithoutStamp,)}. No `
        + 'instant places their calls, so any concurrency this report prints leaves them out.',
    );
  }

  try {
    printInFlight({ flight: measureInFlight({ calls: reading.calls, },), },);
  } catch (error) {
    if (!(error instanceof NothingInFlightError))
      throw error;
    // NO SPAN TO COUNT OVER, whether no call carried a duration or every timed
    // call took no time: the refusal says which, and neither is a run that
    // made one call at a time.
    // A COLON, not a period: the refusal's sentence opens in lower case, as
    // every error message here does, so it continues the heading.
    console.log(`NOTHING IN FLIGHT: ${error.message}, which is not the same as a run that made one call at a time.`,);
  }
}

if (import.meta.main)
  await reportingRefusals({
    what: 'run-timing-report',
    argv: process.argv,
    run: reportRunTiming,
  },);

//endregion Run timing report
