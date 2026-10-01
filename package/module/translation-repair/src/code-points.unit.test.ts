/**
 Tests the code-point readers every scan past the first plane shares (ledger
 B22): a count that reads a surrogate pair once and a lone surrogate once, as
 the string's own iteration does; the whole character at and before an
 offset, a half read alone from inside a pair, and empty past either end; and
 an opening cut that never ends inside a pair and keeps a lone first half no
 pair was cut from.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  codePointAt,
  codePointBefore,
  codePointCount,
  compareCodePoints,
  wholeOpening,
} from '../dist/final/node/index.mjs';

/**
 Character past the first plane (U+20000), two UTF-16 units: U+D840 U+DC00.
 */
const ASTRAL = '\u{20000}';

/**
 First half of a surrogate pair, standing alone.
 */
const LONE_HIGH = '\u{D800}';

/**
 Second half of a surrogate pair, standing alone.
 */
const LONE_LOW = '\u{DC00}';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: codePointCount.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'COUNTS A CHARACTER PAST THE FIRST PLANE ONCE, and trims surrounding whitespace',
          fn: async () => {
            expect(codePointCount({ text: `\u{732B}${ASTRAL}`, },),).toBe(2,);
            expect(codePointCount({ text: '  \u{5176}\u{4E00}\u{FF1A}  ', },),).toBe(3,);
            expect(codePointCount({ text: '', },),).toBe(0,);
          },
        },),
        it({
          name: 'COUNTS A LONE SURROGATE AS ONE CODE POINT, as the string\'s own iteration reads it',
          fn: async () => {
            // Each lone half is one code point of its own, and a second half before
            // a first one makes no pair.
            expect(codePointCount({ text: `a${LONE_LOW}b`, },),).toBe(3,);
            expect(codePointCount({ text: `a${LONE_HIGH}b`, },),).toBe(3,);
            expect(codePointCount({ text: `a${LONE_LOW}${LONE_HIGH}b`, },),).toBe(4,);
          },
        },),
      ],
    },),

    describe({
      name: codePointAt.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS THE WHOLE PAIR AT ITS FIRST HALF, and the second half alone from inside it',
          fn: async () => {
            expect(codePointAt({
              text: `a${ASTRAL}`,
              at: 1,
            },),).toBe(ASTRAL,);
            expect(codePointAt({
              text: `a${ASTRAL}`,
              at: 2,
            },),).toBe('\u{DC00}',);
          },
        },),
        it({
          name: 'READS NOTHING PAST EITHER END',
          fn: async () => {
            expect(codePointAt({
              text: 'ab',
              at: 2,
            },),).toBe('',);
            expect(codePointAt({
              text: 'ab',
              at: -1,
            },),).toBe('',);
          },
        },),
      ],
    },),

    describe({
      name: codePointBefore.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS THE WHOLE PAIR ENDING BEFORE AN OFFSET, and the first half alone from inside it',
          fn: async () => {
            expect(codePointBefore({
              text: `a${ASTRAL}`,
              at: 3,
            },),).toBe(ASTRAL,);
            expect(codePointBefore({
              text: `a${ASTRAL}`,
              at: 2,
            },),).toBe('\u{D840}',);
            expect(codePointBefore({
              text: 'ab',
              at: 1,
            },),).toBe('a',);
          },
        },),
        it({
          name: 'READS A LONE FIRST HALF BEFORE A PAIR AS ITSELF, not as part of the pair after it',
          fn: async () => {
            expect(codePointBefore({
              text: `${LONE_HIGH}${ASTRAL}`,
              at: 1,
            },),).toBe(LONE_HIGH,);
            expect(codePointBefore({
              text: `${LONE_HIGH}${ASTRAL}`,
              at: 3,
            },),).toBe(ASTRAL,);
          },
        },),
        it({
          name: 'READS NOTHING AT THE START OR PAST THE END',
          fn: async () => {
            expect(codePointBefore({
              text: 'ab',
              at: 0,
            },),).toBe('',);
            expect(codePointBefore({
              text: 'ab',
              at: 5,
            },),).toBe('',);
          },
        },),
      ],
    },),

    describe({
      name: wholeOpening.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'KEEPS A TEXT THAT FITS WHOLE, and cuts an empty opening at a limit of none',
          fn: async () => {
            expect(wholeOpening({
              text: 'nap',
              units: 3,
            },),).toBe('nap',);
            expect(wholeOpening({
              text: 'nap',
              units: 5,
            },),).toBe('nap',);
            expect(wholeOpening({
              text: 'nap',
              units: 0,
            },),).toBe('',);
          },
        },),
        it({
          name: 'LEAVES OUT THE FIRST HALF OF A PAIR THE LIMIT CUTS, and keeps a pair the limit clears',
          fn: async () => {
            expect(wholeOpening({
              text: 'nap\u{1F431}',
              units: 4,
            },),).toBe('nap',);
            expect(wholeOpening({
              text: 'nap\u{1F431}!',
              units: 5,
            },),).toBe('nap\u{1F431}',);
          },
        },),
        it({
          name: 'KEEPS A LONE FIRST HALF NO PAIR WAS CUT FROM, since the limit fell after a whole unit',
          fn: async () => {
            expect(wholeOpening({
              text: `${LONE_HIGH}x`,
              units: 1,
            },),).toBe(LONE_HIGH,);
          },
        },),
      ],
    },),

    describe({
      name: compareCodePoints.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ORDERS BY CODE POINT, capitals before lower case, where a collation would interleave them '
            + '(ledger B95)',
          fn: async () => {
            expect(['mooncat', 'Tabby', 'biscuit', 'Ginger',].toSorted(function byCodePoint(
              left,
              right,
            ): number {
              return compareCodePoints({
                left,
                right,
              },);
            },),).toEqual(['Ginger', 'Tabby', 'biscuit', 'mooncat',],);
          },
        },),
        it({
          name: 'PUTS A CHARACTER PAST U+FFFF AFTER ONE BETWEEN U+E000 AND U+FFFF, where a comparison of '
            + 'UTF-16 units puts it first for its leading surrogate',
          fn: async () => {
            expect(compareCodePoints({
              left: ASTRAL,
              right: '\u{FF5E}',
            },),).toBeGreaterThan(0,);
            expect(ASTRAL < '\u{FF5E}',).toBe(true,);
          },
        },),
        it({
          name: 'PUTS A TEXT BEFORE ANY LONGER TEXT IT BEGINS, and calls equal texts equal, the empty text '
            + 'among them',
          fn: async () => {
            expect(compareCodePoints({
              left: 'nap',
              right: 'napping',
            },),).toBeLessThan(0,);
            expect(compareCodePoints({
              left: `nap${ASTRAL}`,
              right: 'nap',
            },),).toBeGreaterThan(0,);
            expect(compareCodePoints({
              left: `cat${ASTRAL}`,
              right: `cat${ASTRAL}`,
            },),).toBe(0,);
            expect(compareCodePoints({
              left: '',
              right: '',
            },),).toBe(0,);
          },
        },),
        it({
          name: 'READS A LONE HALF OF A PAIR AS THE ONE UNIT IT IS, as the string\'s own iteration does',
          fn: async () => {
            expect(compareCodePoints({
              left: `${LONE_HIGH}a`,
              right: ASTRAL,
            },),).toBeLessThan(0,);
            expect(compareCodePoints({
              left: LONE_LOW,
              right: '\u{FF5E}',
            },),).toBeLessThan(0,);
          },
        },),
      ],
    },),
  ],
},);
