/**
 * Tests for paragraph inspection and the ordered protected-atom gate.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  gateParagraphRewrite,
  inspectParagraph,
  scanTextAtoms,
} from '../dist/final/neutral/index.mjs';

/**
 * Atom values of one paragraph, for order-sensitive assertions.
 *
 * @param text - paragraph source
 *
 * @returns `kind:value` tokens in document order
 *
 * @example
 * ```ts
 * expect(atomTokens('she was 17',),).toEqual(['number:17',],);
 * ```
 */
function atomTokens(
  text: string,
  definitions = '',
): readonly string[] {
  /** Inspection of the fixture paragraph. */
  const inspection = inspectParagraph({
    text,
    definitions,
  },);
  if (inspection.kind !== 'inspected')
    throw new Error(`fixture was rejected: ${inspection.reason}`,);
  return inspection.atoms
    .map(function toToken(atom,) {
      return `${atom.kind}:${atom.value}`;
    },);
}

await describe({
  name: scanTextAtoms.name,
  children: [
    it({
      name: 'keeps grouping separators inside a number but not the period that '
        + 'ends the sentence after it',
      fn: async () => {
        expect(
          scanTextAtoms({ text: 'She read 1,200 pages by 3.5 years old.', },)
            .map(function toValue(atom,) {
              return atom.value;
            },),
        ).toEqual([
          '1,200',
          '3.5',
        ],);

        // The trailing period belongs to the sentence, not to 2019.
        expect(
          scanTextAtoms({ text: 'It happened in 2019.', },)
            .map(function toValue(atom,) {
              return atom.value;
            },),
        ).toEqual(['2019',],);
      },
    },),

    it({
      name: 'collects foreign-language runs and leaves English prose alone',
      fn: async () => {
        expect(
          scanTextAtoms({ text: 'Her name was 猫猫 to everyone.', },),
        ).toEqual([
          {
            kind: 'foreign-run',
            value: '猫猫',
          },
        ],);
        expect(scanTextAtoms({ text: 'The cat naps in the sun.', },),).toEqual([],);
      },
    },),

    it({
      name: 'protects a Han character above the basic plane, which reading the '
        + 'text as UTF-16 units would have split into two unmatched halves',
      fn: async () => {
        /** Given name in Han Extension B, a surrogate pair in UTF-16. */
        const astral = 'Her family name was \u{20BB7} in the register.';
        expect(scanTextAtoms({ text: astral, },),).toEqual([
          {
            kind: 'foreign-run',
            value: '\u{20BB7}',
          },
        ],);
        expect(
          gateParagraphRewrite({
            base: astral,
            candidate: 'In the register her family name was recorded.',
          },).kind,
        ).toBe('refused',);
      },
    },),
  ],
},);

await describe({
  name: inspectParagraph.name,
  children: [
    it({
      name: 'reads destinations, code, footnotes, numbers, and foreign runs in '
        + 'document order',
      fn: async () => {
        expect(
          atomTokens(
            'She was 17 when [the essay](https://example.invalid/a) called her 猫猫[^1], and `page.md` kept it.',
            '[^1]: The essay, reprinted.',
          ),
        ).toEqual([
          'number:17',
          'link-url:https://example.invalid/a',
          'foreign-run:猫猫',
          'footnote:1',
          'inline-code:page.md',
        ],);
      },
    },),

    it({
      name: 'reads a link\'s own text too, since it carries prose like any other',
      fn: async () => {
        expect(
          atomTokens('See [the 2019 note](https://example.invalid/b) for more.',),
        ).toEqual([
          'link-url:https://example.invalid/b',
          'number:2019',
        ],);
      },
    },),

    it({
      name: 'refuses a rewrite that arrived as more than one paragraph, since '
        + 'the lane may change wording and not structure',
      fn: async () => {
        /** Candidate split into two blocks. */
        const inspection = inspectParagraph({ text: 'One paragraph.\n\nAnd another.', },);
        expect(inspection.kind,).toBe('rejected',);
        expect(inspection.kind === 'rejected' ? inspection.reason : '',).toBe(
          'not-one-paragraph',
        );
      },
    },),

    it({
      name: 'refuses a rewrite that introduced a hard break, which no newline '
        + 'in the source would have revealed',
      fn: async () => {
        /** Candidate carrying a markdown hard break. */
        const inspection = inspectParagraph({ text: 'The cat naps.  \nThe bowl stays full.', },);
        expect(inspection.kind,).toBe('rejected',);
        expect(inspection.kind === 'rejected' ? inspection.reason : '',).toBe(
          'carries-markup',
        );
      },
    },),
  ],
},);

await describe({
  name: gateParagraphRewrite.name,
  children: [
    it({
      name: 'passes a rewrite that only changes wording',
      fn: async () => {
        expect(
          gateParagraphRewrite({
            base: 'She was 17 when she wrote it, and it stayed with 猫猫 for years.',
            candidate: 'At 17 she wrote it, and 猫猫 carried it for years afterwards.',
          },).kind,
        ).toBe('preserved',);
      },
    },),

    it({
      name: 'refuses a swap that leaves every atom present, which is exactly '
        + 'what a multiset comparison would have missed',
      fn: async () => {
        /** Numbers exchanged between their nouns. */
        const verdict = gateParagraphRewrite({
          base: 'The shelter took in 3 cats and 5 dogs that winter, and rehomed them.',
          candidate: 'The shelter took in 5 cats and 3 dogs that winter, and rehomed them.',
        },);
        expect(verdict.kind,).toBe('refused',);
        expect(verdict.kind === 'refused' ? verdict.detail : '',).toContain(
          'protected atom 1 changed',
        );
      },
    },),

    it({
      name: 'refuses two links exchanging destinations, the same failure in '
        + 'another shape',
      fn: async () => {
        expect(
          gateParagraphRewrite({
            base:
              'Read [the first](https://example.invalid/a) and then [the second](https://example.invalid/b) carefully.',
            candidate:
              'Read [the first](https://example.invalid/b) and then [the second](https://example.invalid/a) carefully.',
          },).kind,
        ).toBe('refused',);
      },
    },),

    it({
      name: 'refuses a rewrite that dropped a protected atom outright',
      fn: async () => {
        /** Candidate that quietly loses the footnote. */
        const verdict = gateParagraphRewrite({
          base: 'She wrote about it at length[^1], and the essay circulated widely.',
          candidate: 'She wrote about it at length, and the essay circulated widely.',
          definitions: '[^1]: The essay, reprinted.',
        },);
        expect(verdict.kind,).toBe('refused',);
        expect(verdict.kind === 'refused' ? verdict.detail : '',).toContain(
          'protected atom count changed',
        );
      },
    },),

    it({
      name: 'refuses a candidate that is not inspectable at all, naming which '
        + 'side failed',
      fn: async () => {
        /** Candidate arriving as two paragraphs. */
        const verdict = gateParagraphRewrite({
          base: 'The cat naps in the sun and the bowl stays full all afternoon.',
          candidate: 'The cat naps in the sun.\n\nThe bowl stays full all afternoon.',
        },);
        expect(verdict.kind,).toBe('refused',);
        expect(verdict.kind === 'refused' ? verdict.detail : '',).toContain('candidate rejected',);
      },
    },),
  ],
},);
