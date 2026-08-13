/**
 * Tests for restoring the quote style an editor flattened.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { restoreTypography, } from '../dist/final/node/index.mjs';

/**
 * Right single quotation mark, the apostrophe the corpus uses.
 */
const APOSTROPHE = '\u{2019}';

/**
 * Left double quotation mark.
 */
const OPEN = '\u{201C}';

/**
 * Right double quotation mark.
 */
const CLOSE = '\u{201D}';

await describe({
  name: restoreTypography.name,
  children: [
    it({
      name: 'restores a curly apostrophe inside a word when the replaced text '
        + 'used one, which is the observed regression: an edit arrives with '
        + 'didn\'t where the paragraph around it reads didn\u{2019}t, and the '
        + 'document ends up carrying two conventions',
      fn: async () => {
        expect(restoreTypography({
          replacement: "The cat didn't nap.",
          replaced: `The cat didn${APOSTROPHE}t sleep.`,
        },),).toBe(`The cat didn${APOSTROPHE}t nap.`,);
      },
    },),

    it({
      name: 'leaves a straight apostrophe alone when the replaced text used '
        + 'straight ones, so a document written that way is never converted '
        + 'toward a convention it does not hold',
      fn: async () => {
        expect(restoreTypography({
          replacement: "The cat didn't nap.",
          replaced: "The cat didn't sleep.",
        },),).toBe("The cat didn't nap.",);
      },
    },),

    it({
      name: 'converts a BALANCED pair of straight doubles in open-close order, '
        + 'and refuses an odd count, since one straight double is doing '
        + 'something this rule cannot read',
      fn: async () => {
        expect(restoreTypography({
          replacement: 'They called her "Whiskers" often.',
          replaced: `They named her ${OPEN}Tabby${CLOSE} once.`,
        },),).toBe(`They called her ${OPEN}Whiskers${CLOSE} often.`,);
        expect(restoreTypography({
          replacement: 'The cat is 12" tall.',
          replaced: `A ${OPEN}cat${CLOSE} naps.`,
        },),).toBe('The cat is 12" tall.',);
      },
    },),

    it({
      name: 'never touches a quote inside a backtick span, because a straight '
        + 'quote there is part of code and converting it would change what the '
        + 'code says',
      fn: async () => {
        expect(restoreTypography({
          replacement: "Run `cat --name='Tabby'` first.",
          replaced: `Run the cat${APOSTROPHE}s tool.`,
        },),).toBe("Run `cat --name='Tabby'` first.",);
      },
    },),

    it({
      name: 'leaves a straight quote that is not inside a word alone, so a '
        + 'foot mark or a quote opening a phrase is never turned into an '
        + 'apostrophe',
      fn: async () => {
        expect(restoreTypography({
          replacement: "'Tis the season, said the cat.",
          replaced: `The cat${APOSTROPHE}s season.`,
        },),).toBe("'Tis the season, said the cat.",);
      },
    },),
  ],
},);
