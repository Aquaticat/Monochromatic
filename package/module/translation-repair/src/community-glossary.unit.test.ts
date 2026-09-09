/**
 * Tests for the community glossary: the terms an entry carries reach the
 * identity context, and a candidate lacking every accepted rendering is named
 * on the sheet as evidence, in any casing, with an empty candidate skipped
 * (owner, 2026-09-09).
 *
 * Fixtures quote the two seeded terms and cat-themed invention otherwise.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  COMMUNITY_GLOSSARY,
  communityRenderingDepartures,
  communityRenderingsBlock,
  communityTermLines,
  communityTermsIn,
} from '../dist/final/node/index.mjs';

/**
 * Original carrying one seeded term.
 */
const SOURCE = '在她自切后，家人的态度好转很多。';

/**
 * Rendering that carries the community's word.
 */
const KEPT = 'After she attempted self-surgery, her family became more accepting.';

/**
 * Rendering that lost it, as the seventh yuki page shipped.
 */
const LOST = 'After she began cutting herself, her family became more accepting.';

await describe({
  name: communityTermsIn.name,
  children: [
    it({
      name: 'SEEDS THE TWO TERMS the archive had right and two pages lost, each with the archive\'s rendering first',
      fn: async () => {
        expect(COMMUNITY_GLOSSARY.map(function termOf(entry,): string {
          return entry.term;
        },),).toEqual(['自切', '超天酱',],);
        expect(COMMUNITY_GLOSSARY[0]?.renderings[0],).toBe('self-surgery',);
        expect(COMMUNITY_GLOSSARY[1]?.renderings[0],).toBe('KAngel',);
      },
    },),

    it({
      name: 'FINDS THE TERMS A TEXT CARRIES and nothing for a text carrying none',
      fn: async () => {
        expect(communityTermsIn({ text: SOURCE, },).map(function termOf(entry,): string {
          return entry.term;
        },),).toEqual(['自切',],);
        expect(communityTermsIn({ text: '猫在窗台上睡觉。', },),).toEqual([],);
      },
    },),

    it({
      name: 'RENDERS THE IDENTITY-CONTEXT LINES for the terms present, with the renderings and the why, '
        + 'and no heading for an entry carrying none',
      fn: async () => {
        /** Lines for the seeded source. */
        const lines = communityTermLines({ text: SOURCE, },);
        expect(lines[0],).toContain('COMMUNITY TERMS',);
        expect(lines[1],).toContain('- 自切: "self-surgery" (',);
        expect(lines,).toHaveLength(2,);
        expect(communityTermLines({ text: '猫在窗台上睡觉。', },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: communityRenderingDepartures.name,
  children: [
    it({
      name: 'NAMES THE CANDIDATE LACKING EVERY RENDERING where the source carries the term, in any '
        + 'casing, and leaves the one carrying it unnamed',
      fn: async () => {
        /** Departures over one kept and one lost rendering, the kept one in capitals. */
        const departures = communityRenderingDepartures({
          sourceText: SOURCE,
          candidates: [
            {
              label: 'CANDIDATE 1',
              text: KEPT.toUpperCase(),
            },
            {
              label: 'CANDIDATE 2',
              text: LOST,
            },
          ],
        },);
        expect(departures,).toEqual([
          'CANDIDATE 2 carries none of the community\'s renderings of 自切 ("self-surgery"); the archive renders it so',
        ],);
      },
    },),

    it({
      name: 'NAMES NOTHING where the source carries no term, and skips an empty candidate, which is an '
        + 'absent archive rendering rather than a departure',
      fn: async () => {
        expect(communityRenderingDepartures({
          sourceText: '猫在窗台上睡觉。',
          candidates: [{
            label: 'CANDIDATE 1',
            text: LOST,
          },],
        },),).toEqual([],);
        expect(communityRenderingDepartures({
          sourceText: SOURCE,
          candidates: [{
            label: 'ARCHIVE RENDERING',
            text: '',
          },],
        },),).toEqual([],);
      },
    },),

    it({
      name: 'WRAPS THE DEPARTURES IN A SHEET BLOCK headed as evidence to weigh, with the inflection '
        + 'note, and yields nothing where no candidate departs',
      fn: async () => {
        /** Block over the lost rendering. */
        const block = communityRenderingsBlock({
          sourceText: SOURCE,
          candidates: [{
            label: 'CANDIDATE "translate"',
            text: LOST,
          },],
        },);
        expect(block[0],).toBe('COMMUNITY RENDERINGS, evidence to weigh, not a verdict:',);
        expect(block[1],).toContain('- CANDIDATE "translate" carries none',);
        expect(block.at(-1,),).toBe('',);
        expect(communityRenderingsBlock({
          sourceText: SOURCE,
          candidates: [{
            label: 'CANDIDATE "translate"',
            text: KEPT,
          },],
        },),).toEqual([],);
      },
    },),
  ],
},);
