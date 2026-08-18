/**
 * Tests for the semantic wrap applied to shipped text.
 *
 * WHAT THESE PIN is the property the whole change rests on: the fix is
 * ADD-ONLY. Every passage a lane produces goes through it without anybody
 * reading them first, which is only safe because it cannot delete, move or join
 * anything. A rule that rewrote text instead of inserting into it would be a
 * silent editor sitting after every judge in the pipeline.
 *
 * The second thing they pin is idempotence, which is what lets this run on a
 * cache replay. A resumed slice is wrapped on the way OUT of the cache, so a
 * pool written before this existed needs no migration, and a slice already
 * wrapped has to come back unchanged.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { wrapReplacementText, } from '../dist/final/node/index.mjs';

/**
 * Characters of a passage other than its line breaks, which an add-only fix may
 * only grow, by the continuation prefixes it inserts.
 *
 * @param text - passage to weigh
 *
 * @returns Its length with newlines removed
 *
 * @example
 * ```ts
 * const size = withoutBreaks({ text: 'a\nb', },);
 * ```
 */
function withoutBreaks({ text, }: { readonly text: string; },): number {
  return text.split('\n',)
    .join('',).length;
}

await describe({
  name: wrapReplacementText.name,
  children: [
    it({
      name: 'BREAKS A RUN-ON PASSAGE at its sentence and clause boundaries, which is the whole '
        + 'point: a model returns a paragraph as one line and the archive it replaces was wrapped',
      fn: async () => {
        /**
         * One line, as a model hands it over.
         */
        const flat = 'The tabby naps on the sill. It wakes at dusk, stretches, and goes hunting.';

        /**
         * Same passage as the rule would have it written.
         */
        const wrapped = wrapReplacementText({ text: flat, },);

        expect(flat.split('\n',).length,).toBe(1,);
        expect(wrapped.split('\n',).length,).toBeGreaterThan(1,);

        // The words survive in order; only breaks were put between them.
        expect(
          wrapped.split('\n',)
            .map(function trimmed(line,): string {
              return line.trim();
            },)
            .join(' ',),
        ).toBe(flat,);
      },
    },),

    it({
      name: 'ADDS ONLY, never removing a character that is not a line break. Every produced passage '
        + 'goes through this without review, so a fix that could delete would be an unreviewed '
        + 'editor standing after every judge in the pipeline',
      fn: async () => {
        /**
         * A passage carrying punctuation the rule looks at, in several shapes.
         */
        const passages = [
          'It naps. It wakes. It eats.',
          '> The cat asked: is the bowl full? It was not.',
          '- Mittens; the tabby, asleep.\n- Whiskers, awake.',
          'One sentence only',
          '',
        ];

        for (const text of passages) {
          /**
           * Wrapped form of this passage.
           */
          const wrapped = wrapReplacementText({ text, },);
          expect(withoutBreaks({ text: wrapped, },),).toBeGreaterThanOrEqual(
            withoutBreaks({ text, },),
          );
        }
      },
    },),

    it({
      name: 'RETURNS AN ALREADY WRAPPED PASSAGE UNCHANGED, which is what makes a cache replay safe: '
        + 'a slice resumed from a pool written before this existed is wrapped on the way out, and '
        + 'one wrapped already must not drift further on every resume',
      fn: async () => {
        /**
         * A passage wrapped once.
         */
        const once = wrapReplacementText({
          text: 'The tabby naps on the sill. It wakes at dusk, stretches, and goes hunting.',
        },);

        expect(wrapReplacementText({ text: once, },),).toBe(once,);
      },
    },),

    it({
      name: 'LEAVES A PASSAGE WITH NO BOUNDARY ALONE rather than inventing one, so a short reply '
        + 'is byte-identical afterwards and nothing downstream sees a change nobody made',
      fn: async () => {
        expect(wrapReplacementText({ text: 'A tabby', },),).toBe('A tabby',);
        expect(wrapReplacementText({ text: '', },),).toBe('',);
      },
    },),

    it({
      name: 'KEEPS A HEADING ON ONE LINE, since the rule skips headings, tables, links and raw '
        + 'HTML: breaking those changes what they render as rather than only how they are stored',
      fn: async () => {
        /**
         * A heading carrying punctuation the rule would otherwise break at.
         */
        const heading = '## The cat, the bowl, and the sill.';
        expect(wrapReplacementText({ text: heading, },),).toBe(heading,);
      },
    },),
  ],
},);
