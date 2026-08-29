/**
 * Tests for the telemetry a chunk keeps when nothing about it changed.
 *
 * WHY THIS FILE EXISTS. Three exits in `repair-chunk.ts` ship a slice exactly
 * as it stood, and all three spread this one shape so a field added to the
 * contract cannot land on two of them and be forgotten on the third. The
 * critics were paid for on every one of those exits, and their votes, screen
 * and attributions are read later by calibration.
 *
 * WHY IT CALLS THE BUILDER DIRECTLY rather than driving `repairTranslation`.
 * Measured on 2026-08-25: mutating these carried fields left the lane`s own
 * cases green, because a run whose checkers refuse to confirm settles in
 * `repair-chunk.ts` instead and builds its own outcome. Reaching THIS builder
 * through the lane with a non-empty attribution list needs a scripted state
 * that work never found, and the fields it carries are worth pinning anyway:
 * a calibration reading zeroes cannot tell an unheard slice from a lost one.
 *
 * THE PHASE FIXTURE IS CAST, following `translate-lane-wordings.unit.test.ts`.
 * A faithful `ChunkCriticPhase` carries validated claims, and building one
 * would bury what this case is about under a claim model the function never
 * reads.
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

import {
  type ChunkCriticPhase,
  UNATTRIBUTED_TEXT,
  unchangedChunkOutcome,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Wording that ships, unchanged, on every exit this shape covers.
 */
const STANDING_TEXT = 'Mittens slept on the sill until noon.';

/**
 * Claim one critic raised twice and another once.
 */
const CLAIM_ID = 'issue/whiskers-counted-the-birds';

/**
 * Critic phase whose votes stood, so the slice ships as it stands while its
 * telemetry survives the exit.
 */
const CRITIC_PHASE = {
  claims: [{ claimId: CLAIM_ID, },],
  nonTranslationVotes: 2,
  contradicted: false,
  votesStand: true,
  heardCritics: 3,
  heardCriticIds: [
    'hf:Qwen/Qwen3.8-27B',
    'hf:moonshotai/Kimi-K3',
    'hf:zai-org/GLM-5.3-Flash',
  ],
  claimAttributions: [{
    claimId: CLAIM_ID,
    proposers: [
      {
        modelId: 'hf:Qwen/Qwen3.8-27B',
        emissionCount: 2,
      },
      {
        modelId: 'hf:zai-org/GLM-5.3-Flash',
        emissionCount: 1,
      },
    ],
  },],
  findings: ['critic-non-translation-vote',],
} as unknown as ChunkCriticPhase;

//endregion Fixtures

await describe({
  name: unchangedChunkOutcome.name,
  children: [
    it({
      name: 'CARRIES the votes, the screen and the attributions the critics were paid for, since a '
        + 'calibration reading zeroes here cannot tell a slice nobody spoke about from one whose '
        + 'critics all spoke and whose text simply stood',
      fn: async () => {
        /**
         * Outcome the three unchanged exits spread.
         */
        const outcome = unchangedChunkOutcome({
          sliceIndex: 4,
          targetText: STANDING_TEXT,
          critic: CRITIC_PHASE,
        },);

        expect(outcome.nonTranslationVotes,).toBe(2,);
        expect(outcome.nonTranslationContradicted,).toBe(false,);
        expect(outcome.nonTranslationStanding,).toBe(true,);
        expect(outcome.heardCritics,).toBe(3,);
        expect(outcome.heardCriticIds,).toEqual([
          'hf:Qwen/Qwen3.8-27B',
          'hf:moonshotai/Kimi-K3',
          'hf:zai-org/GLM-5.3-Flash',
        ],);
        expect(outcome.claimAttributions,).toEqual([{
          claimId: CLAIM_ID,
          proposers: [
            {
              modelId: 'hf:Qwen/Qwen3.8-27B',
              emissionCount: 2,
            },
            {
              modelId: 'hf:zai-org/GLM-5.3-Flash',
              emissionCount: 1,
            },
          ],
        },],);
      },
    },),
    it({
      name: 'SAYS nobody wrote the text and no checker read it, because nothing was repaired on any '
        + 'exit that spreads this shape, and an authorship entry here would let a checker certify its '
        + 'own work on text it never touched',
      fn: async () => {
        /**
         * Same outcome, read for what it denies rather than what it carries.
         */
        const outcome = unchangedChunkOutcome({
          sliceIndex: 4,
          targetText: STANDING_TEXT,
          critic: CRITIC_PHASE,
        },);

        expect(outcome.repairedText,).toBe(STANDING_TEXT,);
        expect(outcome.changed,).toBe(false,);
        expect(outcome.authorship,).toEqual(UNATTRIBUTED_TEXT,);
        expect(outcome.checkerReadings,).toEqual({},);
        expect(outcome.recheckReadings,).toEqual({},);
        expect(outcome.resolvedIssueIds,).toEqual([],);
        expect(outcome.candidateResolvedIssueIds,).toEqual([],);
        expect(outcome.repairRegions,).toEqual([],);
        expect(outcome.rounds,).toEqual([],);
        expect(outcome.refined,).toBe(false,);
        expect(outcome.accuracyPatchSelected,).toBe(false,);
        expect(outcome.droppedDeclaredNames,).toEqual([],);
      },
    },),
  ],
},);
