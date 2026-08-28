/**
 * Tests syntax-bearing lane winner publication eligibility.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  laneContestChoiceMayShip,
  type LaneContestOutcome,
} from '../dist/final/node/index.mjs';

/**
 * Source identity repeated as visible name and alias.
 */
const SOURCE = '---\nname: 猫猫\ninfo:\n  alias: 猫猫\n---\n';

/**
 * Archive retaining entry id beside translated alias.
 */
const ARCHIVE = '---\nname: CatEntry\ninfo:\n  alias: Maomao\n---\n';

/**
 * Syntax-valid translated identity.
 */
const TRANSLATED = '---\nname: Maomao\ninfo:\n  alias: Maomao\n---\n';

/**
 * Builds contest outcome with chosen lane.
 *
 * @param choice - lane panel selected
 *
 * @returns Quorum-complete synthetic outcome
 *
 * @example
 * ```ts
 * const outcome = outcomeFor({ choice: 'repair', });
 * ```
 */
function outcomeFor(
  { choice, }: { readonly choice: LaneContestOutcome['choice']; },
): LaneContestOutcome {
  return {
    choice,
    ballots: [],
    usable: 2,
    findings: [],
  };
}

await describe({
  name: laneContestChoiceMayShip.name,
  children: [
    it({
      name: 'REFUSES FRONT MATTER winner retaining directory id',
      fn: async () => {
        expect(laneContestChoiceMayShip({
          outcome: outcomeFor({ choice: 'repair', },),
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
          syntax: 'front-matter',
        },),).toBe(false,);
      },
    },),

    it({
      name: 'ACCEPTS FRONT MATTER winner preserving source identity relation',
      fn: async () => {
        expect(laneContestChoiceMayShip({
          outcome: outcomeFor({ choice: 'translate', },),
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
          syntax: 'front-matter',
        },),).toBe(true,);
      },
    },),

    it({
      name: 'LEAVES ORDINARY PROSE AND DECLINED CONTEST outside syntax rejection',
      fn: async () => {
        expect(laneContestChoiceMayShip({
          outcome: outcomeFor({ choice: 'repair', },),
          sourceText: '猫。',
          incumbentText: 'Cat.',
          repairText: 'Cat.',
          translateText: 'A cat.',
        },),).toBe(true,);
        expect(laneContestChoiceMayShip({
          outcome: outcomeFor({ choice: 'neither', },),
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
          syntax: 'front-matter',
        },),).toBe(true,);
      },
    },),
  ],
},);
