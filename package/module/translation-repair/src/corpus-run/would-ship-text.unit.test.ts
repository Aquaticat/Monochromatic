/**
 * Tests for deriving what one slice would ship, across every decider.
 *
 * ONE CASE PER PATH THROUGH THE DECIDERS, because the whole point of this
 * reader is that no single field answers the question and every stage above a
 * lane may replace what it left. A reader that got any one branch wrong would
 * report wording no reader would ever see, which is exactly the failure the
 * `repairDisposition: 'shipped'` name produced before it.
 *
 * NO READING MAY CARRY AN EMPTY STRING AS WORDING. `standingTextFor` returns
 * `''` at a declined contest by design, so a reader that mirrored it would
 * delete every declined slice from any document assembled off these readings.
 * Both declines and the archive-silent case are pinned separately.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  UnansweredContestSliceError,
  type WouldShipReading,
  type WouldShipSource,
  wouldShipTextFor,
  wouldShipTextPerSlice,
} from '../../dist/final/node/index.mjs';

/**
 * Archive's own English at the slice every case reads.
 */
const ARCHIVE_NAP = 'The cat sleeps on the window ledge.';

/**
 * Repair lane's wording for it.
 */
const REPAIR_NAP = 'The cat is asleep on the sill.';

/**
 * Translate lane's wording for it.
 */
const TRANSLATE_NAP = 'The cat naps on the windowsill.';

/**
 * Third rendering's wording for it.
 */
const CONSOLIDATED_NAP = 'The cat is napping on the windowsill.';

/**
 * Builds one comparison row, defaulting to a slice where the lanes differ.
 *
 * @param over - fields this case replaces
 *
 * @returns Row as the parsed artifact carries it
 *
 * @example
 * ```ts
 * const row = rowWith({ incumbentKind: 'absent', },);
 * ```
 */
function rowWith(over: Record<string, unknown> = {},): Record<string, unknown> {
  return {
    chunkIndex: 0,
    incumbentKind: 'present',
    incumbentText: ARCHIVE_NAP,
    repairText: REPAIR_NAP,
    translateText: TRANSLATE_NAP,
    laneRelation: 'both-differ',
    repairOutcome: {
      kind: 'decided',
      acceptedText: REPAIR_NAP,
    },
    translateOutcome: {
      kind: 'decided',
      acceptedText: TRANSLATE_NAP,
    },
    decisionComparison: {
      kind: 'comparable',
      verdict: 'different',
    },
    repairDelivery: { kind: 'replacement-shipped', },
    translateDelivery: { kind: 'replacement-shipped', },
    ...over,
  };
}

/**
 * Builds one consolidation slice under a terminal that replaced nothing.
 *
 * @param terminal - how the slice left the stage
 *
 * @returns Slice as the parsed artifact carries it
 *
 * @example
 * ```ts
 * const slice = keptStanding({ terminal: 'gate-kept-standing', },);
 * ```
 */
function keptStanding(
  { terminal, }: { readonly terminal: string; },
): Record<string, unknown> {
  return {
    chunkIndex: 0,
    terminal,
    shipped: { kind: 'unchanged', },
    rewrapped: false,
    demoted: false,
    verdicts: [],
    gate: { kind: 'not-asked', },
  };
}

/**
 * Builds one contested slice under a verdict.
 *
 * @param verdict - what the roster settled
 *
 * @returns Slice as the parsed artifact carries it
 *
 * @example
 * ```ts
 * const slice = contestedWith({ verdict: { kind: 'settled-neither', }, },);
 * ```
 */
function contestedWith(
  { verdict, }: { readonly verdict: Record<string, unknown>; },
): Record<string, unknown> {
  return {
    chunkIndex: 0,
    verdict,
    ballots: [],
    usable: 3,
  };
}

/**
 * Builds the three fields a reading is derived from.
 *
 * @param row - comparison row to read, defaulting to differing lanes
 *
 * @param consolidation - what the third rendering says, defaulting to unasked
 *
 * @param laneSelection - which lane ships, defaulting to unasked
 *
 * @returns Source the reader accepts
 *
 * @example
 * ```ts
 * const source = sourceWith({ row: rowWith(), },);
 * ```
 */
function sourceWith(
  {
    row = rowWith(),
    consolidation = { kind: 'not-run', },
    laneSelection = { kind: 'pending-human-decision', },
  }: {
    readonly row?: Record<string, unknown>;
    readonly consolidation?: Record<string, unknown>;
    readonly laneSelection?: Record<string, unknown>;
  } = {},
): WouldShipSource {
  return {
    comparison: [row,],
    consolidation,
    laneSelection,
  } as unknown as WouldShipSource;
}

/**
 * Reads the first slice of a built source.
 *
 * @param source - three fields to read
 *
 * @returns What that slice would contribute
 *
 * @example
 * ```ts
 * const reading = firstReadingOf({ source, },);
 * ```
 */
function firstReadingOf(
  { source, }: { readonly source: WouldShipSource; },
): WouldShipReading {
  return wouldShipTextFor({
    artifact: source,
    row: nonNullishOrThrow(source.comparison[0],),
  },);
}

await describe({
  name: wouldShipTextFor.name,
  children: [
  it({
    name:
      'TAKES THE THIRD RENDERING where it settled wording, because it ran after both other '
      + 'deciders and was free to replace what either left. On the two artifacts that exist it '
      + 'overrode 4 rows, including the one the contest had kept',
    fn: async () => {
      const reading = firstReadingOf({
        source: sourceWith({
          consolidation: {
            kind: 'settled',
            slices: [
              {
                ...keptStanding({ terminal: 'consolidated', },),
                shipped: {
                  kind: 'consolidated',
                  text: CONSOLIDATED_NAP,
                },
              },
            ],
          },
          laneSelection: {
            kind: 'contested',
            slices: [
              contestedWith({
                verdict: {
                  kind: 'lane-won',
                  lane: 'translate',
                },
              },),
            ],
          },
        },),
      },);

      expect(reading.kind,).toBe('wording',);
      expect(reading.kind === 'wording' ? reading.text : '',).toBe(CONSOLIDATED_NAP,);
      expect(reading.kind === 'wording' ? reading.decidedBy : '',).toBe('consolidation',);
    },
  },),

  it({
    name:
      'FALLS THROUGH EVERY TERMINAL THAT REPLACED NOTHING, tested by shape rather than by '
      + 'enumerating names, so a terminal added later cannot silently start yielding text. Covers '
      + 'the retired spelling 11 rows across four settled entries still carry',
    fn: async () => {
      const terminals = [
        'incumbent-only',
        'no-standing-text',
        'slate-endorsed-standing',
        'slate-unjudged-standing',
        'slate-declined-standing',
        'gate-kept-standing',
        'wrap-erased-difference',
        'slate-kept-standing',
      ];

      for (const terminal of terminals) {
        const reading = firstReadingOf({
          source: sourceWith({
            consolidation: {
              kind: 'settled',
              slices: [keptStanding({ terminal, },),],
            },
            laneSelection: {
              kind: 'contested',
              slices: [
                contestedWith({
                  verdict: {
                    kind: 'lane-won',
                    lane: 'repair',
                  },
                },),
              ],
            },
          },),
        },);

        expect(reading.kind === 'wording' ? reading.text : '',).toBe(REPAIR_NAP,);
        expect(reading.kind === 'wording' ? reading.decidedBy : '',).toBe('contest',);
      }
    },
  },),

  it({
    name:
      'TAKES THE LANE THE CONTEST NAMED, on each side, since reading the winning lane off either '
      + 'lane ledger alone was wrong at every measurable row: 6 rows claimed replacement-shipped '
      + 'and 0 reached the page',
    fn: async () => {
      const wins = [
        {
          lane: 'repair',
          text: REPAIR_NAP,
        },
        {
          lane: 'translate',
          text: TRANSLATE_NAP,
        },
      ];

      for (const win of wins) {
        const reading = firstReadingOf({
          source: sourceWith({
            laneSelection: {
              kind: 'contested',
              slices: [
                contestedWith({
                  verdict: {
                    kind: 'lane-won',
                    lane: win.lane,
                  },
                },),
              ],
            },
          },),
        },);

        expect(reading.kind,).toBe('wording',);
        expect(reading.kind === 'wording' ? reading.text : '',).toBe(win.text,);
        expect(reading.kind === 'wording' ? reading.decidedBy : '',).toBe('contest',);
      }
    },
  },),

  it({
    name:
      'KEEPS THE ARCHIVE STANDING WHEN THE CONTEST DECLINED, on both declines, and REFUSES TO '
      + 'SHIP THE EMPTY STRING. standingTextFor returns empty on a decline on purpose, because it '
      + 'answers what a slate must beat; a document assembled off that would delete the slice',
    fn: async () => {
      const declines = [
        { kind: 'settled-neither', },
        { kind: 'quorum-not-met', },
      ];

      for (const verdict of declines) {
        const reading = firstReadingOf({
          source: sourceWith({
            laneSelection: {
              kind: 'contested',
              slices: [contestedWith({ verdict, },),],
            },
          },),
        },);

        expect(reading.kind,).toBe('wording',);
        expect(reading.kind === 'wording' ? reading.text : '',).toBe(ARCHIVE_NAP,);
        expect(reading.kind === 'wording' ? reading.decidedBy : '',).toBe('archive',);
      }
    },
  },),

  it({
    name:
      'NAMES THE SILENCE WHERE A DECLINED CONTEST MEETS AN ARCHIVE THAT HELD NOTHING, rather '
      + 'than returning an empty string that a caller would write into a document as wording',
    fn: async () => {
      const reading = firstReadingOf({
        source: sourceWith({
          row: rowWith({
            incumbentKind: 'absent',
            incumbentText: '',
          },),
          laneSelection: {
            kind: 'contested',
            slices: [contestedWith({ verdict: { kind: 'settled-neither', }, },),],
          },
        },),
      },);

      expect(reading.kind,).toBe('nothing-ships',);
      expect(reading.kind === 'nothing-ships' ? reading.reason : '',)
        .toBe('contest-declined-and-archive-silent',);
    },
  },),

  it({
    name:
      'SHIPS THE WORDING BOTH LANES AGREED ON where the contest never saw the slice, since '
      + 'contestEligibleIndexes makes a slice eligible exactly where the lane texts differ, so an '
      + 'unlisted slice is one where they match and agreement needs no decider',
    fn: async () => {
      const reading = firstReadingOf({
        source: sourceWith({
          row: rowWith({
            repairText: TRANSLATE_NAP,
            laneRelation: 'both-agree',
          },),
          laneSelection: {
            kind: 'contested',
            slices: [],
          },
        },),
      },);

      expect(reading.kind === 'wording' ? reading.text : '',).toBe(TRANSLATE_NAP,);
      expect(reading.kind === 'wording' ? reading.decidedBy : '',).toBe('lanes-agreed',);
    },
  },),

  it({
    name:
      'NAMES THE SILENCE WHERE BOTH LANES AGREED ON NOTHING, and does NOT revive the archive '
      + 'underneath it. Two lanes removing wording is a decision, and republishing what they both '
      + 'dropped would undo it',
    fn: async () => {
      const reading = firstReadingOf({
        source: sourceWith({
          row: rowWith({
            repairText: '',
            translateText: '',
            laneRelation: 'gap-remains',
          },),
          laneSelection: {
            kind: 'contested',
            slices: [],
          },
        },),
      },);

      expect(reading.kind,).toBe('nothing-ships',);
      expect(reading.kind === 'nothing-ships' ? reading.reason : '',)
        .toBe('lanes-agreed-on-no-wording',);
    },
  },),

  it({
    name:
      'KEEPS THE ARCHIVE STANDING WHERE NO CONTEST HAS RUN, and names that silence separately '
      + 'from a decline, because an entry nobody has judged and an entry the judges could not '
      + 'settle are different facts about the roster',
    fn: async () => {
      const standing = firstReadingOf({ source: sourceWith(), },);
      expect(standing.kind === 'wording' ? standing.text : '',).toBe(ARCHIVE_NAP,);
      expect(standing.kind === 'wording' ? standing.decidedBy : '',).toBe('archive',);

      const silent = firstReadingOf({
        source: sourceWith({
          row: rowWith({
            incumbentKind: 'absent',
            incumbentText: '',
          },),
        },),
      },);
      expect(silent.kind === 'nothing-ships' ? silent.reason : '',)
        .toBe('contest-unasked-and-archive-silent',);
    },
  },),

  it({
    name:
      'READS BOTH CONSOLIDATION ABSENCES the same way and neither as a decision. A pass that '
      + 'chose not to ask and an artifact written before the field existed both leave whatever '
      + 'the contest settled standing',
    fn: async () => {
      const absences = [
        { kind: 'not-run', },
        { kind: 'unrecorded', },
      ];

      for (const consolidation of absences) {
        const reading = firstReadingOf({
          source: sourceWith({
            consolidation,
            laneSelection: {
              kind: 'contested',
              slices: [
                contestedWith({
                  verdict: {
                    kind: 'lane-won',
                    lane: 'translate',
                  },
                },),
              ],
            },
          },),
        },);

        expect(reading.kind === 'wording' ? reading.text : '',).toBe(TRANSLATE_NAP,);
      }
    },
  },),

  it({
    name:
      'REFUSES A SLICE WHOSE LANES DIFFER THAT THE CONTEST RECORD NAMES NOWHERE, rather than '
      + 'reading it as agreement and picking one lane with nothing behind it. The parser forbids '
      + 'that artifact, so reaching it means the record contradicts itself',
    fn: async () => {
      /**
       * What unanswered raised, read for its class as well as its wording.
       */
      const refusalOfUnanswered = caught(function unanswered() {
        firstReadingOf({
          source: sourceWith({
            laneSelection: {
              kind: 'contested',
              slices: [],
            },
          },),
        },);
      },);

      expect(refusalOfUnanswered,).toBeInstanceOf(UnansweredContestSliceError,);
      expect((refusalOfUnanswered as Error).message,).toContain('names it nowhere',);
    },
  },),
  ],
},);

await describe({
  name: wouldShipTextPerSlice.name,
  children: [
  it({
    name:
      'ANSWERS EVERY COMPARISON ROW IN ORDER, so a consumer counting subjects reads a '
      + 'denominator over the whole document rather than over whichever stage it happened to open',
    fn: async () => {
      const source = {
        comparison: [
          rowWith({ chunkIndex: 0, },),
          rowWith({
            chunkIndex: 1,
            repairText: TRANSLATE_NAP,
            laneRelation: 'both-agree',
          },),
        ],
        consolidation: { kind: 'not-run', },
        laneSelection: {
          kind: 'contested',
          slices: [
            contestedWith({
              verdict: {
                kind: 'lane-won',
                lane: 'repair',
              },
            },),
          ],
        },
      } as unknown as WouldShipSource;

      const slices = wouldShipTextPerSlice({ artifact: source, },);

      expect(slices.length,).toBe(2,);

      /**
       * Reading of the contested slice, first in comparison-row order.
       */
      const contestedSlice = nonNullishOrThrow(slices[0],);

      /**
       * Reading of the slice both lanes agreed on, second in that order.
       */
      const agreedSlice = nonNullishOrThrow(slices[1],);

      expect(contestedSlice.chunkIndex,).toBe(0,);
      expect(contestedSlice.reading.kind === 'wording' ? contestedSlice.reading.decidedBy : '',)
        .toBe('contest',);
      expect(agreedSlice.chunkIndex,).toBe(1,);
      expect(agreedSlice.reading.kind === 'wording' ? agreedSlice.reading.decidedBy : '',)
        .toBe('lanes-agreed',);
    },
  },),
  ],
},);
