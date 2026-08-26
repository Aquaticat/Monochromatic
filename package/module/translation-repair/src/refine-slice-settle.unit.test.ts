/**
 * Tests for the one rule of the naturalness lane's slice settler that nothing
 * else in the suite defends.
 *
 * WHY THIS FILE IS SHORT ON PURPOSE. `refine-phase.unit.test.ts` already drives
 * this function through the phase above it and proves the rules that matter
 * most: that a refinement losing a previously resolved issue rolls the whole
 * slice back to `T1`, that a rolled-back slice names no refiner, and that a
 * refinement-only change reaches the shipped text. Removing the rollback guard
 * fails two of those cases. Repeating them here would restate proven work.
 *
 * WHAT NOTHING DEFENDED, found by mutation rather than by reading: the
 * NON-TRANSLATION EARLY RETURN. Deleting it left the whole suite green.
 *
 * That return is what keeps a slice the critics ruled non-translation out of
 * the rewriter's hands. Such a slice shipped deliberately untouched, and asking
 * a model to make it read more naturally is asking it to undo that decision on
 * exactly the passages the pipeline was least willing to touch. Nothing
 * downstream would notice: the rewrite would arrive as an ordinary refinement,
 * pass the same guards every refinement passes, and ship.
 *
 * SO THE CASE IS A CLIENT THAT REFUSES TO BE CALLED. A slice standing as
 * non-translation must settle without reaching it. The control beside it flips
 * that one field and shows the same fixture DOES reach the client, so the null
 * result means "the early return held" rather than "this fixture was never
 * going to buy anything".
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkRepairOutcome,
  type RepairModels,
  type RosterModelId,
  settleRefinedSlice,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the settler under test.
 */
const l = tagged({ tag: 'refine-slice-settle-test', },);

/**
 * Repaired slice text, one long single-line paragraph so the lane finds it
 * eligible and would reach a rewriter.
 */
const REPAIRED_TEXT =
  'The cat is doing the sunbathing on the windowsill in every afternoon, and when the light is moving across the floor she is following it without any hurry at all.';

/**
 * Original this slice was repaired against.
 */
const SOURCE_TEXT = '猫猫每天下午都在窗台上晒太阳。';

/**
 * Message the refusing client throws with, so a case can tell its own refusal
 * apart from any other failure.
 */
const CLIENT_WAS_REACHED = 'the refusing client was asked for a completion';

/**
 * Model this lane hands a paragraph to for rewriting, named once so the roster
 * and the finding a case reads both spell the same id.
 */
const REFINER: RosterModelId = 'hf:zai-org/GLM-5.2';

/**
 * Refiner roster, one model so a lost voice leaves no quorum and the stage's
 * own account of what happened is unambiguous.
 */
const REFINERS: readonly RosterModelId[] = [REFINER,];

/**
 * Roster with the lane on and refiners disjoint from checkers, as production
 * runs it.
 */
const MODELS: RepairModels = {
  criticModelIds: ['hf:zai-org/GLM-5.2',],
  panelModelIds: ['hf:zai-org/GLM-5.2',],
  editorModelIds: ['hf:zai-org/GLM-5.2',],
  judgeModelIds: [
    'hf:zai-org/GLM-5.2',
    'hf:Qwen/Qwen3.8-27B',
    'hf:moonshotai/Kimi-K3',
  ],
  refinerModelIds: REFINERS,
  checkerModelIds: [
    'hf:Qwen/Qwen3.8-27B',
    'hf:moonshotai/Kimi-K3',
  ],
};

/**
 * Client that throws on any exchange, so reaching a model is observable.
 *
 * NOT A RECORDING CLIENT. A counter would say how many calls happened and
 * would let a case pass while quietly buying something; throwing makes the
 * first call end the settlement, which is what the assertion is about.
 */
const REFUSING_CLIENT: SyntheticClient = {
  chatText(): never {
    throw new Error(CLIENT_WAS_REACHED,);
  },
  chatJson(): never {
    throw new Error(CLIENT_WAS_REACHED,);
  },
  quotas(): never {
    throw new Error(CLIENT_WAS_REACHED,);
  },
};

/**
 * Builds one settled accuracy outcome, standing as a translation or not.
 *
 * @param nonTranslationStanding - whether the critics' non-translation ruling
 * survived contradiction, which is the one field these cases differ on
 *
 * @returns Outcome the lane would refine
 *
 * @example
 * ```ts
 * const outcome = settledOutcome({ nonTranslationStanding: true, },);
 * ```
 */
function settledOutcome(
  { nonTranslationStanding, }: { readonly nonTranslationStanding: boolean; },
): ChunkRepairOutcome {
  return {
    sliceIndex: 0,
    repairedText: REPAIRED_TEXT,
    changed: false,
    issues: [],
    resolvedIssueIds: [],
    candidateResolvedIssueIds: [],
    checkerReadings: {},
    recheckReadings: {},
    repairRegions: [],
    authorship: {
      perIssue: {},
      everyIssue: [],
    },
    accuracyPatchSelected: false,
    refined: false,
    rounds: [],
    droppedDeclaredNames: [],
    nonTranslationVotes: nonTranslationStanding ? 2 : 0,
    nonTranslationContradicted: false,
    nonTranslationStanding,
    heardCritics: 1,
    heardCriticIds: [],
    claimAttributions: [],
    findings: [],
  };
}

/**
 * Settles one slice against the refusing client.
 *
 * @param nonTranslationStanding - whether this slice stands as non-translation
 *
 * @returns What the lane settled on
 *
 * @example
 * ```ts
 * const settled = await settleWith({ nonTranslationStanding: true, },);
 * ```
 */
async function settleWith(
  { nonTranslationStanding, }: { readonly nonTranslationStanding: boolean; },
): Promise<Awaited<ReturnType<typeof settleRefinedSlice>>> {
  return await settleRefinedSlice({
    client: REFUSING_CLIENT,
    outcome: settledOutcome({ nonTranslationStanding, },),
    sourceText: SOURCE_TEXT,
    incumbentText: REPAIRED_TEXT,
    definitions: '',
    models: MODELS,
    refinerModelIds: REFINERS,
    declaredNames: [],
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: 1_000,
    l,
  },);
}

await describe({
  name: settleRefinedSlice.name,
  children: [
    it({
      name: 'BUYS NOTHING FOR A SLICE STANDING AS NON-TRANSLATION, against a '
        + 'client that throws on any exchange. Such a slice shipped '
        + 'deliberately untouched, and rewriting it for fluency would undo '
        + 'that decision on exactly the passages the pipeline was least '
        + 'willing to touch',
      fn: async () => {
        /**
         * Settlement of a slice the critics ruled non-translation.
         */
        const settled = await settleWith({ nonTranslationStanding: true, },);

        expect(settled.asked,).toBe(false,);
        expect(settled.refinedBy,).toEqual([],);
        expect(settled.refinersHeard,).toEqual([],);
        expect(settled.findings,).toEqual([],);
        expect(settled.outcome.repairedText,).toBe(REPAIRED_TEXT,);
      },
    },),

    it({
      name: 'REACHES THE CLIENT for the same slice once it no longer stands '
        + 'as non-translation, which is the control proving the case above '
        + 'reports a rule holding rather than a fixture that was never going '
        + 'to buy anything. The refiner stage catches the refusal and records '
        + 'it as a lost voice, so what the client saw is legible in the '
        + 'findings rather than in an exception',
      fn: async () => {
        /**
         * Settlement of the same slice with the ruling lifted.
         */
        const settled = await settleWith({ nonTranslationStanding: false, },);

        expect(settled.asked,).toBe(true,);
        expect(settled.findings,)
          .toContain(`stage-voice-lost (refiner ${REFINER})`,);
        expect(settled.refinedBy,).toEqual([],);
        // The one refiner's voice was lost, so nobody was heard either.
        expect(settled.refinersHeard,).toEqual([],);
      },
    },),
  ],
},);
