/**
 * Whole-document proof that one structural withdrawal preserves unrelated translations.
 * Fixtures are cat-themed invention.
 *
 * @module
 */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { type ChunkPair, guardFootnoteAssembly, prepareDocumentPair, singleStructuralWithdrawal, } from '../dist/final/node/index.mjs';

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
      name: 'REFUSES a counterfactual whose restored grammar exposes an unresolved footnote',
      fn: async () => {
        /** Source-only passage gives the second replacement an insertion anchor. */
        const prepared = prepareDocumentPair({
          sourceText: `${COMPONENT}\n\n> 猫咪的记录。`,
          targetText: COMPONENT,
          blockPairings: new Map([[0, [{ source: 0, target: 0, },],],]),
        },);
        /** Removing the malformed component alone would leave an unpaired note. */
        const replacements = prepared.slices.map(function replacement(slice,) {
          return {
            sliceIndex: slice.target.sliceIndex,
            replacementText: slice.source.text.includes('PhotoScroll',) ? BROKEN_COMPONENT : '> The cat rests.[^lost]',
          };
        },);
        expect(singleStructuralWithdrawal({ targetText: COMPONENT, slices: prepared.slices, replacements, },),).toEqual([],);
      },
    },),
    it({
      name: 'FALLS BACK when two malformed replacements cannot be repaired by a single withdrawal',
      fn: async () => {
        /** Distinct sections force separate slices without a character-budget dial. */
        const targetText = '## Cats\n\nCats rest.\n\n## Birds\n\nBirds sing.';
        /** Identity preparation has no inherited structural defect. */
        const prepared = prepareDocumentPair({ sourceText: targetText, targetText, },);
        /** Every slice independently introduces malformed JSX. */
        const replacements = prepared.slices.map(function malformed(slice,) {
          return { sliceIndex: slice.target.sliceIndex, replacementText: BROKEN_COMPONENT, };
        },);
        expect(replacements.length,).toBeGreaterThan(1,);
        /** No single reversion can remove both grammar failures. */
        const guarded = guardFootnoteAssembly({ targetText, slices: prepared.slices, replacements, },);
        expect(guarded.assembledText,).toBe(targetText,);
        expect(guarded.replacements,).toEqual([],);
        expect(guarded.findings.some(function blanket(finding,): boolean {
          return finding.startsWith('assembly-withdrew-every-replacement',);
        },),).toBe(true,);
      },
    },),
    it({
      name: 'PROVES whole-document validity across container halves instead of blaming isolated slices',
      fn: async () => {
        /** Container spans the first two slices; the last has unrelated prose. */
        const targetText = '<details>\n\nCats rest.\n\nBirds sing.\n\n</details>\n\nThe end.';
        /** Actual document boundaries, not standalone parse units. */
        const boundaries = [0, targetText.indexOf('Birds',), targetText.indexOf('The end.',), targetText.length,];
        /** Pairs split inside the container as production container extents permit. */
        const slices: readonly ChunkPair[] = boundaries.slice(0, -1,).map(function pair(startOffset, sliceIndex,) {
          /** End of this slice, known because only nonfinal boundaries are mapped. */
          const endOffset = boundaries[sliceIndex + 1];
          if (endOffset === undefined)
            throw new Error('fixture lost its next boundary',);
          /** Shared chunk before any replacement. */
          const chunk = { sliceIndex, startOffset, endOffset, text: targetText.slice(startOffset, endOffset,), nodes: [], };
          return { source: chunk, target: chunk, };
        },);
        /** Each valid replacement owns only one half of the container. */
        const texts = [
          `<details>\n\nCats [rest](${LINK}).\n\n`,
          'Birds sing softly.\n\n</details>\n\n',
          BROKEN_COMPONENT,
        ];
        /** All replacements are real changes, with grammar broken only at the final one. */
        const replacements = slices.map(function replacement(slice, at,) {
          /** Matching replacement text, checked instead of a non-null assertion. */
          const replacementText = texts[at];
          if (replacementText === undefined)
            throw new Error('fixture lost its replacement',);
          return { sliceIndex: slice.target.sliceIndex, replacementText, };
        },);
        /** Guard must not misclassify the container halves as independently malformed. */
        const guarded = guardFootnoteAssembly({ targetText, slices, replacements, },);
        expect(guarded.replacements,).toEqual(replacements.slice(0, -1,),);
        expect(guarded.revertedChunkIndices,).toEqual([slices.at(-1,)?.target.sliceIndex,],);
        expect(guarded.assembledText,).toContain(LINK,);
        expect(guarded.assembledText,).toContain('Birds sing softly.',);
      },
    },),
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
        if ((component === undefined) || (insertion === undefined))
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
