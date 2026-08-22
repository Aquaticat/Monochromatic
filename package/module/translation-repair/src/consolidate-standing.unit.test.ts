/**
 * Tests for what would ship at a contested slice without the consolidation.
 *
 * WHAT THIS PINS is the decline case, which is the one with consequences. A
 * rule that picked a lane on a decline would hand the consolidation's slate a
 * candidate no panel chose, and the whole stage would then be deciding between
 * a fresh rendering and an arbitrary one.
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

import { standingTextFor, } from '../dist/final/node/index.mjs';

/**
 * What the repair lane would ship.
 */
const REPAIR = 'The cat fell asleep by the window.';

/**
 * What the translate lane would ship.
 */
const TRANSLATE = 'The cat had fallen asleep beside the window.';

await describe({
  name: standingTextFor.name,
  children: [
    it({
      name: 'NAMES THE REPAIR LANE when the contest chose it',
      fn: async () => {
        expect(
          standingTextFor({ choice: 'repair', repairText: REPAIR, translateText: TRANSLATE, },),
        ).toBe(REPAIR,);
      },
    },),

    it({
      name: 'NAMES THE TRANSLATE LANE when the contest chose it',
      fn: async () => {
        expect(
          standingTextFor({ choice: 'translate', repairText: REPAIR, translateText: TRANSLATE, },),
        ).toBe(TRANSLATE,);
      },
    },),

    it({
      name: 'LEAVES NOTHING STANDING ON A DECLINE rather than picking a side, because a lane the '
        + 'judges did not choose is not what would ship, and offering it as the incumbent would make '
        + 'the consolidation beat an arbitrary rendering instead of a decided one',
      fn: async () => {
        expect(
          standingTextFor({ choice: 'neither', repairText: REPAIR, translateText: TRANSLATE, },),
        ).toBe('',);
      },
    },),
  ],
},);
