/**
 Tests for the Claude card sides themselves: the eight rows keyed by roster id, the two price tables and the
 fields every row shares. How the rows seat, price and lock is held by `claude-cards.unit.test.ts` through the
 assembled cards; this file holds the module's own exports.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ANTHROPIC_SERVED_IDS,
  CLAUDE_CARDS,
  HAIKU_5_5_PRICES,
  SONNET_5_5_PRICES,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'claude card sides',
  children: [
    it({
      name: 'KEYS the eight rows by the eight roster spellings, in the order the spellings are listed',
      fn: async () => {
        expect(Object.keys(CLAUDE_CARDS,),).toEqual([...ANTHROPIC_SERVED_IDS,],);
      },
    },),

    it({
      name: 'GIVES EVERY ROW the shared fields: it reads images, states the 128,000-token output ceiling, and caps its '
        + 'completion at the pooled p99',
      fn: async () => {
        for (const id of ANTHROPIC_SERVED_IDS) {
          const card = CLAUDE_CARDS[id];
          expect(card.anthropic?.readsImages,).toBe(true,);
          expect(card.anthropic?.maxOutputLength,).toBe(128_000,);
          expect(card.completionCap,).toBe('pooled-p99',);
        }
      },
    },),

    it({
      name: 'TIES each row to the price table of its model, the same on every effort card of one model',
      fn: async () => {
        for (const id of ANTHROPIC_SERVED_IDS) {
          expect(CLAUDE_CARDS[id].anthropic?.prices,).toBe(
            id.startsWith('claude-sonnet',) ? SONNET_5_5_PRICES : HAIKU_5_5_PRICES,
          );
        }
      },
    },),

    it({
      name: 'HOLDS BACK ONLY SONNET\'S AND THE EFFORT CARDS\' JUDGING: Haiku with no effort keeps the judge seats and '
        + 'drops the late rounds, and the other seven carry the judge hold',
      fn: async () => {
        expect(CLAUDE_CARDS['claude-haiku-5-5'].holds,).toContain('late-judge-dropped',);
        expect(CLAUDE_CARDS['claude-haiku-5-5'].holds,).not.toContain('judge-unmeasured',);
        for (const id of ANTHROPIC_SERVED_IDS.filter(function notHaiku(candidate,): boolean {
          return candidate !== 'claude-haiku-5-5';
        },))
          expect(CLAUDE_CARDS[id].holds,).toContain('judge-unmeasured',);
      },
    },),
  ],
},);
