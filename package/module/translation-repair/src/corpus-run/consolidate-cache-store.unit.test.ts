/**
 * Tests for the store that resumes a settlement an earlier run bought.
 *
 * WHY THE SHAPE IS CHECKED AT ALL, and why more strictly than the contest
 * store's: a settlement carries `text` that SHIPS. The record built from one
 * hands that text to the assembly whenever the terminal says a consolidation
 * won, so this store is the single path on which bytes read off disk become
 * corpus text in an artifact. A file that was truncated, hand-edited, or
 * written by a different schema would carry them there with nothing else in the
 * way. Refusing it costs one re-asked slice.
 *
 * THE ABSENT GATE IS THE CASE MOST LIKELY TO BE BROKEN BY A STRICTER GUARD, so
 * it is pinned here: a slice the validity floor stopped never reached the gate,
 * and a store that required the key would refuse every floored slice and
 * re-buy it every run.
 *
 * Fixtures are cat-themed invention written into throwaway directories.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { openConsolidateCache, } from '../../dist/final/node/index.mjs';

/**
 * Built pipeline the fixtures are filled under.
 */
const TEST_GENERATION = `sha256-tree-v1:${'a'.repeat(64,)}`;

/**
 * Key every case writes and reads under.
 */
const CAT_KEY = 'c'.repeat(64,);

/**
 * One gate ballot, carrying every field the loader checks.
 */
const CAT_BALLOT = {
  choice: 'consolidated',
  unsupported: [],
  unsupportedRaw: [],
  dropped: ['standing',],
  droppedRaw: ['the standing text drops the hour she wakes',],
  reason: 'the consolidation keeps both',
};

/**
 * A settlement that shipped a consolidation, as the stage writes one.
 */
const CAT_SETTLEMENT = {
  terminal: 'consolidated',
  text: 'The cat naps in the window.\nShe wakes at four.',
  floor: {
    kind: 'proposals',
    validModelIds: ['hf:cat/Cat-A',],
  },
  verdicts: [
    {
      modelId: 'hf:cat/Cat-A',
      kind: 'valid',
      findings: [],
    },
  ],
  gate: {
    choice: 'consolidated',
    ships: 'consolidated',
    ballots: [
      CAT_BALLOT,
      CAT_BALLOT,
    ],
    usable: 2,
    findings: [],
  },
  rewrapped: true,
  demoted: false,
};

/**
 * Throwaway directory removed on scope exit.
 *
 * @returns Disposable directory handle
 *
 * @example
 * ```ts
 * await using scratch = await scratchDir();
 * ```
 */
async function scratchDir(): Promise<{
  readonly path: string;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}> {
  /**
   * Fresh directory under the platform temp root.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'whiskers-consolidate-',
  ),);
  return {
    path,
    [Symbol.asyncDispose]: async function removeScratch() {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Writes one settlement and reads the directory back through a fresh store.
 *
 * @param settlement - value to persist, valid or not
 *
 * @returns Whether a second store resumed it
 *
 * @example
 * ```ts
 * const resumed = await roundTrip({ settlement, },);
 * ```
 */
async function roundTrip(
  { settlement, }: { readonly settlement: unknown; },
): Promise<boolean> {
  await using scratch = await scratchDir();

  /**
   * Store this run persists through.
   */
  const writing = await openConsolidateCache({
    dir: scratch.path,
    generation: TEST_GENERATION,
  },);
  await writing.persist({
    key: CAT_KEY,
    serialized: JSON.stringify(settlement,),
  },);

  /**
   * Store a later run would resume through.
   */
  const reading = await openConsolidateCache({
    dir: scratch.path,
    generation: TEST_GENERATION,
  },);
  return reading.resumed
    .has(CAT_KEY,);
}

await describe({
  name: openConsolidateCache.name,
  children: [
    it({
      name: 'ROUND-TRIPS a settled consolidation, which is the half that fails silently: persist and '
        + 'resume disagreeing about a file name costs a re-bought slate and gate per slice per run '
        + 'and errors nowhere',
      fn: async () => {
        expect(await roundTrip({ settlement: CAT_SETTLEMENT, },),).toBe(true,);
      },
    },),

    it({
      name: 'RESUMES A SLICE THAT NEVER REACHED THE GATE, since the validity floor stopping a slate '
        + 'is the ordinary outcome where every proposal was structurally refused. A store requiring '
        + 'the gate key would re-buy a full roster every run to be told the same thing',
      fn: async () => {
        expect(await roundTrip({
          settlement: {
            terminal: 'incumbent-only',
            text: 'A cat sleeps by the window.',
            floor: {
              kind: 'incumbent-only',
              refusedModelIds: ['hf:cat/Cat-A',],
            },
            verdicts: [
              {
                modelId: 'hf:cat/Cat-A',
                kind: 'invalid',
                findings: ['the page is 2 blocks and this is 1',],
              },
            ],
            rewrapped: false,
            demoted: false,
          },
        },),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A TERMINAL THIS SCHEMA DOES NOT NAME, rather than resuming a settlement whose '
        + 'own account of how it ended nothing can read. The terminal is what decides whether the '
        + 'text ships, so an unreadable one is a slice that would ship on a coin toss',
      fn: async () => {
        expect(await roundTrip({
          settlement: {
            ...CAT_SETTLEMENT,
            terminal: 'shipped-because-i-said-so',
          },
        },),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES A SETTLEMENT WHOSE TEXT IS NOT A STRING, which is the whole reason this guard is '
        + 'stricter than the contest store: that text is written into the document when the terminal '
        + 'says a consolidation won, so a null or a number reaches the assembly as the passage',
      fn: async () => {
        expect(await roundTrip({
          settlement: {
            ...CAT_SETTLEMENT,
            text: null,
          },
        },),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES A GATE WHOSE USABLE COUNT DISAGREES WITH ITS BALLOTS, mirroring the contest '
        + 'store: the count is what the quorum and the resume rule both read, so a file claiming six '
        + 'voices behind one ballot would settle a slice on a panel that never existed',
      fn: async () => {
        expect(await roundTrip({
          settlement: {
            ...CAT_SETTLEMENT,
            gate: {
              ...CAT_SETTLEMENT.gate,
              usable: 6,
            },
          },
        },),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES A BALLOT MISSING A FIELD, rather than resuming an outcome the artifact reader '
        + 'will refuse after a whole document has been paid for',
      fn: async () => {
        /**
         * Ballot without the raw findings the reader requires.
         */
        const { droppedRaw: _dropped, ...partial } = CAT_BALLOT;
        expect(await roundTrip({
          settlement: {
            ...CAT_SETTLEMENT,
            gate: {
              ...CAT_SETTLEMENT.gate,
              ballots: [partial,],
              usable: 1,
            },
          },
        },),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES A BALLOT NAMING A RENDERING THAT DOES NOT EXIST, because the evidence fields are '
        + 'read as choices rather than as prose: a name outside consolidated, standing and neither '
        + 'would be counted as nothing and silently weaken the very evidence the gate settles on',
      fn: async () => {
        expect(await roundTrip({
          settlement: {
            ...CAT_SETTLEMENT,
            gate: {
              ...CAT_SETTLEMENT.gate,
              ballots: [
                {
                  ...CAT_BALLOT,
                  dropped: ['the other one',],
                },
              ],
              usable: 1,
            },
          },
        },),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES A FLOOR IT CANNOT READ, since the floor is what says whether any proposal '
        + 'survived validation at all, and a settlement carrying an unreadable one cannot be audited '
        + 'for the case the band pair actually hit',
      fn: async () => {
        expect(await roundTrip({
          settlement: {
            ...CAT_SETTLEMENT,
            floor: { kind: 'everyone-passed', },
          },
        },),).toBe(false,);
      },
    },),
  ],
},);
