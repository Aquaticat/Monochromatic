/**
 Guards class one hundred eighty-two (TianqiChen66614, 2026-09-27): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), 柜门炸开, the closet door blown open, joins
 the community glossary beside 炸柜. The page shipped "blocked again and again,
 each time the closet door blew open", a literal figure that also turned the
 source's cause (因为) into a repeated event, while the glossary's 炸柜 entry,
 which says outed, never matched the spread-out spelling.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  COMMUNITY_GLOSSARY,
  communityTermsIn,
} from '../dist/final/node/index.mjs';

/**
 Original in which the cat's plans stall because its closet door was blown open.
 */
const STALLED = '猫藏在心底的计划因为柜门炸开屡屡受阻。';

await describe({
  name: 'the spread-out closet word the community glossary renders (class one hundred eighty-two)',
  children: [
    it({
      name: 'SEEDS 柜门炸开 with "outed" first',
      fn: async () => {
        expect(COMMUNITY_GLOSSARY.find(function isTerm(entry,): boolean {
          return entry.term === '柜门炸开';
        },)?.renderings[0],).toBe('outed',);
      },
    },),
    it({
      name: 'FINDS 柜门炸开 in an original that spreads the word out',
      fn: async () => {
        expect(communityTermsIn({ text: STALLED, },).map(function termOf(entry,): string {
          return entry.term;
        },),).toContain('柜门炸开',);
      },
    },),
  ],
},);
