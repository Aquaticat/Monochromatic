/**
 * Whole-document proof that one structural withdrawal preserves unrelated translations.
 * Fixtures are cat-themed invention.
 *
 * @module
 */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { guardFootnoteAssembly, prepareDocumentPair, } from '../dist/final/node/index.mjs';

/** Source and archive component shared before translation. */
const COMPONENT = `<PhotoScroll photos={['\${path}/photos/cat.webp']} />`;
/** Invalid component selected by a lane after its author's unresolved repair. */
const BROKEN_COMPONENT = `<PhotoScroll photos=['\${path}/photos/cat.webp']} />`;
/** Link carried by the source-only passage which an unrelated withdrawal must preserve. */
const LINK = 'https://example.test/cat';

await describe({
  name: 'structural assembly withdrawal',
  children: [
    it({
      name: 'KEEPS a translated source-only link when reverting one malformed component repairs the whole page',
      fn: async () => {
        /** Pair only the component; the linked source passage becomes an insertion. */
        const prepared = prepareDocumentPair({
          sourceText: `${COMPONENT}\n\n> 猫咪的[记录](${LINK})。`,
          targetText: COMPONENT,
          blockPairings: new Map([[0, [{ source: 0, target: 0, },],],]),
        },);
        /** Slice containing the component the selected candidate broke. */
        const component = prepared.slices.find(function componentSlice(slice,): boolean {
          return slice.source.text.includes('PhotoScroll',);
        },);
        /** Independently valid translation of a passage absent from the archive. */
        const insertion = prepared.slices.find(function linkedSlice(slice,): boolean {
          return slice.source.text.includes(LINK,);
        },);
        if (component === undefined || insertion === undefined)
          throw new Error('fixture must expose component and insertion slices',);
        /** Exact wording whose loss stopped Mio8 at publication. */
        const translated = `> The cat's [record](${LINK}).`;
        /** Real assembly guard, including whole-page grammar and footnote checks. */
        const guarded = guardFootnoteAssembly({
          targetText: COMPONENT,
          slices: prepared.slices,
          replacements: [
            { sliceIndex: component.target.sliceIndex, replacementText: BROKEN_COMPONENT, },
            { sliceIndex: insertion.target.sliceIndex, replacementText: translated, },
          ],
        },);
        expect(guarded.revertedChunkIndices,).toEqual([component.target.sliceIndex,],);
        expect(guarded.replacements,).toEqual([
          { sliceIndex: insertion.target.sliceIndex, replacementText: translated, },
        ],);
        expect(guarded.assembledText,).toContain(translated,);
        expect(guarded.assembledText,).toContain(COMPONENT,);
        expect(guarded.findings.some(function proved(finding,): boolean {
          return finding.startsWith('assembly-structure-single-withdrawal',);
        },),).toBe(true,);
      },
    },),
  ],
},);
