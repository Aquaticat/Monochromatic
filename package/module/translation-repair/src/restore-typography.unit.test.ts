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

/**
 * Restores using the replaced region as its own convention.
 *
 * Every case below was written before the convention widened to the whole
 * document, and each asserts REGION-scoped behaviour, so passing the replaced
 * text as the convention keeps each assertion testing what it was written to
 * test.
 *
 * @param replacement - text the editor wrote
 *
 * @param replaced - text it replaces, standing as its own convention
 *
 * @returns Restored replacement
 *
 * @example
 * ```ts
 * restoreFromRegion({ replacement: "didn't", replaced: "did not", },);
 * ```
 */
function restoreFromRegion(
  {
    replacement,
    replaced,
  }: {
    readonly replacement: string;
    readonly replaced: string;
  },
): string {
  return restoreTypography({
    replacement,
    replaced,
    convention: replaced,
  },);
}

await describe({
  name: restoreTypography.name,
  children: [
    it({
      name: 'restores a curly apostrophe inside a word when the replaced text '
        + 'used one, which is the observed regression: an edit arrives with '
        + 'didn\'t where the paragraph around it reads didn\u{2019}t, and the '
        + 'document ends up carrying two conventions',
      fn: async () => {
        expect(restoreFromRegion({
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
        expect(restoreFromRegion({
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
        expect(restoreFromRegion({
          replacement: 'They called her "Whiskers" often.',
          replaced: `They named her ${OPEN}Tabby${CLOSE} once.`,
        },),).toBe(`They called her ${OPEN}Whiskers${CLOSE} often.`,);
        expect(restoreFromRegion({
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
        expect(restoreFromRegion({
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
        expect(restoreFromRegion({
          replacement: "'Tis the season, said the cat.",
          replaced: `The cat${APOSTROPHE}s season.`,
        },),).toBe("'Tis the season, said the cat.",);
      },
    },),

    it({
      name: 'restores from the DOCUMENT when the replaced region carries no '
        + 'quote of its own, the case that made the region-scoped rule useless '
        + 'in practice. Regions run to a median of 75 characters, so most hold '
        + 'no quote to learn from, while English prose is full of apostrophes: '
        + 'measured over 56 settled entries, 40 of the 51 whose input carried '
        + 'curly quotes came out worse, 99 curly characters lost against 163 '
        + 'straight ones gained',
      fn: async () => {
        expect(restoreTypography({
          replacement: "The cat didn't nap.",
          replaced: 'The cat slept soundly.',
          convention: `Every other line here reads didn${APOSTROPHE}t.`,
        },),).toBe(`The cat didn${APOSTROPHE}t nap.`,);
      },
    },),

    it({
      name: 'still leaves a straight-quoted document alone, which is what keeps '
        + 'the widening from imposing a convention nowhere in evidence',
      fn: async () => {
        expect(restoreTypography({
          replacement: "The cat didn't nap.",
          replaced: 'The cat slept soundly.',
          convention: "Every other line here reads didn't.",
        },),).toBe("The cat didn't nap.",);
      },
    },),

    it({
      name: 'restores curly DOUBLES from the document too, and still refuses an '
        + 'odd count, so the pairing guard survives the widening rather than '
        + 'being bypassed by it',
      fn: async () => {
        expect(restoreTypography({
          replacement: 'They called her "Whiskers" often.',
          replaced: 'They called her Tabby once.',
          convention: `A neighbour said ${OPEN}hello${CLOSE}.`,
        },),).toBe(`They called her ${OPEN}Whiskers${CLOSE} often.`,);
        expect(restoreTypography({
          replacement: 'The cat is 12" tall.',
          replaced: 'The cat is small.',
          convention: `A neighbour said ${OPEN}hello${CLOSE}.`,
        },),).toBe('The cat is 12" tall.',);
      },
    },),
    it({
      name: 'LEAVES a JSX string literal inside a blockquoted component line straight on a curly '
        + 'page, since a literal in typographic quotes compiles nowhere (yulianNyanner, 2026-09-06)',
      fn: async () => {
        /**
         * Component line as the archives write it.
         */
        const line = `> <PhotoScroll photos={["\${path}/photos/photo3.webp"]} />\n`;

        expect(restoreTypography({
          replacement: line,
          replaced: line,
          convention: `She said ${OPEN}hello${CLOSE}, didn${APOSTROPHE}t she.`,
        },),).toBe(line,);
      },
    },),

    it({
      name: 'LEAVES a double-quoted HTML attribute straight while curling the prose around it, '
        + 'and does not count the attribute quotes toward the pairing',
      fn: async () => {
        expect(restoreTypography({
          replacement: '<p style="text-align: end;">"Whiskers," she said.</p>',
          replaced: '<p style="text-align: end;">Tabby, she said.</p>',
          convention: `A neighbour said ${OPEN}hello${CLOSE}.`,
        },),).toBe(`<p style="text-align: end;">${OPEN}Whiskers,${CLOSE} she said.</p>`,);
      },
    },),

    it({
      name: 'KEEPS a tag spanning blockquote lines as one tag, so the marker on each line does '
        + 'not end it early',
      fn: async () => {
        /**
         * Component whose array runs over three quoted lines.
         */
        const block = `> <PhotoScroll photos={[\n>     "\${path}/a.webp",\n>     "\${path}/b.webp",\n> ]} />\n`;

        expect(restoreTypography({
          replacement: block,
          replaced: block,
          convention: `A neighbour said ${OPEN}hello${CLOSE}.`,
        },),).toBe(block,);
      },
    },),

    it({
      name: 'RESTORES a trailing possessive apostrophe when nothing in the replacement could be '
        + 'its opening quote, and leaves a quoted phrase alone (yulianNyanner, 2026-09-06)',
      fn: async () => {
        expect(restoreTypography({
          replacement: "on the girls' side too.",
          replaced: 'on the other side too.',
          convention: `Every other line here reads didn${APOSTROPHE}t.`,
        },),).toBe(`on the girls${APOSTROPHE} side too.`,);
        expect(restoreTypography({
          replacement: "on the 'girls' side too.",
          replaced: 'on the other side too.',
          convention: `Every other line here reads didn${APOSTROPHE}t.`,
        },),).toBe("on the 'girls' side too.",);
      },
    },),
    it({
      name: 'RESTORES three dots where the document writes three dots, collapsing the doubled '
        + 'U+2026 Chinese carries, and leaves a tag alone (yulianNyanner, 2026-09-07)',
      fn: async () => {
        expect(restoreTypography({
          replacement: 'No chance anymore\u{2026}\u{2026} <a href="x…y">so\u{2026}</a>',
          replaced: 'No chance now.',
          convention: 'She waited... and waited...',
        },),).toBe('No chance anymore... <a href="x…y">so...</a>',);
      },
    },),

    it({
      name: 'RESTORES U+2026 where the document writes it, from a run of exactly three dots and '
        + 'not from a longer one',
      fn: async () => {
        expect(restoreTypography({
          replacement: 'Well... no.... never',
          replaced: 'Well, no.',
          convention: 'She waited\u{2026} and waited\u{2026}',
        },),).toBe('Well\u{2026} no.... never',);
      },
    },),

    it({
      name: 'LEAVES the ellipsis alone where the document shows both forms or neither',
      fn: async () => {
        expect(restoreTypography({
          replacement: 'Well... no\u{2026}',
          replaced: 'Well, no.',
          convention: 'She waited\u{2026} and waited...',
        },),).toBe('Well... no\u{2026}',);
        expect(restoreTypography({
          replacement: 'Well... no\u{2026}',
          replaced: 'Well, no.',
          convention: 'She waited and waited.',
        },),).toBe('Well... no\u{2026}',);
      },
    },),
  ],
},);
