/**
 Tests the footnote mention reader (ledger T8 and B35): each mention with its
 role, convention and folded identifier as fields, the counts keyed from
 them, and the refusal of a text carrying more markers than the guard counts,
 while one at the cap is still counted. The marker text is invented.

 @module
 */

import {
  caught,
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  footnoteIdentifiers,
  footnoteMentions,
  FootnoteOverflowError,
  MAX_SLICE_IDENTIFIERS,
} from '../dist/final/node/index.mjs';

/**
 A text of `count` distinct GFM footnote references.

 @param count - markers to write

 @returns The text
 */
function markers({ count, }: { readonly count: number; },): string {
  return Array.from(
    { length: count, },
    (_unused, index,) => `nap[^${String(index,)}]`,
  ).join(' ',);
}

/**
 Identifiers of the GFM-or-full-width mentions a text makes, in the scan's order.

 @param text - text to scan

 @returns One identifier per mention
 */
function identifiersOf({ text, }: { readonly text: string; },): readonly string[] {
  return footnoteMentions({ text, },)
    .map(function identifierOf(mention,): string {
      return mention.identifier;
    },);
}

/**
 A passage citing one note twice in GFM, once with a capital, and once in
 the full-width convention, then defining both; a GFM marker followed by its
 separator in the middle of a line stays a reference.
 */
const PASSAGE = [
  '猫打盹[^Nap]，又打盹[^nap]。见〔１〕，参见[^nap]: 不是定义。',
  '',
  '[^nap]: 午睡。',
  '〔1〕：注。',
].join('\n',);

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: footnoteMentions.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'COUNTS NO GFM MARKER SHAPE INSIDE A LINK URL (an inline destination, an angle autolink, a bare '
            + 'literal), where the same shape in a link label, beside a URL, or full-width inside one still counts',
          fn: async () => {
            const text = [
              'A cat [paws [^1] nap](https://cat.example/[^9]x) naps <https://cat.example/[^8]x>',
              'and https://cat.example/[^7]x or (www.cat.example/[^6]x) then https://cat.example [^2].',
              'See https://cat.example/〔3〕x and [paws](<https://cat.example/[^5]x> "title").',
              '',
              '[^4]: A note, see https://cat.example/[^9].',
            ].join('\n',);
            expect(footnoteMentions({ text, },),).toEqual([
              { role: 'reference', convention: 'gfm', identifier: '1', },
              { role: 'reference', convention: 'gfm', identifier: '2', },
              { role: 'definition', convention: 'gfm', identifier: '4', },
              { role: 'reference', convention: 'fullwidth-bracket', identifier: '3', },
            ],);
          },
        },),
        it({
          name: 'COUNTS NO GFM MARKER SHAPE the parse reads as a code span, an image, a comment or the brackets of a '
            + 'reference link, and counts one in a code block, which a fragment cannot settle for its page',
          fn: async () => {
            const text = [
              'A `nap [^6]` cat ![cat [^5]](u) <!-- note [^4] --> and [^7][cat] see [^1].',
              '',
              '[cat]: https://cat.example/',
              '',
              '```',
              '[^2]',
              '```',
              '',
            ].join('\n',);
            expect(identifiersOf({ text, },),).toEqual(['1', '2',],);
          },
        },),
        it({
          name: 'COUNTS NO MARKER SHAPE INSIDE A LITERAL after a Han character or a full stop, and counts one beside a '
            + 'scheme with no domain or inside a link label',
          fn: async () => {
            expect(identifiersOf({ text: '猫见https://cat.example/[^9]x 睡 [^3]', },),).toEqual(['3',],);
            expect(identifiersOf({ text: '猫.www.c.example/[^7]y 睡 [^3]', },),).toEqual(['3',],);
            expect(identifiersOf({ text: 'A cat https://[^9]x [^3]', },),).toEqual(['9', '3',],);
            expect(identifiersOf({ text: 'A [see https://c.example/[^9] here](u) [^3]', },),).toEqual(['9', '3',],);
          },
        },),
        it({
          name: 'READS THE EDGES OF A URL as the parse does: a destination balances its own parentheses and takes a '
            + 'backslash escape, may follow whitespace, an upper-case literal and a two-letter scheme are URLs, and a '
            + 'literal after an opening angle is one though no angle closes it',
          fn: async () => {
            /**
             Texts whose only marker is a URL's, each paired with the identifiers that count.
             */
            const cases: readonly (readonly [string, readonly string[]])[] = [
              ['[a](https://c.example/(x)[^9]y) [^3]', ['3',],],
              [String.raw`[a](https://c.example/\)[^9]) [^3]`, ['3',],],
              ['A HTTPS://C.EXAMPLE/[^9] [^3]', ['3',],],
              ['A <ab:[^9]> [^3]', ['3',],],
              ['A [a]( [^9]) [^3]', ['3',],],
              ['A <https://c.example/[^9]', [],],
            ];
            expect(cases.map(function counted([text,],): readonly string[] {
              return identifiersOf({ text, },);
            },),).toEqual(cases.map(function expected([, identifiers,],): readonly string[] {
              return identifiers;
            },),);
          },
        },),
        it({
          name: 'COUNTS A MARKER SHAPE NO URL HOLDS: a scheme of one letter or past its length, a literal glued to a '
            + 'word, an angle destination the parse refuses (a space inside it, a line break, no closing angle), and '
            + 'a space inside an angle autolink',
          fn: async () => {
            /**
             Texts whose marker the parse reads as a reference, each paired with the identifiers that count.
             */
            const cases: readonly (readonly [string, readonly string[]])[] = [
              ['A <a:[^9]> [^3]', ['9', '3',],],
              [`A <${'a'.repeat(33,)}:[^9]> [^3]`, ['9', '3',],],
              ['A xhttps://c.example/[^9] [^3]', ['9', '3',],],
              ['A [a](<cat [^9] [^3]', ['9', '3',],],
              ['A [a](<cat\n[^9]> [^3]', ['9', '3',],],
              ['A <https://c.example/ [^9]> [^3]', ['9', '3',],],
              ['A <https://c.example/<[^9]> [^3]', ['9', '3',],],
            ];
            expect(cases.map(function counted([text,],): readonly string[] {
              return identifiersOf({ text, },);
            },),).toEqual(cases.map(function expected([, identifiers,],): readonly string[] {
              return identifiers;
            },),);
          },
        },),
        it({
          name: 'LISTS EACH MENTION WITH ITS ROLE, CONVENTION AND IDENTIFIER folded to the parser\'s spelling, the GFM '
            + 'convention\'s first, and reads a marker as a definition only where it opens its line before its separator',
          fn: async () => {
            expect(footnoteMentions({ text: PASSAGE, },),).toEqual([
              {
                role: 'reference',
                convention: 'gfm',
                identifier: 'nap',
              },
              {
                role: 'reference',
                convention: 'gfm',
                identifier: 'nap',
              },
              {
                role: 'reference',
                convention: 'gfm',
                identifier: 'nap',
              },
              {
                role: 'definition',
                convention: 'gfm',
                identifier: 'nap',
              },
              {
                role: 'reference',
                convention: 'fullwidth-bracket',
                identifier: '1',
              },
              {
                role: 'definition',
                convention: 'fullwidth-bracket',
                identifier: '1',
              },
            ],);
          },
        },),
        it({
          name: 'REFUSES A TEXT OVER THE CAP, naming the count and the convention',
          fn: async () => {
            /**
             What the reader threw over one marker too many.
             */
            const refusal = caught(function overCap(): void {
              footnoteMentions({ text: markers({ count: MAX_SLICE_IDENTIFIERS + 1, },), },);
            },);
            expect(refusal,).toBeInstanceOf(FootnoteOverflowError,);
            expect(refusal,).toHaveProperty(
              'message',
              `${String(MAX_SLICE_IDENTIFIERS + 1,)} gfm footnote markers in one text, over the ${
            String(MAX_SLICE_IDENTIFIERS,)
          } this guard counts`,
            );
          },
        },),
      ],
    },),

    describe({
      name: footnoteIdentifiers.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'COUNTS THE MENTIONS keyed as role, convention and identifier',
          fn: async () => {
            expect([...footnoteIdentifiers({ text: PASSAGE, },).entries(),],).toEqual([
              ['reference gfm nap', 3,],
              ['definition gfm nap', 1,],
              ['reference fullwidth-bracket 1', 1,],
              ['definition fullwidth-bracket 1', 1,],
            ],);
          },
        },),
        it({
          name: 'COUNTS A TEXT AT THE CAP, and refuses one marker more as pathological',
          fn: async () => {
            expect(footnoteIdentifiers({ text: markers({ count: MAX_SLICE_IDENTIFIERS, },), },).size,).toBe(MAX_SLICE_IDENTIFIERS,);
            expect(() => footnoteIdentifiers({ text: markers({ count: MAX_SLICE_IDENTIFIERS + 1, },), },),).toThrow(
              FootnoteOverflowError,
            );
          },
        },),
      ],
    },),
  ],
},);
