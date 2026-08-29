/**
 * Tests for layering the naturalness lane's rewriters onto the authorship the
 * editor stage already established.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  collectRefinedAuthors,
  type RosterModelId,
} from '../dist/final/node/index.mjs';

/**
 * Issue the cases below credit.
 */
const WHISKER = 'adjudicated/whisker';

/**
 * Model that repaired the text the refiners rewrote.
 */
const AUTHOR: RosterModelId = 'hf:zai-org/GLM-5.3-Flash';

/**
 * Second repairing model, for the case where nothing was rewritten at all.
 */
const HELPER: RosterModelId = 'hf:Qwen/Qwen3.8-27B';

/**
 * Model that only ever rewrites, never repairs.
 */
const REFINER: RosterModelId = 'hf:openai/gpt-oss-120b';

await describe({
  name: collectRefinedAuthors.name,
  children: [
    it({
      name: 'ADDS THE REFINERS TO THE EDITOR\'S ANSWER rather than replacing it, because refined '
        + 'text is the editor\'s repair rewritten and a checker that had a hand in either half is '
        + 'judging its own work',
      fn: async function bothStagesAreNamed() {
        expect(collectRefinedAuthors({
          editorAuthorship: {
            perIssue: { [WHISKER]: [AUTHOR,], },
            everyIssue: [],
          },
          refineContributors: [REFINER,],
        },),).toEqual({
          perIssue: { [WHISKER]: [AUTHOR,], },
          everyIssue: [REFINER,],
        },);
      },
    },),

    it({
      name: 'LEAVES THE EDITOR\'S ANSWER EXACTLY AS IT WAS when no refinement won, since the text '
        + 'that ships is then precisely what the editor produced',
      fn: async function aLostRefinementAddsNobody() {
        expect(collectRefinedAuthors({
          editorAuthorship: {
            perIssue: { [WHISKER]: [AUTHOR,], },
            everyIssue: [HELPER,],
          },
          refineContributors: [],
        },),).toEqual({
          perIssue: { [WHISKER]: [AUTHOR,], },
          everyIssue: [HELPER,],
        },);
      },
    },),

    it({
      name: 'NAMES A MODEL ONCE when it both wrote the repair and refined it, so the discount is '
        + 'a half rather than a quarter',
      fn: async function oneModelInBothStagesIsNamedOnce() {
        expect(collectRefinedAuthors({
          editorAuthorship: {
            perIssue: {},
            everyIssue: [AUTHOR,],
          },
          refineContributors: [
            AUTHOR,
            REFINER,
          ],
        },),).toEqual({
          perIssue: {},
          everyIssue: [
            AUTHOR,
            REFINER,
          ],
        },);
      },
    },),
  ],
},);
