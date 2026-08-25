/**
 * Tests that the width probe REFUSES a slice its critics filed nothing about.
 *
 * WHY THIS MATTERS. The probe compares editor rosters on real work, and it buys
 * a panel round per slice it carries forward. A slice nobody filed a claim
 * about has no work in it, so carrying it forward would put a panel round on
 * the bill and then compare two rosters on nothing. On 2026-08-25, inverting
 * this guard so an EMPTY claim list is the one that proceeds failed no test in
 * this package.
 *
 * READ OFF THE OUTCOME, not off a call count. The refusal is a named value the
 * probe's rows print, and a reader of those rows has to be able to tell a slice
 * with no work from a slice the probe never reached.
 *
 * NO NETWORK. The client answers every critic with a report naming nothing and
 * refuses every other stage by name, so a guard that let the empty list through
 * would be caught reaching for the panel round it has no business buying.
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
  type BenchSlice,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  gatherWidthInput,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

/**
 * Logger for the probe under test.
 */
const l = tagged({ tag: 'editor-width-input-test', },);

//region Fixtures

/**
 * Slice drawn for the bench, with a translation already in the archive.
 */
const SLICE: BenchSlice = {
  entryId: 'mittens-window',
  index: 4,
  sourceText: '小猫在窗台上打盹。',
  incumbentText: 'The kitten dozes on the windowsill.',
  lineStructured: false,
};

/**
 * Stage the panel would ask for, named here so the refusal says which round the
 * probe reached for rather than reporting an anonymous failure.
 */
const PANEL_STAGE = 'panel';

/**
 * Client answering every critic with a report naming nothing.
 */
const CLIENT: SyntheticClient = {
  chatText: async () => {
    throw new Error('chatText unused while gathering width probe input',);
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
    if (stage !== 'critic_report') {
      throw new Error(
        `a slice with no claims must buy nothing beyond its critics, and this asked ${stage} `
          + `(the ${PANEL_STAGE} round is the one this guard exists to skip)`,
      );
    }

    /**
     * Report naming nothing, which is what leaves the slice with no work.
     */
    const scripted: unknown = { issues: [], };
    if (!request.validate(scripted,))
      throw new Error('scripted report failed the critic guard',);
    return {
      kind: 'ok',
      value: scripted,
      rawText: JSON.stringify(scripted,),
    };
  },
  quotas: async () => {
    throw new Error('quotas unused while gathering width probe input',);
  },
};

//endregion Fixtures

await describe({
  name: gatherWidthInput.name,
  children: [
    it({
      name: 'SKIPS a slice its critics filed nothing about, naming both the refusal and the slice, '
        + 'since a bench that carried it forward would buy a panel round over nothing and then '
        + 'compare two rosters on it',
      fn: async () => {
        /**
         * What the probe made of a slice with no work in it.
         */
        const outcome = await gatherWidthInput({
          client: CLIENT,
          slice: SLICE,
          signal: AbortSignal.timeout(120_000,),
          l,
        },);

        if (outcome.kind !== 'skipped')
          throw new Error('a slice whose critics filed nothing must be skipped, not carried forward',);

        expect(outcome.refusal,).toBe('no-claims',);
        expect(outcome.entryId,).toBe('mittens-window',);
        expect(outcome.sliceIndex,).toBe(4,);
      },
    },),
  ],
},);
