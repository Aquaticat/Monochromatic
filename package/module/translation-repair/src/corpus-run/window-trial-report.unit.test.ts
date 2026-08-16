/**
 * Tests for how the window trial's rows are read.
 *
 * WHAT THESE PIN is the measurement discipline that two design corrections
 * produced, both made before any quota was spent. The trial is three-armed
 * because two arms cannot separate the window from a resampled slate. The band
 * comes from two narrow arms because a single repeat understates the noise it
 * is meant to bound. A reader that lost either would report a confident number
 * from an instrument that cannot support one.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  reportWindowTrial,
  TRIAL_ARMS,
  type WindowTrialRow,
} from '../../dist/final/node/index.mjs';

/**
 * Judges every arm in these fixtures seats.
 */
const JUDGES_SEATED = 6;

/**
 * Builds one completed arm.
 *
 * @param chunkIndex - slice position
 *
 * @param arm - which arm
 *
 * @param shipped - whether this arm replaced the archive
 *
 * @param sliceClass - class the screen flagged, or a control label
 *
 * @param judgesHeard - judges whose ballot arrived, short of the seated panel
 * when the fan-out lost voices
 *
 * @returns Row shaped like one the runner appends
 *
 * @example
 * ```ts
 * const row = rowFor({ chunkIndex: 0, arm: TRIAL_ARMS.wide, shipped: false, },);
 * ```
 */
function rowFor(
  {
    chunkIndex,
    arm,
    shipped,
    sliceClass = 'relocation',
    judgesHeard = JUDGES_SEATED,
  }: {
    readonly chunkIndex: number;
    readonly arm: string;
    readonly shipped: boolean;
    readonly sliceClass?: string;
    readonly judgesHeard?: number;
  },
): WindowTrialRow {
  return {
    protocol: 'protocol-one',
    entryId: 'Mittens',
    chunkIndex,
    arm,
    sliceClass,
    shipped,
    decision: 'judged',
    winnerText: shipped ? 'A fresh rendering.\n' : 'The archive wording.\n',
    judgesHeard,
    judgesSeated: JUDGES_SEATED,
  };
}

/**
 * Builds all three arms of one slice.
 *
 * @param chunkIndex - slice position
 *
 * @param narrowFirst - whether the first narrow arm replaced
 *
 * @param narrowSecond - whether the second narrow arm replaced
 *
 * @param wide - whether the wide arm replaced
 *
 * @param sliceClass - class or control label
 *
 * @returns Three rows, one per arm
 *
 * @example
 * ```ts
 * const rows = tripleFor({ chunkIndex: 0, narrowFirst: true, narrowSecond: true, wide: false, },);
 * ```
 */
function tripleFor(
  {
    chunkIndex,
    narrowFirst,
    narrowSecond,
    wide,
    sliceClass = 'relocation',
  }: {
    readonly chunkIndex: number;
    readonly narrowFirst: boolean;
    readonly narrowSecond: boolean;
    readonly wide: boolean;
    readonly sliceClass?: string;
  },
): readonly WindowTrialRow[] {
  return [
    rowFor({
      chunkIndex,
      arm: TRIAL_ARMS.narrowFirst,
      shipped: narrowFirst,
      sliceClass,
    },),
    rowFor({
      chunkIndex,
      arm: TRIAL_ARMS.narrowSecond,
      shipped: narrowSecond,
      sliceClass,
    },),
    rowFor({
      chunkIndex,
      arm: TRIAL_ARMS.wide,
      shipped: wide,
      sliceClass,
    },),
  ];
}

await describe({
  name: reportWindowTrial.name,
  children: [
    it({
      name: 'REPORTS THE BAND ALONGSIDE THE EFFECT, taken from the two narrow arms which saw the '
        + 'same evidence over the same slate. Every transition in the band is noise by '
        + 'construction, and a wide arm that moves no more than it has moved nothing',
      fn: async () => {
        /**
         * Four slices where the wide arm flips two, and the second narrow arm
         * flips one purely by chance.
         */
        const rows = [
          ...tripleFor({ chunkIndex: 0, narrowFirst: true, narrowSecond: true, wide: false, },),
          ...tripleFor({ chunkIndex: 1, narrowFirst: true, narrowSecond: false, wide: false, },),
          ...tripleFor({ chunkIndex: 2, narrowFirst: true, narrowSecond: true, wide: true, },),
          ...tripleFor({ chunkIndex: 3, narrowFirst: false, narrowSecond: false, wide: false, },),
        ];

        const [report,] = reportWindowTrial({ rows, protocol: 'protocol-one', },);
        expect(report?.transitions
          .replaceToKeep,).toBe(2,);
        // The band is not zero, and reporting the effect without it would claim
        // two flips where one is what noise already produces.
        expect(report?.bandTransitions
          .replaceToKeep,).toBe(1,);
      },
    },),
    it({
      name: 'counts transitions in BOTH directions, because two matching rates can hide equal '
        + 'traffic each way and traffic each way is not the window working',
      fn: async () => {
        const rows = [
          ...tripleFor({ chunkIndex: 0, narrowFirst: true, narrowSecond: true, wide: false, },),
          ...tripleFor({ chunkIndex: 1, narrowFirst: false, narrowSecond: false, wide: true, },),
        ];

        const [report,] = reportWindowTrial({ rows, protocol: 'protocol-one', },);
        // One each way: the aggregate rate is unchanged and the window plainly
        // did something. Only the paired counts show it.
        expect(report?.transitions
          .replaceToKeep,).toBe(1,);
        expect(report?.transitions
          .keepToReplace,).toBe(1,);
        expect(report?.arms
          .find(function isNarrow(rate,) {
            return rate.arm === TRIAL_ARMS.narrowFirst;
          },)
          ?.replaced,).toBe(1,);
        expect(report?.arms
          .find(function isWide(rate,) {
            return rate.arm === TRIAL_ARMS.wide;
          },)
          ?.replaced,).toBe(1,);
      },
    },),
    it({
      name: 'EXCLUDES a slice missing an arm rather than crediting it partially, and counts how '
        + 'many it excluded: a half-populated pair is not a smaller sample, it is a different one',
      fn: async () => {
        const rows = [
          ...tripleFor({ chunkIndex: 0, narrowFirst: true, narrowSecond: true, wide: false, },),
          // Slice 1 lost its wide arm to an abort.
          rowFor({ chunkIndex: 1, arm: TRIAL_ARMS.narrowFirst, shipped: true, },),
          rowFor({ chunkIndex: 1, arm: TRIAL_ARMS.narrowSecond, shipped: true, },),
        ];

        const [report,] = reportWindowTrial({ rows, protocol: 'protocol-one', },);
        expect(report?.incomplete,).toBe(1,);
        expect(report?.arms[0]
          ?.trials,).toBe(1,);
        expect(report?.transitions
          .replaceToKeep,).toBe(1,);
      },
    },),
    it({
      name: 'DROPS A TRIPLE WHOSE WIDE ARM DECIDED ON A SHORT PANEL, and counts it separately '
        + 'from a missing arm. The fan-out proceeds once half the roster answers, so a lost voice '
        + 'is written as an ordinary decision, and the wide arm sends the longest sheets under the '
        + 'same deadline: read as it stands, judges that never answered would be credited to the '
        + 'window',
      fn: async () => {
        const rows = [
          ...tripleFor({ chunkIndex: 0, narrowFirst: true, narrowSecond: true, wide: false, },),
          rowFor({ chunkIndex: 1, arm: TRIAL_ARMS.narrowFirst, shipped: true, },),
          rowFor({ chunkIndex: 1, arm: TRIAL_ARMS.narrowSecond, shipped: true, },),
          // Slice 1's wide arm heard four of six.
          rowFor({
            chunkIndex: 1,
            arm: TRIAL_ARMS.wide,
            shipped: false,
            judgesHeard: 4,
          },),
        ];

        const [report,] = reportWindowTrial({ rows, protocol: 'protocol-one', },);
        expect(report?.degraded,).toBe(1,);
        // Not counted as merely missing, which is a different fault.
        expect(report?.incomplete,).toBe(0,);
        expect(report?.arms[0]
          ?.trials,).toBe(1,);
        // The dropped slice would have doubled this had it been read.
        expect(report?.transitions
          .replaceToKeep,).toBe(1,);
      },
    },),
    it({
      name: 'drops a triple whose NARROW arm was the short one too, since the band is what the '
        + 'wide arm is judged against and a band measured on lost voices is not a band',
      fn: async () => {
        const rows = [
          rowFor({
            chunkIndex: 0,
            arm: TRIAL_ARMS.narrowFirst,
            shipped: true,
            judgesHeard: 3,
          },),
          rowFor({ chunkIndex: 0, arm: TRIAL_ARMS.narrowSecond, shipped: true, },),
          rowFor({ chunkIndex: 0, arm: TRIAL_ARMS.wide, shipped: false, },),
        ];

        const [report,] = reportWindowTrial({ rows, protocol: 'protocol-one', },);
        expect(report?.degraded,).toBe(1,);
        expect(report?.arms[0]
          ?.trials,).toBe(0,);
      },
    },),
    it({
      name: 'keeps CLASSES APART, so a control drawn from unflagged slices is never pooled with '
        + 'the relocations it exists to be compared against',
      fn: async () => {
        const rows = [
          ...tripleFor({ chunkIndex: 0, narrowFirst: true, narrowSecond: true, wide: false, },),
          ...tripleFor({
            chunkIndex: 1,
            narrowFirst: true,
            narrowSecond: true,
            wide: true,
            sliceClass: 'control-unflagged',
          },),
        ];

        const reports = reportWindowTrial({ rows, protocol: 'protocol-one', },);
        expect(reports.length,).toBe(2,);

        /**
         * The control's own report.
         */
        const control = reports.find(function isControl(report,) {
          return report.sliceClass === 'control-unflagged';
        },);
        expect(control?.transitions
          .replaceToKeep,).toBe(0,);
        expect(control?.transitions
          .heldReplace,).toBe(1,);
      },
    },),
    it({
      name: 'separates two entries carrying a slice at the SAME index, since a key of index alone '
        + 'would silently merge two different slices into one triple',
      fn: async () => {
        /**
         * Same chunk index, different entries.
         */
        const rows = [
          ...tripleFor({ chunkIndex: 0, narrowFirst: true, narrowSecond: true, wide: false, },),
          ...tripleFor({ chunkIndex: 0, narrowFirst: true, narrowSecond: true, wide: false, },)
            .map(function toOtherEntry(row,): WindowTrialRow {
              return {
                ...row,
                entryId: 'Whiskers',
              };
            },),
        ];

        const [report,] = reportWindowTrial({ rows, protocol: 'protocol-one', },);
        // Two slices, not one: merging them would have reported a single trial
        // and halved the population without saying so.
        expect(report?.arms[0]
          ?.trials,).toBe(2,);
        expect(report?.transitions
          .replaceToKeep,).toBe(2,);
      },
    },),
    it({
      name: 'reports every arm over the SAME complete-triple population, so the three rates are '
        + 'comparable rather than each being taken over whatever that arm happened to finish',
      fn: async () => {
        const rows = [
          ...tripleFor({ chunkIndex: 0, narrowFirst: true, narrowSecond: false, wide: false, },),
          rowFor({ chunkIndex: 1, arm: TRIAL_ARMS.narrowFirst, shipped: true, },),
        ];

        const [report,] = reportWindowTrial({ rows, protocol: 'protocol-one', },);
        for (const rate of report?.arms ?? [])
          expect(rate.trials,).toBe(1,);
      },
    },),
  ],
},);
