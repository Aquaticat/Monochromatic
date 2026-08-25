/**
 * Tests for naming the one built pipeline a draw's pool was settled under.
 *
 * THE FUNCTION IS KEYED ON THE KEPT NAMES, NOT ON THE LOOKUP, and that is the
 * property most worth pinning. `EligibleEntries.digestByEntry` answers for every
 * entry the pool ADMITTED, while a draw keeps a subset of those; reading the
 * lookup's values directly would let an entry the draw never touched decide the
 * pool's generation, or turn a clean single-generation draw into the
 * two-generation refusal below. Every case here therefore hands over a lookup
 * wider than the kept names.
 *
 * THE COUNT AND THE DIGEST ARE COUNTED OVER DIFFERENT SETS, deliberately. The
 * digest comes from kept entries that recorded one, and `entries` comes from
 * every kept name. A pool where half the artifacts predate digest recording
 * still has one generation and still offered the sample its full width, so
 * collapsing the two counts would understate the pool a graded sheet was drawn
 * from. `#60` is the gap this closes, and that asymmetry is the closing.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type EligibleEntries,
  poolGeneration,
} from '../../dist/final/node/index.mjs';

//region Pool generation tests

/**
 * Artifact one household's draw kept.
 */
const WHISKERS = 'whiskers.json';

/**
 * Second artifact of that draw.
 */
const MITTENS = 'mittens.json';

/**
 * Third artifact of that draw.
 */
const SAFFRON = 'saffron.json';

/**
 * Artifact the pool admitted and the draw did NOT keep.
 *
 * Present in every lookup below, so any case that starts reading the lookup
 * rather than the kept names fails on the extra generation it introduces.
 */
const UNDRAWN = 'pepperbox.json';

/**
 * Built pipeline most of these artifacts were settled under.
 */
const SETTLED_UNDER = 'c4f9e1a7b2d6';

/**
 * A different built pipeline, which a pool may not span.
 */
const OTHER_BUILD = '8e3a0d5c17bf';

/**
 * Third build, carried only by the entry no draw kept.
 */
const UNDRAWN_BUILD = 'fa27b9046e3d';

/**
 * Why a pool that recorded nothing cannot name a generation.
 */
const NOTHING_RECORDED = 'no kept entry recorded a pipeline digest';

/**
 * Why a pool spanning builds cannot name one either.
 */
const TWO_GENERATIONS = 'pool holds 2 generations, which the pool guard should have refused';

/**
 * Artifacts the whole-household draw kept.
 */
const WHOLE_HOUSEHOLD: readonly string[] = [
  WHISKERS,
  MITTENS,
  SAFFRON,
];

/**
 * How many that comes to, which is what a manifest reports as the pool width.
 */
const HOUSEHOLD_SIZE = 3;

/**
 * Builds an eligibility result carrying one digest lookup and nothing else the
 * function reads.
 *
 * The other fields are filled with what an empty pool would carry rather than
 * with the kept names, precisely because `poolGeneration` must not consult
 * them: a fixture that agreed with the kept names could not tell a reader of
 * `entryIds` from a reader of `names`.
 *
 * @param digests - what each admitted entry recorded, keyed by artifact name
 *
 * @returns Eligibility result shaped for this function's one question
 *
 * @example
 * ```ts
 * const eligible = pooled({ digests: [[WHISKERS, SETTLED_UNDER,],], },);
 * ```
 */
function pooled(
  {
    digests,
  }: {
    readonly digests: readonly (readonly [
      string,
      string,
    ])[];
  },
): EligibleEntries {
  return {
    entryIds: [],
    excludedIds: [],
    malformedIds: [],
    tipByEntry: new Map(),
    digestByEntry: new Map(digests,),
    selection: { kind: 'all-generations', },
    report: [],
  };
}

await describe({
  name: poolGeneration.name,
  children: [
    it({
      name: 'NAMES the one build every kept entry recorded, and how many were offered',
      fn: async () => {
        expect(poolGeneration({
          eligible: pooled({
            digests: [
              [
                WHISKERS,
                SETTLED_UNDER,
              ],
              [
                MITTENS,
                SETTLED_UNDER,
              ],
              [
                SAFFRON,
                SETTLED_UNDER,
              ],
              [
                UNDRAWN,
                UNDRAWN_BUILD,
              ],
            ],
          },),
          names: WHOLE_HOUSEHOLD,
        },),).toEqual({
          kind: 'recorded',
          digest: SETTLED_UNDER,
          entries: HOUSEHOLD_SIZE,
        },);
      },
    },),
    it({
      name: 'COUNTS every kept name, including ones that recorded no build',
      fn: async () => {
        // Only one of the three kept artifacts recorded a digest. The pool still
        // has one generation and still offered three entries, so the count must
        // not shrink to the one that happened to be tagged.
        expect(poolGeneration({
          eligible: pooled({
            digests: [
              [
                MITTENS,
                SETTLED_UNDER,
              ],
              [
                UNDRAWN,
                UNDRAWN_BUILD,
              ],
            ],
          },),
          names: WHOLE_HOUSEHOLD,
        },),).toEqual({
          kind: 'recorded',
          digest: SETTLED_UNDER,
          entries: HOUSEHOLD_SIZE,
        },);
      },
    },),
    it({
      name: 'REFUSES to name a build when no kept entry recorded one',
      fn: async () => {
        // The lookup is not empty: it holds a build for an entry this draw did
        // not keep. Reading values rather than kept names would report that one
        // as the pool's generation.
        expect(poolGeneration({
          eligible: pooled({
            digests: [
              [
                UNDRAWN,
                UNDRAWN_BUILD,
              ],
            ],
          },),
          names: WHOLE_HOUSEHOLD,
        },),).toEqual({
          kind: 'unrecorded',
          reason: NOTHING_RECORDED,
        },);
      },
    },),
    it({
      name: 'REFUSES to name a build for a draw that kept nothing',
      fn: async () => {
        expect(poolGeneration({
          eligible: pooled({
            digests: [
              [
                WHISKERS,
                SETTLED_UNDER,
              ],
            ],
          },),
          names: [],
        },),).toEqual({
          kind: 'unrecorded',
          reason: NOTHING_RECORDED,
        },);
      },
    },),
    it({
      name: 'REFUSES a pool spanning two builds, and says the guard should have caught it',
      fn: async () => {
        expect(poolGeneration({
          eligible: pooled({
            digests: [
              [
                WHISKERS,
                SETTLED_UNDER,
              ],
              [
                MITTENS,
                OTHER_BUILD,
              ],
              [
                SAFFRON,
                SETTLED_UNDER,
              ],
            ],
          },),
          names: WHOLE_HOUSEHOLD,
        },),).toEqual({
          kind: 'unrecorded',
          reason: TWO_GENERATIONS,
        },);
      },
    },),
    it({
      name: 'IGNORES an undrawn entry that recorded a build of its own',
      fn: async () => {
        // Same lookup as the two-generation case except the second build sits on
        // the entry nobody kept. A reader of the lookup refuses this pool; a
        // reader of the kept names names its one build, which is correct.
        expect(poolGeneration({
          eligible: pooled({
            digests: [
              [
                WHISKERS,
                SETTLED_UNDER,
              ],
              [
                MITTENS,
                SETTLED_UNDER,
              ],
              [
                SAFFRON,
                SETTLED_UNDER,
              ],
              [
                UNDRAWN,
                OTHER_BUILD,
              ],
            ],
          },),
          names: WHOLE_HOUSEHOLD,
        },),).toEqual({
          kind: 'recorded',
          digest: SETTLED_UNDER,
          entries: HOUSEHOLD_SIZE,
        },);
      },
    },),
  ],
},);

//endregion Pool generation tests
