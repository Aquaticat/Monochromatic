import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  containsAnyOfWordBounded,
  containsWordBoundedPhrase,
  isAlphaNum,
  isDigit,
  isWhitespace,
  isWordChar,
  PHRASE_NOT_FOUND,
  splitWhitespace,
  stripBetweenDelims,
  stripLinesStartingWith,
} from './text-scan.ts';

await describe({
  name: 'text-scan',
  children: [
    describe({
      name: isDigit.name,
      children: [
        it({
          name: 'returns true for ASCII digits',
          fn: async () => {
            expect(isDigit('0',),).toBe(true,);
            expect(isDigit('9',),).toBe(true,);
            expect(isDigit('5',),).toBe(true,);
          },
        },),
        it({
          name: 'returns false for non-digit chars',
          fn: async () => {
            expect(isDigit('a',),).toBe(false,);
            expect(isDigit(' ',),).toBe(false,);
            expect(isDigit('_',),).toBe(false,);
            expect(isDigit('/',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: isAlphaNum.name,
      children: [
        it({
          name: 'accepts letters and digits',
          fn: async () => {
            expect(isAlphaNum('a',),).toBe(true,);
            expect(isAlphaNum('Z',),).toBe(true,);
            expect(isAlphaNum('5',),).toBe(true,);
          },
        },),
        it({
          name: 'rejects underscore, hyphen, whitespace',
          fn: async () => {
            expect(isAlphaNum('_',),).toBe(false,);
            expect(isAlphaNum('-',),).toBe(false,);
            expect(isAlphaNum(' ',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: isWordChar.name,
      children: [
        it({
          name: 'accepts alphanumeric and underscore',
          fn: async () => {
            expect(isWordChar('a',),).toBe(true,);
            expect(isWordChar('Z',),).toBe(true,);
            expect(isWordChar('0',),).toBe(true,);
            expect(isWordChar('_',),).toBe(true,);
          },
        },),
        it({
          name: 'rejects punctuation and whitespace',
          fn: async () => {
            expect(isWordChar('-',),).toBe(false,);
            expect(isWordChar('.',),).toBe(false,);
            expect(isWordChar(' ',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: isWhitespace.name,
      children: [
        it({
          name: 'accepts space, tab, newline, carriage return, form feed, vertical tab',
          fn: async () => {
            expect(isWhitespace(' ',),).toBe(true,);
            expect(isWhitespace('\t',),).toBe(true,);
            expect(isWhitespace('\n',),).toBe(true,);
            expect(isWhitespace('\r',),).toBe(true,);
            expect(isWhitespace('\f',),).toBe(true,);
            expect(isWhitespace('\v',),).toBe(true,);
          },
        },),
        it({
          name: 'rejects non-whitespace',
          fn: async () => {
            expect(isWhitespace('a',),).toBe(false,);
            expect(isWhitespace('0',),).toBe(false,);
            expect(isWhitespace('_',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: splitWhitespace.name,
      children: [
        it({
          name: 'splits on single spaces',
          fn: async () => {
            expect(splitWhitespace('a b c',),).toEqual(['a', 'b', 'c',],);
          },
        },),
        it({
          name: 'collapses runs of whitespace and trims edges',
          fn: async () => {
            expect(splitWhitespace('  a\tb\nc  ',),).toEqual(['a', 'b', 'c',],);
          },
        },),
        it({
          name: 'returns an empty array for the empty string',
          fn: async () => {
            expect(splitWhitespace('',),).toEqual([],);
          },
        },),
        it({
          name: 'returns an empty array for whitespace-only input',
          fn: async () => {
            expect(splitWhitespace('   \t\n  ',),).toEqual([],);
          },
        },),
        it({
          name: 'tokenises a very large input in linear time',
          fn: async () => {
            /** Token count large enough that the former O(n^2) array-spread accumulator stalled. */
            const count = 200_000;
            /** Result of tokenising `count` single-character tokens separated by spaces. */
            const result = splitWhitespace('a '.repeat(count,),);
            expect(result.length,).toBe(count,);
            expect(result[0],).toBe('a',);
            expect(result.at(-1,),).toBe('a',);
          },
        },),
      ],
    },),
    describe({
      name: containsWordBoundedPhrase.name,
      children: [
        it({
          name: 'matches phrase at the start of input',
          fn: async () => {
            expect(containsWordBoundedPhrase({
              haystack: 'maybe tomorrow',
              phrase: 'maybe',
            },),)
              .toBe(true,);
          },
        },),
        it({
          name: 'matches phrase at the end of input',
          fn: async () => {
            expect(containsWordBoundedPhrase({
              haystack: 'tomorrow maybe',
              phrase: 'maybe',
            },),)
              .toBe(true,);
          },
        },),
        it({
          name: 'matches phrase in the middle, case-insensitively',
          fn: async () => {
            expect(containsWordBoundedPhrase({
              haystack: 'Yes, MAYBE tomorrow',
              phrase: 'maybe',
            },),)
              .toBe(true,);
          },
        },),
        it({
          name: 'rejects matches embedded in larger words',
          fn: async () => {
            expect(containsWordBoundedPhrase({
              haystack: 'maybenot',
              phrase: 'maybe',
            },),)
              .toBe(false,);
            expect(containsWordBoundedPhrase({
              haystack: 'methinks',
              phrase: 'think',
            },),)
              .toBe(false,);
          },
        },),
        it({
          name: 'matches phrase containing internal spaces',
          fn: async () => {
            expect(containsWordBoundedPhrase({
              haystack: 'I think so',
              phrase: 'i think',
            },),)
              .toBe(true,);
          },
        },),
        it({
          name: 'treats punctuation as a boundary',
          fn: async () => {
            expect(containsWordBoundedPhrase({
              haystack: "That's demonstrably false.",
              phrase: 'demonstrably false',
            },),)
              .toBe(true,);
          },
        },),
        it({
          name: 'returns false for empty phrase',
          fn: async () => {
            expect(containsWordBoundedPhrase({
              haystack: 'anything',
              phrase: '',
            },),)
              .toBe(false,);
          },
        },),
        it({
          name:
            'works when phrase starts or ends with non-word char (boundary check is skipped on that side)',
          fn: async () => {
            expect(containsWordBoundedPhrase({
              haystack: 'see AGENTS.md for details',
              phrase: 'agents.md',
            },),)
              .toBe(true,);
          },
        },),
      ],
    },),
    describe({
      name: containsAnyOfWordBounded.name,
      children: [
        it({
          name: 'returns the first matching phrase',
          fn: async () => {
            expect(containsAnyOfWordBounded({
              haystack: 'maybe later',
              phrases: ['probably', 'maybe', 'perhaps',],
            },),)
              .toEqual({ phrase: 'maybe', },);
          },
        },),
        it({
          name: 'returns PHRASE_NOT_FOUND when no phrase matches',
          fn: async () => {
            expect(containsAnyOfWordBounded({
              haystack: 'the deploy succeeded',
              phrases: ['probably', 'maybe', 'perhaps',],
            },),)
              .toBe(PHRASE_NOT_FOUND,);
          },
        },),
      ],
    },),
    describe({
      name: stripBetweenDelims.name,
      children: [
        it({
          name: 'strips a single delimited region',
          fn: async () => {
            expect(stripBetweenDelims({
              text: 'a `code` b',
              openDelim: '`',
              closeDelim: '`',
            },),)
              .toBe('a  b',);
          },
        },),
        it({
          name: 'strips multiple delimited regions',
          fn: async () => {
            expect(stripBetweenDelims({
              text: 'x `a` y `b` z',
              openDelim: '`',
              closeDelim: '`',
            },),)
              .toBe('x  y  z',);
          },
        },),
        it({
          name: 'strips multi-char delimiters (fenced code blocks)',
          fn: async () => {
            expect(stripBetweenDelims({
              text: 'pre ```js\nmaybe()\n``` post',
              openDelim: '```',
              closeDelim: '```',
            },),)
              .toBe('pre  post',);
          },
        },),
        it({
          name: 'leaves unmatched openers in place',
          fn: async () => {
            expect(stripBetweenDelims({
              text: 'a `unclosed code',
              openDelim: '`',
              closeDelim: '`',
            },),)
              .toBe('a `unclosed code',);
          },
        },),
        it({
          name: 'respects disallowedInside to skip cross-newline spans',
          fn: async () => {
            expect(stripBetweenDelims({
              text: 'start "good" mid "bad\nnewline" end',
              openDelim: '"',
              closeDelim: '"',
              disallowedInside: '\n',
            },),)
              .toBe('start  mid "bad\nnewline" end',);
          },
        },),
      ],
    },),
    describe({
      name: stripLinesStartingWith.name,
      children: [
        it({
          name: 'removes lines starting with the prefix',
          fn: async () => {
            expect(stripLinesStartingWith({
              text: 'a\n> quote\nb',
              prefix: '>',
            },),)
              .toBe('a\nb',);
          },
        },),
        it({
          name: 'ignores leading whitespace when checking the prefix',
          fn: async () => {
            expect(stripLinesStartingWith({
              text: 'a\n   > quote\nb',
              prefix: '>',
            },),)
              .toBe('a\nb',);
          },
        },),
        it({
          name: 'leaves non-matching lines untouched',
          fn: async () => {
            expect(stripLinesStartingWith({
              text: 'one\ntwo\nthree',
              prefix: '#',
            },),)
              .toBe('one\ntwo\nthree',);
          },
        },),
      ],
    },),
  ],
},);
