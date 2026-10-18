import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { reorderFootnoteDefinitions, } from '../dist/final/node/index.mjs';

await describe({
  name: 'footnote definition movement boundaries',
  children: [
    it({
      name: 'retains each distinct whitespace gap exactly once',
      fn: async () => {
        const text = 'Body[^1][^2][^3].\n\n[^3]: Third.\n\n\n[^1]: First.\r\n\r\n[^2]: Second.\n';
        expect(reorderFootnoteDefinitions({ text, order: ['1', '2', '3'] }).text).toBe(
          'Body[^1][^2][^3].\n\n[^1]: First.\n\n\n[^2]: Second.\r\n\r\n[^3]: Third.\n');
      },
    }),
    it({
      name: 'does not duplicate or relocate comments between definition blocks',
      fn: async () => {
        const text = 'Body[^1][^2][^3].\n\n[^3]: Third.\n\n<!-- Annotation -->\n\n[^1]: First.\n\n[^2]: Second.\n';
        const result = reorderFootnoteDefinitions({ text, order: ['1', '2', '3'] });
        expect(result.text).toBe(text);
        expect(result.changed).toBe(false);
        expect(result.note).toBeDefined();
      },
    }),
    it({
      name: 'compares ranked labels using parser-equivalent identities',
      fn: async () => {
        const text = 'Body[^A][^B].\n\n[^A]: First.\n\n[^B]: Second.\n';
        expect(reorderFootnoteDefinitions({ text, order: ['b', 'a'] }).text).toBe(
          'Body[^A][^B].\n\n[^B]: Second.\n\n[^A]: First.\n');
      },
    }),
    it({
      name: 'does not separate widened container delimiters from their definition blocks',
      fn: async () => {
        const text = 'Body[^1][^2].\n\n<details>\n\n[^2]: Second.\n\n[^1]: First.\n\n</details>\n';
        let outcome: unknown;
        try {
          outcome = reorderFootnoteDefinitions({ text, order: ['1', '2'] });
        }
        catch (error) {
          outcome = error;
        }
        expect(outcome).toMatchObject({ text, changed: false });
      },
    }),
  ],
});
