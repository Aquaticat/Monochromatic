/**
 * Tests for the assembly-time footnote guard.
 *
 * What this covers that no per-slice check can: a footnote is a relation
 * BETWEEN slices, so a candidate that drops, renames or invents a marker
 * validates perfectly inside its own slice and breaks the document.
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

import {
  footnoteIdentifiers,
  guardFootnoteAssembly,
  introducedStructuralRegressions,
  prepareDocumentPair,
} from '../dist/final/node/index.mjs';

/**
 * Original document: three sections, so the reference, the unrelated prose and
 * the definition each land in their OWN slice. A footnote that fits inside one
 * slice is not the case this guard exists for.
 */
const SOURCE_TEXT = `## 猫

猫猫在窗台上打盹〔1〕。

## 鸟

窗台上有一只鸟。

## 注

〔1〕：那是它最喜欢的位置。
`;

/**
 * Translation as it stands, with the footnote pair intact and split the same
 * way.
 */
const TARGET_TEXT = `## The cat

The cat is doing the sleeping on the windowsill[^1].

## The bird

On the windowsill there is being a bird.

## Notes

[^1]: That is its favourite spot.
`;

/**
 * Prepares the fixture pair and returns its slices.
 *
 * @param targetText - translation to prepare against the fixture original
 *
 * @returns Slices in document order
 *
 * @example
 * ```ts
 * const slices = fixtureSlices({ targetText: TARGET_TEXT, },);
 * ```
 */
function fixtureSlices({ targetText, }: { readonly targetText: string; },) {
  return prepareDocumentPair({
    sourceText: SOURCE_TEXT,
    targetText,
  },).slices;
}

/**
 * Chunk index of the slice whose incumbent text contains a needle.
 *
 * @param slices - prepared slices
 *
 * @param needle - text that slice carries
 *
 * @returns Chunk index of the first slice carrying it
 *
 * @example
 * ```ts
 * const index = sliceCarrying({ slices, needle: '[^1]:', },);
 * ```
 */
function sliceCarrying(
  {
    slices,
    needle,
  }: {
    readonly slices: readonly {
      readonly target: {
        readonly chunkIndex: number;
        readonly text: string;
      };
    }[];
    readonly needle: string;
  },
): number {
  /**
   * First slice whose incumbent carries the needle.
   */
  const found = slices.find(function carries(slice,): boolean {
    return slice.target
      .text
      .includes(needle,);
  },);
  if (found === undefined)
    throw new Error(`no slice carries ${needle}`,);
  return found.target
    .chunkIndex;
}

/**
 * Chunk indices in ascending order, so a comparison says which slices were
 * withdrawn rather than which round withdrew them.
 *
 * @param indices - chunk indices in withdrawal order
 *
 * @returns Same indices, ascending
 *
 * @example
 * ```ts
 * expect(byIndex({ indices: guarded.revertedChunkIndices, },),).toEqual([0, 1,],);
 * ```
 */
function byIndex(
  { indices, }: { readonly indices: readonly number[]; },
): readonly number[] {
  return indices.toSorted(function ascending(
    left,
    right,
  ): number {
    return left - right;
  },);
}

await describe({
  name: 'assembly-integrity',
  children: [
    it({
      name: 'counts every footnote identifier a text mentions, in EITHER role: '
        + 'attribution asks which slice changed its mention of an identifier, '
        + 'and a definition line mentions its own label',
      fn: async () => {
        expect([
          ...footnoteIdentifiers({ text: 'A nap[^1] and a bird[^2].', },)
            .entries(),
        ],).toEqual([
          ['reference gfm 1', 1,],
          ['reference gfm 2', 1,],
        ],);
        // The role is what a bare identifier cannot say: turning a definition
        // into prose that refers to it leaves the identifier counted once
        // either way.
        expect(footnoteIdentifiers({ text: '[^1]: That is its spot.', },)
          .get('definition gfm 1',),).toBe(1,);
        expect(footnoteIdentifiers({ text: '猫猫打盹〔1〕。', },)
          .get('reference fullwidth-bracket 1',),).toBe(1,);
        expect(footnoteIdentifiers({ text: '〔1〕：那是它的位置。', },)
          .get('definition fullwidth-bracket 1',),).toBe(1,);
      },
    },),

    it({
      name: 'keeps every replacement when the footnote graph survives, which '
        + 'is the ordinary case and the one a guard must not tax',
      fn: async () => {
        /**
         * Slices of the fixture pair.
         */
        const slices = fixtureSlices({ targetText: TARGET_TEXT, },);

        /**
         * Replacement that renders the same footnote reference.
         */
        const guarded = guardFootnoteAssembly({
          targetText: TARGET_TEXT,
          slices,
          replacements: [
            {
              chunkIndex: sliceCarrying({
                slices,
                needle: 'doing the sleeping',
              },),
              replacementText: 'The cat naps on the windowsill[^1].',
            },
          ],
        },);
        expect(guarded.revertedChunkIndices,).toEqual([],);
        expect(guarded.assembledText,).toContain('naps on the windowsill[^1]',);
        expect(guarded.findings,).toEqual([],);
      },
    },),

    it({
      name: 'REVERTS the slice that dropped a reference, leaving its definition '
        + 'resolved. Nothing inside that slice was wrong: the sentence reads '
        + 'well, and the marker it lost belongs to a line in another slice',
      fn: async () => {
        /**
         * Slices of the fixture pair.
         */
        const slices = fixtureSlices({ targetText: TARGET_TEXT, },);

        /**
         * Index of the slice carrying the reference.
         */
        const referring = sliceCarrying({
          slices,
          needle: 'doing the sleeping',
        },);

        /**
         * Assembly where the reference was translated away.
         */
        const guarded = guardFootnoteAssembly({
          targetText: TARGET_TEXT,
          slices,
          replacements: [
            {
              chunkIndex: referring,
              replacementText: 'The cat naps on the windowsill.',
            },
          ],
        },);
        expect(guarded.revertedChunkIndices,).toEqual([referring,],);
        expect(guarded.assembledText,).toBe(TARGET_TEXT,);
        expect(guarded.findings
          .some(function namesRevert(finding,): boolean {
            return finding.startsWith('assembly-footnote-reverted',);
          },),).toBe(true,);
      },
    },),

    it({
      name: 'ITERATES TO A FIXPOINT, because one revert can orphan an '
        + 'identifier a DIFFERENT slice introduced alongside it. One pass '
        + 'reverts the slice that dropped [^1] and ships a [^2] definition '
        + 'whose only reference went with it',
      fn: async () => {
        /**
         * Slices of the fixture pair.
         */
        const slices = fixtureSlices({ targetText: TARGET_TEXT, },);

        /**
         * Slice that referred to the footnote, and now renumbers it.
         */
        const referring = sliceCarrying({
          slices,
          needle: 'doing the sleeping',
        },);

        /**
         * Slice with no footnote of its own, which gains the definition.
         */
        const bird = sliceCarrying({
          slices,
          needle: 'there is being a bird',
        },);

        /**
         * Assembly where one slice renumbered its reference and another
         * supplied the matching definition.
         */
        const guarded = guardFootnoteAssembly({
          targetText: TARGET_TEXT,
          slices,
          replacements: [
            {
              chunkIndex: referring,
              replacementText: 'The cat naps on the windowsill[^2].',
            },
            {
              chunkIndex: bird,
              replacementText: 'A bird sits on the windowsill.\n\n'
                + '[^2]: That is its favourite spot.',
            },
          ],
        },);
        // The first pass sees [^1] orphaned and reverts the renumbering. That
        // revert is what orphans [^2], which only a second pass can see.
        expect(byIndex({ indices: guarded.revertedChunkIndices, },),).toEqual(
          byIndex({ indices: [referring, bird,], },),
        );
        expect(guarded.assembledText,).toBe(TARGET_TEXT,);
      },
    },),

    it({
      name: 'lets a slice INTRODUCE a footnote pair, since a translation may '
        + 'restore a footnote the archive never rendered, and both halves '
        + 'landing together leave the graph whole',
      fn: async () => {
        /**
         * Slices of the fixture pair.
         */
        const slices = fixtureSlices({ targetText: TARGET_TEXT, },);

        /**
         * Slice gaining a reference, and the one gaining its definition.
         */
        const bird = sliceCarrying({
          slices,
          needle: 'there is being a bird',
        },);

        /**
         * Assembly introducing a complete new pair.
         */
        const guarded = guardFootnoteAssembly({
          targetText: TARGET_TEXT,
          slices,
          replacements: [
            {
              chunkIndex: bird,
              replacementText: 'A bird sits on the windowsill[^2].\n\n'
                + '[^2]: A sparrow, most mornings.',
            },
          ],
        },);
        expect(guarded.revertedChunkIndices,).toEqual([],);
        expect(guarded.assembledText,).toContain('[^2]: A sparrow',);
      },
    },),

    it({
      name: 'WITHDRAWS EVERY REPLACEMENT when the defect belongs to no slice. '
        + 'A stray comment opener masks markers document-wide, so the slice '
        + 'that wrote it never changed its own mention of anything; choosing a '
        + 'slice to blame would be a guess, and shipping a document the lane '
        + 'knowingly broke is worse than shipping the archive',
      fn: async () => {
        /**
         * Slices of the fixture pair.
         */
        const slices = fixtureSlices({ targetText: TARGET_TEXT, },);

        /**
         * Assembly whose prose opens a comment it never closes, hiding the
         * definition that follows it in another slice.
         */
        const guarded = guardFootnoteAssembly({
          targetText: TARGET_TEXT,
          slices,
          replacements: [
            {
              chunkIndex: sliceCarrying({
                slices,
                needle: 'there is being a bird',
              },),
              replacementText: 'A bird sits on the windowsill. <!-- a note',
            },
          ],
        },);
        expect(guarded.assembledText,).toBe(TARGET_TEXT,);
        expect(guarded.replacements,).toEqual([],);
        expect(guarded.findings
          .some(function namesWithdrawal(finding,): boolean {
            return finding.startsWith('assembly-withdrew-every-replacement',);
          },),).toBe(true,);
      },
    },),

    it({
      name: 'reads an unterminated comment and an MDX downgrade as structural '
        + 'regressions, which name no footnote identifier and so can be found '
        + 'no other way',
      fn: async () => {
        expect(introducedStructuralRegressions({
          incumbentText: 'A settled paragraph.\n',
          assembledText: 'A settled paragraph. <!-- never closed\n',
        },),).toContain('unterminated-html-comment',);
        expect(introducedStructuralRegressions({
          incumbentText: 'A settled paragraph.\n',
          assembledText: 'A settled paragraph.\n',
        },),).toEqual([],);
      },
    },),

    it({
      name: 'does NOT blame the lane for a defect the archive already had: an '
        + 'incumbent whose definition nothing references keeps that state, and '
        + 'no replacement is reverted for it',
      fn: async () => {
        /**
         * Translation whose footnote definition is already orphaned.
         */
        const orphaned = `## The cat

The cat is doing the sleeping on the windowsill.

## The bird

On the windowsill there is being a bird.

## Notes

[^1]: That is its favourite spot.
`;

        /**
         * Slices of that pair.
         */
        const slices = fixtureSlices({ targetText: orphaned, },);

        /**
         * Assembly that changes prose and leaves the orphan alone.
         */
        const guarded = guardFootnoteAssembly({
          targetText: orphaned,
          slices,
          replacements: [
            {
              chunkIndex: sliceCarrying({
                slices,
                needle: 'doing the sleeping',
              },),
              replacementText: 'The cat naps on the windowsill.',
            },
          ],
        },);
        expect(guarded.revertedChunkIndices,).toEqual([],);
        expect(guarded.assembledText,).toContain('The cat naps on the windowsill.',);
      },
    },),
  ],
},);
