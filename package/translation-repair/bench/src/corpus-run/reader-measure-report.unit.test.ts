/**
 Tests the report `reader-measure` prints.

 WHAT THE REPORT OWES THE PERSON WHO RAN IT with a key: the model and route
 measured, how many pictures were matched and how many readings the candidate
 produced, the seated band it was held to, a verdict on each clause, and the
 one edit that follows from a pass (removing the hold from the model's card),
 so the next step is never a question. A candidate that produced too few
 readings is reported as not measured rather than as failing.

 Fixtures are cat-themed invention. No provider is reached.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  MINIMUM_PRODUCED_READINGS,
  renderMeasureReport,
} from '../../dist/final/node/index.mjs';

/**
 Band every case reports against.
 */
const BAND = {
  floorCorroboratedByAll: 0.8,
  ceilingCorroboratedByNone: 0.1,
  readings: 20,
};

/**
 Rates of a candidate that met both clauses.
 */
const GOOD = {
  produced: MINIMUM_PRODUCED_READINGS,
  corroboratedByAll: 0.9,
  corroboratedByNone: 0,
  meanOverlap: 0.7,
};

await describe({
  name: renderMeasureReport.name,
  children: [
    it({
      name: 'SAYS WHAT WAS MEASURED, THE BAND, THE RATES AND THE EDIT A PASS CALLS FOR',
      fn: async () => {
        await Promise.resolve();
        const text = renderMeasureReport({
          modelId: 'gemma-4-26b-a4b-it',
          matched: 9,
          band: BAND,
          candidate: GOOD,
          verdict: { kind: 'meets-both-clauses', },
        },).join('\n',);
        expect(text,).toContain('gemma-4-26b-a4b-it',);
        expect(text,).toContain('9 pictures matched',);
        expect(text,).toContain('seated floor 0.80',);
        expect(text,).toContain('seated ceiling 0.10',);
        expect(text,).toContain('both clauses met',);
        expect(text,).toContain('openrouter-pictures-unmeasured',);
      },
    },),

    it({
      name: 'NAMES EACH CLAUSE THAT FAILED AND CALLS FOR NO EDIT',
      fn: async () => {
        await Promise.resolve();
        const text = renderMeasureReport({
          modelId: 'gemma-4-26b-a4b-it',
          matched: 9,
          band: BAND,
          candidate: GOOD,
          verdict: { kind: 'fails-clauses', clauses: ['second',], },
        },).join('\n',);
        expect(text,).toContain('second clause failed',);
        expect(text,).not.toContain('first clause failed',);
        expect(text,).toContain('keep the hold',);
      },
    },),

    it({
      name: 'REPORTS TOO FEW PRODUCED READINGS AS NOT MEASURED, naming how many were produced and how many a verdict needs',
      fn: async () => {
        await Promise.resolve();
        const text = renderMeasureReport({
          modelId: 'gemma-4-26b-a4b-it',
          matched: 9,
          band: BAND,
          candidate: {
            ...GOOD,
            produced: 2,
          },
          verdict: { kind: 'inconclusive', produced: 2, },
        },).join('\n',);
        expect(text,).toContain('not measured',);
        expect(text,).toContain(`2 of the ${String(MINIMUM_PRODUCED_READINGS,)}`,);
      },
    },),
  ],
},);
