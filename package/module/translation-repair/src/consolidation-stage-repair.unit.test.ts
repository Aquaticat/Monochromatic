/**
 * Tests final-selection recovery state and provider-identity anonymization.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  consolidationFailureEvidence,
  consolidationNeedsRecovery,
  type ConsolidationSettlement,
} from '../dist/final/node/index.mjs';

/** Provider identity that must never enter recovery producer prompt. */
const MODEL_ID = 'hf:zai-org/GLM-5.3-Flash';

/**
 * Builds failed settlement with attributed slate and ballots.
 *
 * @returns Unsafe standing settlement carrying model identity in every free-form field
 */
function failedSettlement(): ConsolidationSettlement {
  return {
    terminal: 'gate-kept-standing',
    text: 'The archive says the cat sleeps.',
    floor: {
      kind: 'proposals',
      validModelIds: [MODEL_ID,],
    },
    verdicts: [],
    decided: {
      text: 'The cat sleeps.',
      origin: 'fresh',
      producer: { kind: 'model', modelId: MODEL_ID, },
      decision: 'judged',
      voteWeight: 1 / 2,
      tally: {
        judgesAvailable: 1,
        ballots: 1,
        abstentions: 0,
        selfVotes: 1,
      },
      ballots: [{
        modelId: MODEL_ID,
        best: 1,
        reason: `${MODEL_ID} preferred its own wording`,
        weight: 1 / 2,
        selfVote: true,
      },],
      heardTranslators: 1,
      candidateCount: 1,
      findings: [],
      slate: [{
        index: 1,
        text: `The cat sleeps, according to ${MODEL_ID}.`,
        hash: 'sha256:fixture',
        origin: 'fresh',
        producer: { kind: 'model', modelId: MODEL_ID, },
      },],
      selectedIndex: 1,
      shippedIndex: 1,
      perCandidate: [],
    },
    gate: {
      choice: 'standing',
      ships: 'standing',
      ballots: [{
        choice: 'standing',
        unsupported: [],
        unsupportedRaw: [`${MODEL_ID} unsupported detail`,],
        dropped: [],
        droppedRaw: [],
        reason: `${MODEL_ID} kept standing`,
      },],
      usable: 1,
      findings: [],
    },
    rewrapped: false,
    demoted: false,
    findings: [`${MODEL_ID} settlement failed`,],
  } as unknown as ConsolidationSettlement;
}

await describe({
  name: 'consolidation stage repair',
  children: [
    it({
      name: 'REQUIRES recovery exactly when unsafe standing remains unconsolidated',
      fn: async () => {
        const settlement = failedSettlement();
        expect(consolidationNeedsRecovery({
          settlement,
          standingMayShip: false,
        },),).toBe(true,);
        expect(consolidationNeedsRecovery({
          settlement,
          standingMayShip: true,
        },),).toBe(false,);
        expect(consolidationNeedsRecovery({
          settlement: { ...settlement, terminal: 'consolidated', },
          standingMayShip: false,
        },),).toBe(false,);
      },
    },),
    it({
      name: 'ALIASES producer and judge identity across slate, ballots, gate reasons, and findings',
      fn: async () => {
        const evidence = consolidationFailureEvidence({ settlement: failedSettlement(), });
        const serialized = JSON.stringify(evidence,);

        expect(serialized.includes(MODEL_ID,),).toBe(false,);
        expect(serialized,).toContain('role/1');
        expect(evidence.selectionSlate[0]?.producer,).toEqual({
          kind: 'model',
          alias: 'role/1',
        },);
        expect(evidence.selectionBallots[0]?.judgeAlias,).toBe('role/1');
        expect(evidence.selectionBallots[0]?.selfVote,).toBe(true,);
        expect(evidence.gateBallots[0]?.reason,).toContain('role/1');
      },
    },),
  ],
},);
