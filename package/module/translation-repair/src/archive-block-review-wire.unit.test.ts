/**
 Tests for the archive-block review guard.

 LEDGER P5 (the whole-package audit, 2026-09-27): the guard refused an
 `editorial-context` reply whose `sourceQuote` was not empty, though the
 prompt asks for "exact source support or empty" and never ties the empty
 value to that disposition, and nothing downstream reads the quote of an
 editorial-context reply (the stage checks the block itself). All 11 guard
 rejections over five runs were that shape, from four models. `dc51b02d9`
 fixed the same slip for `revise` on 2026-09-09 and left this one.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { isArchiveBlockReviewWire, } from '../dist/final/node/index.mjs';

/**
 One reply and whether the guard must admit it.
 */
type GuardCase = readonly [
  label: string,
  reply: unknown,
  admitted: boolean,
];

/**
 Replies covering each disposition with and without a quote.
 */
const GUARD_CASES: readonly GuardCase[] = [
  [
    'editorial-context quoting the source it sits beside',
    {
      disposition: 'editorial-context',
      sourceQuote: '猫在窗边睡觉',
      replacementText: '',
      finding: 'A translator label introducing the next block.',
    },
    true,
  ],
  [
    'editorial-context with no quote',
    {
      disposition: 'editorial-context',
      sourceQuote: '',
      replacementText: '',
      finding: 'A translator label.',
    },
    true,
  ],
  [
    'revise quoting the part it preserves',
    {
      disposition: 'revise',
      sourceQuote: '猫在窗边睡觉',
      replacementText: 'The cat sleeps by the window.',
      finding: 'The block misplaces the nap.',
    },
    true,
  ],
  [
    'source-supported with no quote',
    {
      disposition: 'source-supported',
      sourceQuote: ' ',
      replacementText: '',
      finding: 'Faithful.',
    },
    false,
  ],
  [
    'a disposition the prompt never offers',
    {
      disposition: 'keep',
      sourceQuote: '',
      replacementText: '',
      finding: 'Fine.',
    },
    false,
  ],
];

await describe({
  name: 'the archive-block review guard (ledger P5)',
  children: [
    it({
      name: 'ADMITS an editorial-context reply whatever its quote, as it admits a revision\'s, and still refuses '
        + 'retention with no anchor and a disposition outside the list',
      fn: async () => {
        expect(GUARD_CASES.map(function readingOf({ 0: label, 1: reply, },): string {
          return `${label}: ${String(isArchiveBlockReviewWire(reply,),)}`;
        },),).toEqual(GUARD_CASES.map(function expectedOf({ 0: label, 2: admitted, },): string {
          return `${label}: ${String(admitted,)}`;
        },),);
      },
    },),
  ],
},);
