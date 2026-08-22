import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import {
  type GatheredProbe,
  reportProbeTelemetry,
} from '../../dist/final/node/index.mjs';

//region Probe telemetry report tests
// What the PROBE report says when its denominator is empty.
//
// The report prints COUNTS, never wording, so every figure below is a small
// integer and no fixture here carries text a document could contain.

/**
 * A roster summary with nothing recorded, for cases that do not turn on it.
 */
const SILENT_ROSTER = {
  offered: 0,
  degraded: 0,
  silent: 0,
};

/**
 * Builds a gathered run whose counts are exactly the ones a case cares about.
 *
 * Every other member is empty, because the note under test reads only the
 * repair-lane record count and the report's remaining lines are covered by the
 * figures they print.
 *
 * @param repairShippedRecords - repair-lane records the run holds
 *
 * @param editorOffered - slices the editor was asked to repair
 *
 * @returns Gathered probe carrying those counts and nothing else
 *
 * @example
 * ```ts
 * const gathered = gatheredWith({ repairShippedRecords: 0, editorOffered: 4, },);
 * ```
 */
function gatheredWith(
  {
    repairShippedRecords,
    editorOffered,
  }: {
    readonly repairShippedRecords: number;
    readonly editorOffered: number;
  },
): GatheredProbe {
  return {
    readings: [],
    byIssueId: new Map(),
    refinedIssueIds: new Set(),
    refinementReadings: [],
    editorRoster: {
      ...SILENT_ROSTER,
      offered: editorOffered,
    },
    refineRoster: SILENT_ROSTER,
    entriesWithRewrites: 0,
    entries: 1,
    repairShippedRecords,
    repairUnprobedRecords: 0,
  };
}

/**
 * Diverts `console.log` into a list until disposed.
 *
 * @param lines - where diverted lines are appended
 *
 * @returns Capture holding those lines, which restores logging on disposal
 *
 * @example
 * ```ts
 * using capture = collectingInto({ lines, },);
 * ```
 */
function collectingInto(
  { lines, }: { readonly lines: string[]; },
): { readonly lines: readonly string[]; } & Disposable {
  /**
   * Real logger, put back on disposal.
   */
  const printed = console.log;
  console.log = (...parts: readonly unknown[]) => {
    lines.push(parts.map(String,)
      .join(' ',),);
  };
  return {
    lines,
    [Symbol.dispose]: () => {
      console.log = printed;
    },
  };
}

/**
 * Reports one gathered run with every printed line collected instead of shown.
 *
 * @param gathered - run to report on
 *
 * @returns Every line the report printed, in order
 *
 * @example
 * ```ts
 * const lines = reportedLines({ gathered, },);
 * ```
 */
function reportedLines(
  { gathered, }: { readonly gathered: GatheredProbe; },
): readonly string[] {
  /**
   * Lines the report printed.
   */
  const lines: string[] = [];

  using capture = collectingInto({ lines, },);
  reportProbeTelemetry({ gathered, },);

  // Read before disposal returns the real logger, so a case never asserts on a
  // capture that is still installed.
  return capture.lines;
}

/**
 * Text identifying the note under test, short enough to survive rewording.
 */
const ZERO_NOTE = 'NOTE repairShippedRecords=0';

await describe({
  name: reportProbeTelemetry.name,
  children: [
    it({
      name:
        'NAMES AN EMPTY DENOMINATOR rather than letting seven zeros read as a clean result. With no '
        + 'repair-lane record to probe, every PROBE and CLAIMS figure is zero by construction, and '
        + 'majorityIntroduced=0 then says the probe found nothing wrong when it found nothing at all',
      fn: async () => {
        /**
         * Report over a run holding no repair-lane records.
         */
        const lines = reportedLines({
          gathered: gatheredWith({
            repairShippedRecords: 0,
            editorOffered: 4,
          },),
        },);

        expect(lines.some(function carriesNote(line,): boolean {
          return line.startsWith(ZERO_NOTE,);
        },),).toBe(true,);
      },
    },),

    it({
      name:
        'STAYS SILENT ONCE THERE IS SOMETHING TO PROBE, so the note marks the empty case rather '
        + 'than riding along on every report and teaching readers to skip it',
      fn: async () => {
        /**
         * Report over a run holding one repair-lane record.
         */
        const lines = reportedLines({
          gathered: gatheredWith({
            repairShippedRecords: 1,
            editorOffered: 4,
          },),
        },);

        expect(lines.some(function carriesNote(line,): boolean {
          return line.startsWith(ZERO_NOTE,);
        },),).toBe(false,);
      },
    },),

    it({
      name:
        'POINTS AT editorOffered, which is the only figure separating a lane that was asked and '
        + 'shipped nothing from one the critics never gave work to. Without that pointer the note '
        + 'would say a number means less than it looks and stop there',
      fn: async () => {
        /**
         * Report over a run holding no repair-lane records.
         */
        const lines = reportedLines({
          gathered: gatheredWith({
            repairShippedRecords: 0,
            editorOffered: 0,
          },),
        },);

        /**
         * The note itself, which must name where the ambiguity is settled.
         */
        const note = lines.find(function carriesNote(line,): boolean {
          return line.startsWith(ZERO_NOTE,);
        },) ?? '';

        expect(note.includes('editorOffered',),).toBe(true,);
      },
    },),
  ],
},);

//endregion Probe telemetry report tests
