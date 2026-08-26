/**
 * Tests that the coverage control counts a case ONLY WHEN THE VOTE MOVED.
 *
 * WHAT THE CONTROL IS FOR. It exists to answer one question: can this wire vote
 * absence at all? A roster that answers `full` to the undamaged passage and
 * `full` again once the rendering it pointed at has been deleted has shown
 * exactly nothing, and that is the reading the whole gate was built to refuse.
 *
 * WHAT WAS MEASURED. On 2026-08-25, relaxing the comparison that counts a case
 * from `absentAfter > absentBefore` to `absentAfter >= absentBefore` failed no
 * test in this package. Under that relaxation every damaged case counts as a
 * case where the wire noticed, including one whose votes never moved, so a wire
 * that cannot see damage reports a HELD control and licenses the null it was
 * supposed to invalidate.
 *
 * COUNTED ON VOTES, NOT ON THE VERDICT KIND, which is what the field's own
 * documentation says: the recorded null is about ballots rather than about how
 * they were rolled up.
 *
 * NO NETWORK. One scripted answer serves every round: full coverage, quoting a
 * sentence really present, so the standing verdict carries, its evidence can be
 * located and cut, and the answer after the cut is identical to the answer
 * before it. That is a wire blind to damage, spelled out.
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
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type CoverageControlCase,
  coverageControlHolds,
  parseDocument,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

/**
 * Logger for the control under test.
 */
const l = tagged({ tag: 'coverage-control-vote-change-test', },);

//region Fixtures

/**
 * Sentence every scripted judge quotes, verbatim from the translation below, so
 * the standing verdict carries and its evidence can be located and cut.
 */
const QUOTED = 'Whiskers counts the birds outside.';

/**
 * Translation the cases ask about, long enough on both sides of the quoted
 * sentence that an equally large decoy cut has somewhere to go.
 */
const TRANSLATION = `The kitten dozes on the windowsill in the afternoon sun. ${QUOTED} `
  + 'The tabby sleeps by the radiator until evening.';

/**
 * Original passage the cases ask about.
 */
const SOURCE_PASSAGE = '白胡子数着外面的鸟。';

/**
 * Roster asked at every round.
 */
const MODEL_IDS = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * Three damageable cases, distinguished only by where they sit.
 */
const CASES: readonly CoverageControlCase[] = [
  'slice-0',
  'slice-1',
  'slice-2',
].map(function caseAt(where,): CoverageControlCase {
  return {
    where,
    sourcePassage: SOURCE_PASSAGE,
    translation: parseDocument({ text: TRANSLATION, },),
  };
},);

/**
 * Client answering EVERY round the same way, damaged or not: a wire whose votes
 * do not move is the one the control has to refuse.
 */
const BLIND_CLIENT: SyntheticClient = {
  chatText: async () => {
    throw new Error('chatText unused by the coverage control',);
  },
  chatJson: async <ValueT,>(
    request: ChatJsonRequest<ValueT>,
  ): Promise<ChatJsonOutcome<ValueT>> => {
    /**
     * Stage name from the structured-output constraint.
     */
    const stage = request.responseFormat
      ?.json_schema
      .name
      ?? '';
    if (stage !== 'coverage_report')
      throw new Error(`the coverage control asks about coverage and nothing else, and this asked ${stage}`,);

    /**
     * Reply claiming the passage is carried, quoting text really present.
     */
    const scripted: unknown = {
      coverage: 'full',
      quote: QUOTED,
      reason: 'fixture',
    };
    if (!request.validate(scripted,))
      throw new Error('scripted reply failed the coverage guard',);
    return {
      kind: 'ok',
      value: scripted,
      rawText: JSON.stringify(scripted,),
    };
  },
  quotas: async () => {
    throw new Error('quotas unused by the coverage control',);
  },
};

//endregion Fixtures

await describe({
  name: coverageControlHolds.name,
  children: [
    it({
      name: 'REFUSES to hold when deleting the rendering changed no vote, which is the reading the '
        + 'gate exists to invalidate: a wire answering the same way to the damaged page as to the '
        + 'undamaged one has shown the absence vote unreachable, not the passage covered',
      fn: async () => {
        /**
         * What the control made of a roster whose votes never move.
         */
        const control = await coverageControlHolds({
          client: BLIND_CLIENT,
          cases: CASES,
          modelIds: [...MODEL_IDS,],
          signal: AbortSignal.timeout(120_000,),
          exchangeTimeoutMs: 30_000,
          l,
        },);

        // Every case was damageable, so all three reached the after round and
        // the count below is taken over three rows rather than over none.
        expect(control.rows,).toHaveLength(3,);
        expect(control.refusals,).toStrictEqual([],);

        // The vote is identical before and after. Nothing moved, so nothing was
        // noticed, and a count of three here would mean the control credits a
        // wire for answering at all rather than for answering differently.
        expect(control.sawAbsenceOnTarget,).toBe(0,);
        expect(control.held,).toBe(false,);
      },
    },),
  ],
},);
