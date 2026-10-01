/**
 Tests for whether a person-switch finding is read block by block or across
 the whole candidate text (ledger B68).

 THE FIXTURE IS ASYMMETRIC ON PURPOSE: a fence carrying a blank line between
 its own lines stands on the original's side only. A blank-line split counts
 four blocks there and three on the candidate, falls back to comparing the
 two texts whole, and sums the address across both of the original's
 address-bearing blocks, though the first, read against its own rendering,
 carries no switch. The parse reads three blocks on each side, so the blocks
 pair and the switch is read in the closing block alone. The same fence on
 both sides would not tell the two readings apart: the split moves both
 counts alike, and the closing blocks pair either way.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { droppedAddressFindings, } from '../dist/final/node/index.mjs';

await describe({
  name: droppedAddressFindings.name,
  children: [
    it({
      name: 'READS A SWITCH IN ITS OWN BLOCK where a fence with a blank line inside stands on the original '
        + 'only, so the finding counts the closing block\'s address once rather than both blocks\' '
        + 'twice (ledger B68)',
      fn: async () => {
        expect(droppedAddressFindings({
          sourceText: '你是一只猫\n\n```code\n喵\n\n喵\n```\n\n你很乖\n',
          candidateText: 'It is a cat.\n\nIt meows softly.\n\nShe is well-behaved.',
        },),).toStrictEqual([
          'Your translation drops the address in the second person the ORIGINAL carries: where the '
          + 'ORIGINAL writes 你 or 您 once, your translation carries no "you" and more third-person '
          + 'pronouns than the ORIGINAL writes there ("she": 1 against 0), so a pronoun stands where the '
          + 'address stood. A pronoun the ORIGINAL writes is rendered as written where it stands: '
          + 'address the person the ORIGINAL addresses.',
        ],);
      },
    },),
  ],
},);
