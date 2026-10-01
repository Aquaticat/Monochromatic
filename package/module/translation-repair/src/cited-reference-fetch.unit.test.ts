/**
 Tests for reading the contents endpoint's answer for one cited reference.

 `fetchedOf` HAD NO TEST. Its own refusal for a body that is not an object
 names itself precisely ("contents answered with a body that is not an
 object"), but an array body reaches a DIFFERENT, less precise refusal
 instead ("contents answered without a results array"), because `isJsonRecord`
 admits the array and lets the function read past its own documented check
 (ledger B92).

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CitedReferenceFetchError,
  fetchedOf,
} from '../dist/final/node/index.mjs';

/**
 Reads the message a body raises, or empty when it raises none.

 @param parsed - candidate body under test

 @returns Refusal message, empty when none was raised

 @example
 ```ts
 const message = refusalOf({ parsed: 7, },);
 ```
 */
function refusalOf({ parsed, }: { readonly parsed: unknown; },): string {
  try {
    fetchedOf({ parsed, },);
    return '';
  } catch (refusal) {
    expect(refusal instanceof CitedReferenceFetchError,).toBe(true,);
    return String(refusal,);
  }
}

await describe({
  name: fetchedOf.name,
  children: [
    it({
      name: 'READS title and text off the first result, failure empty on success',
      fn: async () => {
        /**
         Body as the endpoint answers one url.
         */
        const parsed = {
          results: [{ title: 'The Lost Cat', text: 'Mittens wandered off at dusk.', },],
          statuses: [{ status: 'success', },],
        };
        expect(fetchedOf({ parsed, },),).toEqual({
          status: 'success',
          title: 'The Lost Cat',
          text: 'Mittens wandered off at dusk.',
        },);
      },
    },),

    it({
      name: 'REFUSES a body that is not an object, naming the check it failed exactly',
      fn: async () => {
        expect(refusalOf({ parsed: 7, },).includes(
          'contents answered with a body that is not an object',
        ),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES a body that is a JSON ARRAY with its own documented message, rather than '
        + 'reading past it into the results-array check and raising the less precise refusal that '
        + 'check names instead (ledger B92)',
      fn: async () => {
        expect(refusalOf({ parsed: ['stray',], },).includes(
          'contents answered with a body that is not an object',
        ),).toBe(true,);
      },
    },),
  ],
},);
