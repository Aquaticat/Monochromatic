/**
 * Tests for the last source-coverage guard before a corpus page is published.
 *
 * A live `Toka_ls` run recorded one source-only factual paragraph as unfilled,
 * then published a page omitting its death date, time, cause, age and source
 * link. These fixtures keep the corpus wording out while pinning that exact
 * semantic failure: known missing source content cannot become a settled page.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertPublishableTranslation,
  UnfilledPageError,
  unfilledPageFindings,
} from '../../dist/final/node/index.mjs';

await describe({
  name: unfilledPageFindings.name,
  children: [
    it({
      name: 'RECORDS each unfilled passage as a gap the page ships without, naming the slice and the '
        + 'reason (the no-loop design of 2026-09-01; XIEPT2 was dropped after 35 minutes on 2026-09-02 '
        + 'by the refusal below over one passage two judge rounds could not back), and records nothing '
        + 'for a complete page',
      fn: async () => {
        expect(unfilledPageFindings({
          unfilled: [
            {
              sliceIndex: 15,
              reason: 'no-candidate-backed',
              findings: [],
            },
            {
              sliceIndex: 13,
              reason: 'not-corroborated',
              findings: ['a stage finding',],
            },
          ],
        },),).toEqual([
          'source-passage-unfilled (slice 15, no-candidate-backed): the page ships without this passage, recorded as a gap',
          'source-passage-unfilled (slice 13, not-corroborated): the page ships without this passage, recorded as a gap',
        ],);
        expect(unfilledPageFindings({ unfilled: [], },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: assertPublishableTranslation.name,
  children: [
    it({
      name: 'ACCEPTS a translation that left no source passage unfilled',
      fn: async () => {
        expect(function acceptCompletePage() {
          assertPublishableTranslation({
            entryId: 'CatComplete',
            unfilled: [],
          },);
        },).not.toThrow();
      },
    },),
    it({
      name: 'REFUSES publication when a linked factual source paragraph remains unfilled, '
        + 'rather than calling a page settled while known content is absent',
      fn: async () => {
        let caught: unknown;
        try {
          assertPublishableTranslation({
            entryId: 'CatMissingFacts',
            unfilled: [{
              sliceIndex: 13,
              reason: 'not-corroborated',
              findings: [],
            },],
          },);
        }
        catch (error) {
          caught = error;
        }

        expect(caught,).toBeInstanceOf(UnfilledPageError,);
        expect((caught as UnfilledPageError).entryId,).toBe('CatMissingFacts',);
        expect((caught as UnfilledPageError).sliceIndices,).toEqual([13,],);
        expect((caught as Error).message,).toContain('1 unfilled source passage(s)',);
        expect((caught as Error).message,).toContain('slices 13',);
      },
    },),
  ],
},);
