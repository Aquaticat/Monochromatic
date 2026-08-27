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
} from '../../dist/final/node/index.mjs';

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
