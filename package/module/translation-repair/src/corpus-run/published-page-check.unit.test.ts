/**
 * Tests for reading the published tree back against the artifacts that made it.
 *
 * NOTHING HERE TOUCHES A DISK. Both subjects are total functions of an artifact
 * and a string, so a case that needed a directory would be measuring the reader
 * rather than the check.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  pageCarriesEveryWording,
  pageWeighsWhatItShould,
  pageWeightRefutes,
  pairPublishedPages,
  PublishedPageDisagreesError,
  refusePageThatDisagrees,
  type WouldShipSource,
} from '../../dist/final/node/index.mjs';

/**
 * Wording the first slice settled on.
 */
const FIRST_NAP = 'She naps on the counter by the till.';

/**
 * Wording the second slice settled on.
 */
const SECOND_NAP = 'By four she has moved to the window.';

/**
 * Wording a third slice settled on, sharing a tail with {@link FIRST_NAP} so a
 * check that searched from the start of the page could match inside it.
 */
const THIRD_NAP = 'by the till.';

/**
 * Archive English the weighing fixtures start with, replaced by
 * {@link FIRST_NAP} so the expected length differs from the archive's.
 */
const OLD_NAP = 'She sleeps somewhere.';

/**
 * Second archive-side wording, so a fixture can swap two settled renderings
 * between slices without changing how long the page is.
 */
const OLD_PERCH = 'She sits somewhere else.';

/**
 * Archive carrying two slices with unsliced text around and between them.
 */
const ARCHIVE_TWO_SLICES =
  `# Mittens\n\n${OLD_NAP}\n\n${OLD_PERCH}\n\nNobody decided anything about this line.\n`;

/**
 * Both slices, each replacing its own archive wording.
 */
const TWO_SWAPS = [
  {
    incumbent: OLD_NAP,
    ships: FIRST_NAP,
  },
  {
    incumbent: OLD_PERCH,
    ships: SECOND_NAP,
  },
];

/**
 * One slice as a fixture states it: what the archive held there, and what the
 * lanes settled on shipping in its place.
 *
 * @example
 * ```ts
 * const row: FixtureSlice = { incumbent: OLD_NAP, ships: FIRST_NAP, };
 * ```
 */
type FixtureSlice = {
  /**
   * Archive English this slice covers, empty at an anchor.
   */
  readonly incumbent: string;

  /**
   * What both lanes settled on, empty where nothing ships.
   */
  readonly ships: string;
};

/**
 * Builds an artifact over the slices given, in `sliceIndex` order.
 *
 * GOES THROUGH LANES THAT AGREED, which is the shortest path to a settled
 * wording: a slice both lanes wrote the same way needs no contest, so the
 * fixture carries no ballots. Which decider settles a slice is
 * `would-ship-text.unit.test.ts`.
 *
 * @param slices - archive text and shipped text per slice
 *
 * @returns Artifact the checks read
 *
 * @example
 * ```ts
 * const artifact = artifactOver([{ incumbent: OLD_NAP, ships: FIRST_NAP, },],);
 * ```
 */
function artifactOver(slices: readonly FixtureSlice[],): WouldShipSource {
  return {
    comparison: slices.map(function slice(
      { incumbent, ships, },
      sliceIndex,
    ): unknown {
      return {
        sliceIndex,
        incumbentKind: (incumbent === '') ? 'absent' : 'present',
        incumbentText: incumbent,
        repairText: ships,
        translateText: ships,
        laneRelation: (incumbent === ships) ? 'archive-stands' : 'both-agree',
        repairOutcome: {
          kind: 'decided',
          acceptedText: ships,
        },
        translateOutcome: {
          kind: 'decided',
          acceptedText: ships,
        },
        decisionComparison: {
          kind: 'comparable',
          verdict: 'same',
        },
        repairDelivery: { kind: 'replacement-shipped', },
        translateDelivery: { kind: 'replacement-shipped', },
      };
    },),
    consolidation: { kind: 'not-run', },
    laneSelection: {
      kind: 'contested',
      slices: [],
    },
  } as unknown as WouldShipSource;
}

/**
 * Builds an artifact whose slices ship the wordings given and leave the archive
 * saying the same thing, which is all the wording scan needs.
 *
 * @param wordings - text each slice carries, in `sliceIndex` order, with an
 * empty string standing for a slice that ships nothing
 *
 * @returns Artifact the check reads
 *
 * @example
 * ```ts
 * const artifact = artifactShipping([FIRST_NAP, SECOND_NAP,],);
 * ```
 */
function artifactShipping(wordings: readonly string[],): WouldShipSource {
  return artifactOver(wordings.map(function same(text,): FixtureSlice {
    return {
      incumbent: text,
      ships: text,
    };
  },),);
}

await describe({
  name: pageCarriesEveryWording.name,
  children: [
    it({
      name:
        'FINDS NOTHING MISSING in a page that carries every wording in slice order, which is the '
        + 'control the failing cases rest on: a check that reported every page as broken would satisfy '
        + 'them all and say nothing',
      fn: async () => {
        const check = pageCarriesEveryWording({
          artifact: artifactShipping([FIRST_NAP, SECOND_NAP,],),
          pageText: `# Mittens\n\n${FIRST_NAP}\n\n${SECOND_NAP}\n`,
        },);

        expect(check.missing,).toEqual([],);
        expect(check.wordings,).toBe(2,);
        expect(check.silentSlices,).toBe(0,);
      },
    },),

    it({
      name:
        'NAMES THE SLICE AND ITS SIZE for a wording the page lost, and quotes neither. A run '
        + 'directory holds unlicensed corpus wording, so a finding a reader can paste anywhere has to '
        + 'be an index and a count',
      fn: async () => {
        const check = pageCarriesEveryWording({
          artifact: artifactShipping([FIRST_NAP, SECOND_NAP,],),
          pageText: `# Mittens\n\n${FIRST_NAP}\n`,
        },);

        expect(check.missing,).toEqual([
          {
            sliceIndex: 1,
            characters: SECOND_NAP.length,
          },
        ],);
      },
    },),

    it({
      name:
        'REPORTS A PAGE THAT CARRIES BOTH WORDINGS IN THE WRONG ORDER, which is what the cursor is '
        + 'for. Slices are contiguous and ordered in the document, so a page holding the second '
        + 'passage above the first is not the page the artifact describes, and a check that only '
        + 'asked whether each wording occurs somewhere would pass it',
      fn: async () => {
        const check = pageCarriesEveryWording({
          artifact: artifactShipping([FIRST_NAP, SECOND_NAP,],),
          pageText: `# Mittens\n\n${SECOND_NAP}\n\n${FIRST_NAP}\n`,
        },);

        expect(check.missing,).toEqual([
          {
            sliceIndex: 1,
            characters: SECOND_NAP.length,
          },
        ],);
      },
    },),

    it({
      name:
        'ADVANCES PAST A WORDING RATHER THAN PAST ITS START, so a later slice whose text also appears '
        + 'inside an earlier one is matched at its own position. Searching from where the previous '
        + 'match BEGAN would let two slices claim one stretch of page and report a page that lost a '
        + 'passage as complete',
      fn: async () => {
        const check = pageCarriesEveryWording({
          artifact: artifactShipping([FIRST_NAP, THIRD_NAP,],),
          pageText: `# Mittens\n\n${FIRST_NAP}\n\nShe keeps her post ${THIRD_NAP}\n`,
        },);

        expect(check.missing,).toEqual([],);
      },
    },),

    it({
      name:
        'COUNTS A SILENT SLICE AND REQUIRES NOTHING OF THE PAGE FOR IT, since a slice that ships no '
        + 'wording has none to look for. Requiring something there would report every unfilled anchor '
        + 'as a lost passage, which is the state `#194` made ordinary rather than fatal',
      fn: async () => {
        const check = pageCarriesEveryWording({
          artifact: artifactShipping([FIRST_NAP, '', SECOND_NAP,],),
          pageText: `# Mittens\n\n${FIRST_NAP}\n\n${SECOND_NAP}\n`,
        },);

        expect(check.silentSlices,).toBe(1,);
        expect(check.wordings,).toBe(2,);
        expect(check.missing,).toEqual([],);
      },
    },),
  ],
},);

/**
 * Archive English a weighing fixture starts from, with wording outside every
 * slice so a cut can land where no reading covers it.
 */
const ARCHIVE_PAGE = `# Mittens\n\n${OLD_NAP}\n\nShe has worked the shop since the spring, and nobody decided anything about that.\n`;

/**
 * Slice the weighing fixtures replace, one wording swapped for a longer one.
 */
const ONE_SWAP = [{
  incumbent: OLD_NAP,
  ships: FIRST_NAP,
},];

/**
 * Page a correct publish produces from {@link ARCHIVE_PAGE} under
 * {@link ONE_SWAP}.
 */
const SWAPPED_PAGE = ARCHIVE_PAGE.replace(
  OLD_NAP,
  FIRST_NAP,
);

await describe({
  name: pageWeighsWhatItShould.name,
  children: [
    it({
      name:
        'WEIGHS A CORRECT PAGE AT EXACTLY WHAT THE ARCHIVE PLUS ITS ONE SWAP COMES TO, which is the '
        + 'control every failing case here rests on. Measured the same way against six real published '
        + 'pages, on five that grew and one that shrank, the prediction was exact on all six',
      fn: async () => {
        const weight = pageWeighsWhatItShould({
          artifact: artifactOver(ONE_SWAP,),
          archive: {
            kind: 'stored',
            text: ARCHIVE_PAGE,
          },
          pageText: SWAPPED_PAGE,
        },);

        expect(weight,).toEqual({
          kind: 'weighed',
          expected: SWAPPED_PAGE.length,
          actual: SWAPPED_PAGE.length,
          exact: true,
        },);
        expect(pageWeightRefutes({ weight, },),).toBe(false,);
      },
    },),

    it({
      name:
        'REFUTES A PAGE THAT LOST TEXT NO SLICE DECIDED ON, which the wording scan cannot: this is the '
        + 'case that failed as a live control before the arithmetic existed. Two hundred characters cut '
        + 'from a real page left every wording in place and in order, because the wordings cover the '
        + 'slices and a page is mostly the text between them',
      fn: async () => {
        /**
         * Correct page with its unsliced tail removed, which no reading covers.
         */
        const cut = SWAPPED_PAGE.replace(
          ', and nobody decided anything about that',
          '',
        );

        const weight = pageWeighsWhatItShould({
          artifact: artifactOver(ONE_SWAP,),
          archive: {
            kind: 'stored',
            text: ARCHIVE_PAGE,
          },
          pageText: cut,
        },);

        expect(pageWeightRefutes({ weight, },),).toBe(true,);

        // THE OTHER CHECK PASSES THIS PAGE, stated as an assertion rather than a
        // remark: if the wording scan ever grew strong enough to catch this, the
        // case above would stop measuring what it was written to measure.
        expect(pageCarriesEveryWording({
          artifact: artifactOver(ONE_SWAP,),
          pageText: cut,
        },).missing,).toEqual([],);
      },
    },),

    it({
      name:
        'REFUTES A PAGE THAT GAINED TEXT NO SLICE DECIDED ON, since an assembler that duplicated a '
        + 'passage is as wrong as one that dropped it and neither shows up in an occurrence scan',
      fn: async () => {
        const weight = pageWeighsWhatItShould({
          artifact: artifactOver(ONE_SWAP,),
          archive: {
            kind: 'stored',
            text: ARCHIVE_PAGE,
          },
          pageText: `${SWAPPED_PAGE}\n${SECOND_NAP}\n`,
        },);

        expect(pageWeightRefutes({ weight, },),).toBe(true,);
      },
    },),

    it({
      name:
        'REPORTS AN ARTIFACT WRITTEN BEFORE THE ARCHIVE TEXT WAS STORED AS UNWEIGHABLE RATHER THAN AS '
        + 'AGREEING, because a whole run of those would otherwise read as a run that was checked. It '
        + 'cannot refute a page either, which is a different statement from finding it correct',
      fn: async () => {
        const weight = pageWeighsWhatItShould({
          artifact: artifactOver(ONE_SWAP,),
          archive: { kind: 'unrecorded', },
          pageText: SWAPPED_PAGE,
        },);

        expect(weight,).toEqual({ kind: 'unweighable', },);
        expect(pageWeightRefutes({ weight, },),).toBe(false,);
      },
    },),

    it({
      name:
        'TREATS A FILLED ANCHOR AS A FLOOR RATHER THAN AN EQUALITY, and stays one-sided about it. '
        + '`spliceSlices` composes the separators around an inserted rendering rather than carrying '
        + 'them in any row, so those characters are real and uncounted: a longer page is expected and '
        + 'a shorter one still lost text',
      fn: async () => {
        /**
         * Archive with nothing where the anchor sits, and the anchor filled.
         */
        const anchored = artifactOver([
          {
            incumbent: OLD_NAP,
            ships: FIRST_NAP,
          },
          {
            incumbent: '',
            ships: SECOND_NAP,
          },
        ],);

        /**
         * Shared facets of the two weighings this case compares.
         */
        const over = {
          artifact: anchored,
          archive: {
            kind: 'stored',
            text: ARCHIVE_PAGE,
          },
        } as const;

        /**
         * Page carrying the insertion plus the separators nobody counted.
         */
        const withSeparators = pageWeighsWhatItShould({
          ...over,
          pageText: `${SWAPPED_PAGE}\n\n${SECOND_NAP}\n`,
        },);

        expect(withSeparators.kind,).toBe('weighed',);
        expect(pageWeightRefutes({ weight: withSeparators, },),).toBe(false,);

        expect(pageWeightRefutes({
          weight: pageWeighsWhatItShould({
            ...over,
            pageText: SWAPPED_PAGE,
          },),
        },),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: refusePageThatDisagrees.name,
  children: [
    it({
      name:
        'PUBLISHES A CORRECT PAGE WITHOUT COMPLAINT, which is the control the refusals rest on: a '
        + 'guard that refused everything would satisfy them all and stop every entry',
      fn: async () => {
        expect(() => {
          refusePageThatDisagrees({
            artifact: artifactOver(ONE_SWAP,),
            archive: {
              kind: 'stored',
              text: ARCHIVE_PAGE,
            },
            pageText: SWAPPED_PAGE,
            entryId: 'Mittens',
          },);
        },).not.toThrow();
      },
    },),

    it({
      name:
        'REFUSES A PAGE MISSING A WORDING, naming the entry and the slice so the refusal is actionable '
        + 'from a log line alone',
      fn: async () => {
        /**
         * Whatever the guard raised, caught so its class and text can be read.
         */
        const refusal = ((): unknown => {
          try {
            refusePageThatDisagrees({
              artifact: artifactOver(ONE_SWAP,),
              archive: {
                kind: 'stored',
                text: ARCHIVE_PAGE,
              },
              pageText: ARCHIVE_PAGE,
              entryId: 'Mittens',
            },);
            return undefined;
          } catch (error) {
            return error;
          }
        })();

        expect(refusal,).toBeInstanceOf(PublishedPageDisagreesError,);
        expect((refusal as Error).message,).toContain('Mittens',);

        // THE SCAN'S OWN WORDS, not merely the word "slice", which the length
        // refusal also contains. Asserting the looser thing let a mutation that
        // deleted this whole branch pass, because the page in this case is the
        // wrong length too and the arithmetic caught it instead.
        expect((refusal as Error).message,).toContain('in slice order',);
      },
    },),

    it({
      name:
        'REFUSES TWO RENDERINGS SWAPPED BETWEEN THEIR SLICES, which the arithmetic cannot see. Both '
        + 'wordings are present and the page is exactly as long as it should be, so the length '
        + 'invariant agrees with it and only the ordered scan disagrees. This is the case that keeps '
        + 'the scan in the guard beside the arithmetic',
      fn: async () => {
        /**
         * Page a correct publish produces over both slices.
         */
        const correct = ARCHIVE_TWO_SLICES
          .replace(
            OLD_NAP,
            FIRST_NAP,
          )
          .replace(
            OLD_PERCH,
            SECOND_NAP,
          );

        /**
         * Same page with the two settled renderings in each other's slices.
         */
        const swapped = ARCHIVE_TWO_SLICES
          .replace(
            OLD_NAP,
            SECOND_NAP,
          )
          .replace(
            OLD_PERCH,
            FIRST_NAP,
          );

        // THE PREMISE OF THE CASE, asserted rather than assumed: if these ever
        // differed in length the arithmetic would catch it and this would stop
        // measuring the scan.
        expect(swapped.length,).toBe(correct.length,);

        expect(pageWeightRefutes({
          weight: pageWeighsWhatItShould({
            artifact: artifactOver(TWO_SWAPS,),
            archive: {
              kind: 'stored',
              text: ARCHIVE_TWO_SLICES,
            },
            pageText: swapped,
          },),
        },),).toBe(false,);

        expect(() => {
          refusePageThatDisagrees({
            artifact: artifactOver(TWO_SWAPS,),
            archive: {
              kind: 'stored',
              text: ARCHIVE_TWO_SLICES,
            },
            pageText: swapped,
            entryId: 'Mittens',
          },);
        },).toThrow(PublishedPageDisagreesError,);

        // AND THE CORRECT PAGE STILL PASSES, so the case above is about order
        // rather than about this fixture being unpublishable.
        expect(() => {
          refusePageThatDisagrees({
            artifact: artifactOver(TWO_SWAPS,),
            archive: {
              kind: 'stored',
              text: ARCHIVE_TWO_SLICES,
            },
            pageText: correct,
            entryId: 'Mittens',
          },);
        },).not.toThrow();
      },
    },),

    it({
      name:
        'REFUSES A PAGE THAT LOST TEXT NO SLICE DECIDED ON even though every wording is present, which '
        + 'is the case a live control caught: two hundred characters cut from a real page left the '
        + 'occurrence scan reporting nothing missing',
      fn: async () => {
        /**
         * Correct page with its unsliced tail removed, which no reading covers.
         */
        const cut = SWAPPED_PAGE.replace(
          ', and nobody decided anything about that',
          '',
        );

        expect(pageCarriesEveryWording({
          artifact: artifactOver(ONE_SWAP,),
          pageText: cut,
        },).missing,).toEqual([],);

        expect(() => {
          refusePageThatDisagrees({
            artifact: artifactOver(ONE_SWAP,),
            archive: {
              kind: 'stored',
              text: ARCHIVE_PAGE,
            },
            pageText: cut,
            entryId: 'Mittens',
          },);
        },).toThrow(PublishedPageDisagreesError,);
      },
    },),

    it({
      name:
        'QUOTES NO PASSAGE IN ITS REFUSAL, which is a corpus rule rather than a style one. A run '
        + 'directory holds unlicensed wording and an error message travels further than the directory '
        + 'it was raised in: into logs, into a pass report, into a session transcript',
      fn: async () => {
        /**
         * Whatever the guard raised, caught so its text can be inspected.
         */
        const refusal = ((): unknown => {
          try {
            refusePageThatDisagrees({
              artifact: artifactOver(ONE_SWAP,),
              archive: {
                kind: 'stored',
                text: ARCHIVE_PAGE,
              },
              pageText: ARCHIVE_PAGE,
              entryId: 'Mittens',
            },);
            return undefined;
          } catch (error) {
            return error;
          }
        })();

        /**
         * What the refusal said, read once for the three claims below.
         */
        const said = (refusal as Error).message;

        expect(said.includes(FIRST_NAP,),).toBe(false,);
        expect(said.includes(OLD_NAP,),).toBe(false,);
        expect(said.includes(ARCHIVE_PAGE,),).toBe(false,);
      },
    },),

    it({
      name:
        'ACCEPTS A PAGE LONGER THAN THE SUM WHERE AN ANCHOR WAS FILLED, because `spliceSlices` composes '
        + 'the separators around an inserted rendering rather than carrying them in any row. Refusing '
        + 'on that would stop every entry that fills a gap, which is the work this pipeline exists for',
      fn: async () => {
        expect(() => {
          refusePageThatDisagrees({
            artifact: artifactOver([
              {
                incumbent: OLD_NAP,
                ships: FIRST_NAP,
              },
              {
                incumbent: '',
                ships: SECOND_NAP,
              },
            ],),
            archive: {
              kind: 'stored',
              text: ARCHIVE_PAGE,
            },
            pageText: `${SWAPPED_PAGE}\n\n${SECOND_NAP}\n`,
            entryId: 'Mittens',
          },);
        },).not.toThrow();
      },
    },),
  ],
},);

await describe({
  name: pairPublishedPages.name,
  children: [
    it({
      name:
        'PAIRS EVERY ENTRY that has both an artifact and a page, leaving both complaint lists empty',
      fn: async () => {
        expect(pairPublishedPages({
          settled: ['BookshopCat', 'Mittens',],
          published: ['BookshopCat', 'Mittens',],
        },),).toEqual({
          matched: ['BookshopCat', 'Mittens',],
          unpublished: [],
          unsettled: [],
        },);
      },
    },),

    it({
      name:
        'NAMES AN ENTRY SETTLED AND NEVER PUBLISHED, which is the serious half. A pass builds its '
        + 'skip set from the artifacts on disk, so that entry is one no resumed pass will attempt '
        + 'again and no reader will ever find a page for',
      fn: async () => {
        expect(pairPublishedPages({
          settled: ['BookshopCat', 'Mittens',],
          published: ['BookshopCat',],
        },),).toEqual({
          matched: ['BookshopCat',],
          unpublished: ['Mittens',],
          unsettled: [],
        },);
      },
    },),

    it({
      name:
        'NAMES AN ENTRY PUBLISHED AND NOT SETTLED SEPARATELY, because it is the untidy half rather '
        + 'than the serious one: publishing runs before the artifact write, so a crash between them '
        + 'leaves this, and a resumed pass re-settles the entry and overwrites the page',
      fn: async () => {
        expect(pairPublishedPages({
          settled: ['BookshopCat',],
          published: ['BookshopCat', 'Mittens',],
        },),).toEqual({
          matched: ['BookshopCat',],
          unpublished: [],
          unsettled: ['Mittens',],
        },);
      },
    },),
  ],
},);
