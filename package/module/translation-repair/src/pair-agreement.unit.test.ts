/**
 * Tests for pair agreement across every voice.
 *
 * `#245`: both pairing stages took candidates from the first usable reply and
 * only counted the others, so a pair two later voices named vanished when the
 * first omitted it. These cases pin agreement per pair, the vote rule for a
 * contested source, and the strictly increasing result the step builders need.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { agreePairs, } from '../dist/final/node/index.mjs';

/**
 * Voices a pair needs, as both stages set it.
 */
const NEEDED = 2;

await describe({
  name: agreePairs.name,
  children: [
    it({
      name: 'KEEPS a pair two later voices named though the first voice omitted it (`#245`)',
      fn: async () => {
        expect(agreePairs({
          pairings: [
            [
              {
                source: 0,
                target: 0,
              },
            ],
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 1,
              },
            ],
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 1,
              },
            ],
          ],
          needed: NEEDED,
        },),).toEqual({
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 1,
              target: 1,
            },
          ],
          findings: [],
        },);
      },
    },),
    it({
      name: 'DROPS a pair only one voice named, whichever voice that was',
      fn: async () => {
        expect(agreePairs({
          pairings: [
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 2,
                target: 2,
              },
            ],
            [
              {
                source: 0,
                target: 0,
              },
            ],
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 1,
              },
            ],
          ],
          needed: NEEDED,
        },).pairs,).toEqual([
          {
            source: 0,
            target: 0,
          },
        ],);
      },
    },),
    it({
      name: 'PREFERS the better-voted target where voices name one source against two, and says'
        + ' nothing when nothing agreed was lost',
      fn: async () => {
        expect(agreePairs({
          pairings: [
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 1,
              },
            ],
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 1,
              },
            ],
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 2,
              },
            ],
          ],
          needed: NEEDED,
        },),).toEqual({
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 1,
              target: 1,
            },
          ],
          findings: [],
        },);
      },
    },),
    it({
      name: 'DROPS a contested source whose targets tie, and names it, since a pairing the voices'
        + ' split on evenly is nobody\'s agreement',
      fn: async () => {
        expect(agreePairs({
          pairings: [
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 1,
              },
            ],
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 1,
              },
            ],
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 2,
              },
            ],
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 2,
              },
            ],
          ],
          needed: NEEDED,
        },),).toEqual({
          pairs: [
            {
              source: 0,
              target: 0,
            },
          ],
          findings: ['contested (source 1 named against 2 targets)'],
        },);
      },
    },),
    it({
      name: 'KEEPS corroborated paragraph splits and merges in many-to-many mode, because block wire explicitly represents repeated positions on either side',
      fn: async () => {
        expect(agreePairs({
          pairings: [
            [
              { source: 0, target: 0, },
              { source: 0, target: 1, },
              { source: 1, target: 1, },
            ],
            [
              { source: 0, target: 0, },
              { source: 0, target: 1, },
              { source: 1, target: 1, },
            ],
          ],
          needed: NEEDED,
          pairingShape: 'many-to-many',
        },),).toEqual({
          pairs: [
            { source: 0, target: 0, },
            { source: 0, target: 1, },
            { source: 1, target: 1, },
          ],
          findings: [],
        },);
      },
    },),
    it({
      name: 'DOES NOT INVENT A SPLIT from tied alternatives no voice named together',
      fn: async () => {
        expect(agreePairs({
          pairings: [
            [{ source: 0, target: 0, },],
            [{ source: 0, target: 0, },],
            [{ source: 0, target: 1, },],
            [{ source: 0, target: 1, },],
          ],
          needed: NEEDED,
          pairingShape: 'many-to-many',
        },),).toEqual({
          pairs: [],
          findings: ['contested (source 0 named against 2 targets)'],
        },);
      },
    },),
    it({
      name: 'KEEPS the result strictly increasing on both sides, skipping and naming an agreed'
        + ' pair that would run backwards',
      fn: async () => {
        expect(agreePairs({
          pairings: [
            [
              {
                source: 0,
                target: 2,
              },
              {
                source: 1,
                target: 1,
              },
            ],
            [
              {
                source: 0,
                target: 2,
              },
              {
                source: 1,
                target: 1,
              },
            ],
          ],
          needed: NEEDED,
        },),).toEqual({
          pairs: [
            {
              source: 0,
              target: 2,
            },
          ],
          findings: ['non-monotone (1,1 runs back behind 2)'],
        },);
      },
    },),
    it({
      name: 'AGREES on nothing from a single voice, because a pairing one model invented is not'
        + ' agreement',
      fn: async () => {
        expect(agreePairs({
          pairings: [
            [
              {
                source: 0,
                target: 0,
              },
            ],
          ],
          needed: NEEDED,
        },).pairs,).toEqual([
        ],);
      },
    },),
  ],
},);
