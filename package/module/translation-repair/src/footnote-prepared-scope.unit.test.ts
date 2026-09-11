import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { footnoteRelabelOf, FootnoteRewriteError, prepareDocumentPair, } from '../dist/final/node/index.mjs';

await describe({
  name: 'footnote evidence projected from prepared documents',
  children: [
    it({
      name: 'reads a marker-bearing container half from its complete document instead of reparsing the slice',
      fn: async () => {
        const paragraphs = ['Reference[^1].', ...Array.from({ length: 39 }, (_, index) => `Paragraph ${index}.`)];
        const sourceText = `<details>\n\n${paragraphs.join('\n\n')}\n\n</details>\n\n[^1]: Source note.`;
        const targetText = sourceText.replaceAll('[^1]', '[^2]');
        const prepared = prepareDocumentPair({ sourceText, targetText, frontMatterAuthority: 'archive' });
        const markerSlice = prepared.slices.find(slice => slice.source.text.includes('Reference[^1]'));
        expect(prepared.slices.length).toBeGreaterThan(1);
        expect(markerSlice?.source.text.includes('<details>')).toBe(true);
        expect(markerSlice?.source.text.includes('</details>')).toBe(false);
        let reading: unknown;
        try { reading = footnoteRelabelOf(prepared); }
        catch (error) { reading = error; }
        expect(reading).toEqual({ kind: 'relabel', map: [{ from: '2', to: '1' }],
          correspondences: [{ from: '2', to: '1' }], skipped: [] });
      },
    }),
    ...['sourceText', 'targetText'].map(side => it({
      name: `refuses slice evidence from stale ${side} before interpreting label relations`,
      fn: async () => {
        const prepared = prepareDocumentPair({ sourceText: 'Source[^1].\n\n[^1]: Note.', targetText: 'Target[^2].\n\n[^2]: Note.' });
        const stale = { ...prepared, [side]: `Changed prefix.\n\n${prepared[side as 'sourceText' | 'targetText']}` };
        let caught: unknown;
        try { footnoteRelabelOf(stale); }
        catch (error) { caught = error; }
        expect(caught).toBeInstanceOf(FootnoteRewriteError);
        if (!(caught instanceof FootnoteRewriteError)) throw new Error('expected footnote scope refusal');
        expect(caught.kind).toBe('slice-scope');
      },
    })),
  ],
});
