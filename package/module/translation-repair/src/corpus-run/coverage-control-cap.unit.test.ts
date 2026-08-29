/**
 * Tests that the coverage control STOPS AFTER ITS THIRD USABLE CASE.
 *
 * WHAT THE CONTROL BUYS. Each case it takes costs three rounds of the whole
 * roster: the passage as it stands, the passage with its rendering cut out, and
 * an equally large cut taken somewhere else as a decoy. Three cases is the
 * declared size of the control, and the cap is what keeps a caller handing it a
 * long list from paying for the whole list.
 *
 * WHAT WAS MEASURED. On 2026-08-25, the cap failed no test in this package.
 * Nothing throws when it is wrong and nothing looks broken; the control simply
 * spends more than it said it would, and the majority it reports is taken over
 * a different denominator than the one its own rules describe.
 *
 * COUNTED ON ROWS, NOT ON CASES, which is the part worth pinning. A case the
 * wire already declines to call covered is reported as a refusal and does NOT
 * count against the cap, because it never had its rendering damaged and so
 * showed nothing about whether damage is noticed. Five cases go in here and all
 * five are damageable, so the rows are the cap exactly.
 *
 * NO NETWORK. One scripted answer serves every round: full coverage, quoting a
 * sentence that really is in the translation, which is what makes the standing
 * verdict `carried` and its evidence locatable.
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
const l = tagged({ tag: 'coverage-control-cap-test', },);

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
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * Names of the five cases handed in, in the order they are offered.
 */
const WHERE = [
  'slice-0',
  'slice-1',
  'slice-2',
  'slice-3',
  'slice-4',
] as const;

/**
 * Five identical damageable cases, distinguished only by where they sit.
 */
const CASES: readonly CoverageControlCase[] = WHERE.map(function caseAt(where,): CoverageControlCase {
  return {
    where,
    sourcePassage: SOURCE_PASSAGE,
    translation: parseDocument({ text: TRANSLATION, },),
  };
},);

/**
 * Client answering every coverage round with full coverage and a real quote.
 */
const CLIENT: SyntheticClient = {
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
      name: 'TAKES THREE CASES AND STOPS, since each one it takes costs three rounds of the whole '
        + 'roster and the majority it reports is taken over the rows it actually damaged',
      fn: async () => {
        /**
         * What the control made of five damageable cases.
         */
        const control = await coverageControlHolds({
          client: CLIENT,
          cases: CASES,
          modelIds: [...MODEL_IDS,],
          signal: AbortSignal.timeout(120_000,),
          exchangeTimeoutMs: 30_000,
          l,
        },);

        expect(control.rows
          .map(function toWhere(row,): string {
            return row.where;
          },),).toStrictEqual([
          'slice-0',
          'slice-1',
          'slice-2',
        ],);

        // Every case here is damageable, so nothing was set aside as a refusal
        // and the rows ARE the cap rather than whatever survived a filter.
        expect(control.refusals,).toStrictEqual([],);
      },
    },),
  ],
},);
