/**
 * Tests for the archive's footnote labels following the original's.
 *
 * THE NINETEENTH CLASS, found by the yuki418330012 page of 2026-09-08: the
 * original writes 洲洲[^2] and 真理[^1], the archive had Zhouzhou[^1] and
 * Zhenli[^2] with definitions to match, and the page shipped the original's
 * markers above the archive's definitions, each pointing at the other's note.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  applyFootnoteRelabel,
  footnoteRelabelOf,
  footnoteRelabelOfDefinitions,
  prepareDocumentPair,
  referenceLabels,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Original: the godmother is the second note, the younger sister the first.
 */
const SOURCE_TEXT = '## 生平\n\n洲洲[^2]收留了她，真理[^1]帮助她。\n\n[^1]: 比她小，像姐姐一样。\n\n[^2]: 干妈？像母女一样。\n';

/**
 * Archive: renumbered by first appearance, definitions to match.
 */
const TARGET_TEXT = '## Life\n\nZhouzhou[^1] took her in, and Zhenli[^2] helped her.\n\n'
  + '[^1]: A substitute parent? Like mother and daughter.\n\n[^2]: Younger than her, like a sister.\n';

//endregion Fixtures

await describe({
  name: referenceLabels.name,
  children: [
    it({
      name: 'lists the distinct labels a text references in order of first appearance, and never a '
        + 'definition opener',
      fn: async () => {
        expect(referenceLabels({ text: 'A[^2] and B[^1], again[^2].\n\n[^1]: note\n[^3]: unreferenced\n', },),)
          .toStrictEqual([
            '2',
            '1',
          ],);
        expect(referenceLabels({ text: 'Nothing here.\n', },),).toStrictEqual([],);
      },
    },),
  ],
},);

await describe({
  name: footnoteRelabelOf.name,
  children: [
    it({
      name: 'maps the archive labels to the original ones position by position within each paired slice, '
        + 'and rewrites references and definitions together',
      fn: async () => {
        /**
         * Preparation over the fixture pair.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
        },);
        /**
         * The reading.
         */
        const reading = footnoteRelabelOf(prepared,);
        if (reading.kind !== 'relabel')
          throw new Error(`expected a relabel, read ${reading.kind}`,);
        expect(reading.map,).toStrictEqual([
          {
            from: '1',
            to: '2',
          },
          {
            from: '2',
            to: '1',
          },
        ],);
        expect(reading.skipped,).toStrictEqual([],);
        /**
         * The archive under the original's labels.
         */
        const relabelled = applyFootnoteRelabel({
          text: TARGET_TEXT,
          map: reading.map,
        },);
        expect(relabelled,).toBe(
          '## Life\n\nZhouzhou[^2] took her in, and Zhenli[^1] helped her.\n\n'
            + '[^2]: A substitute parent? Like mother and daughter.\n\n[^1]: Younger than her, like a sister.\n',
        );
        // A SECOND READING OF THE RELABELLED ARCHIVE CHANGES NOTHING.
        expect(
          footnoteRelabelOf(prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: relabelled,
        },),),
        ).toStrictEqual({
          kind: 'unchanged',
          correspondences: [{ from: '2', to: '2', }, { from: '1', to: '1', },],
          skipped: [],
        },);
      },
    },),

    it({
      name: 'reads nothing to change where the labels already agree or no slice carries a marker on both sides',
      fn: async () => {
        expect(
          footnoteRelabelOf(prepareDocumentPair({
          sourceText: '她[^1]。\n\n[^1]: 注。\n',
          targetText: 'She[^1].\n\n[^1]: Note.\n',
        },),),
        ).toStrictEqual({
          kind: 'unchanged',
          correspondences: [{ from: '1', to: '1', },],
          skipped: [],
        },);
        expect(
          footnoteRelabelOf(prepareDocumentPair({
          sourceText: '她。\n',
          targetText: 'She.\n',
        },),),
        ).toStrictEqual({
          kind: 'unchanged',
          correspondences: [],
          skipped: [],
        },);
      },
    },),

    it({
      name: 'leaves a slice whose two sides reference different counts of notes out of the reading, naming it, '
        + 'and reads the map off the rest (the archive of hakureico carries no [^2] at all)',
      fn: async () => {
        /**
         * The reading over a slice with one marker against two and a slice
         * with a swap.
         */
        const reading = footnoteRelabelOf(prepareDocumentPair({
          sourceText: '## 甲\n\n她[^1]和他[^2]。\n\n## 乙\n\n洲洲[^4]，真理[^3]。\n\n'
            + '[^1]: 一。\n\n[^2]: 二。\n\n[^3]: 三。\n\n[^4]: 四。\n',
          targetText: '## A\n\nShe[^1] and he.\n\n## B\n\nZhouzhou[^3], Zhenli[^4].\n\n'
            + '[^1]: One.\n\n[^3]: Three.\n\n[^4]: Four.\n',
        },),);
        if (reading.kind !== 'relabel')
          throw new Error(`expected a relabel, read ${reading.kind}`,);
        expect(reading.map,).toStrictEqual([
          {
            from: '3',
            to: '4',
          },
          {
            from: '4',
            to: '3',
          },
        ],);
        expect(reading.skipped
          .length,).toBe(1,);
        expect(reading.skipped[0],).toContain('2 distinct notes in the original and 1 in the archive',);
      },
    },),

    it({
      name: 'leaves the archive as it is, naming the slice, where two slices map one archive label to different '
        + 'original labels',
      fn: async () => {
        /**
         * The reading where [^1] is [^2] in one slice and [^3] in the next.
         */
        const reading = footnoteRelabelOf(prepareDocumentPair({
          sourceText: '## 甲\n\n她[^2]。\n\n## 乙\n\n他[^3]。\n\n[^2]: 二。\n\n[^3]: 三。\n',
          targetText: '## A\n\nShe[^1].\n\n## B\n\nHe[^1].\n\n[^1]: One.\n',
        },),);
        expect(reading.kind,).toBe('ambiguous',);
        if (reading.kind === 'ambiguous')
          expect(reading.detail,).toContain('maps archive [^1] to original [^3] where an earlier slice mapped [^2]',);
      },
    },),
  ],
},);

await describe({
  name: footnoteRelabelOfDefinitions.name,
  children: [
    it({
      name: 'reads the map off the definitions the roster paired by content, and nothing off none',
      fn: async () => {
        expect(footnoteRelabelOfDefinitions({
          pairs: [
            {
              sourceLabel: '1',
              targetLabel: '2',
            },
            {
              sourceLabel: '2',
              targetLabel: '1',
            },
          ],
        },),).toStrictEqual({
          kind: 'relabel',
          correspondences: [{ from: '2', to: '1', }, { from: '1', to: '2', },],
          map: [
            {
              from: '2',
              to: '1',
            },
            {
              from: '1',
              to: '2',
            },
          ],
          skipped: [],
        },);
        expect(footnoteRelabelOfDefinitions({ pairs: [], },),).toStrictEqual({
          kind: 'unchanged',
          correspondences: [],
          skipped: [],
        },);
      },
    },),

    it({
      name: 'leaves the archive as it is where two pairs map one archive label to different original labels',
      fn: async () => {
        /**
         * The reading where archive [^1] pairs with original [^2] and then [^3].
         */
        const reading = footnoteRelabelOfDefinitions({
          pairs: [
            {
              sourceLabel: '2',
              targetLabel: '1',
            },
            {
              sourceLabel: '3',
              targetLabel: '1',
            },
          ],
        },);
        expect(reading.kind,).toBe('ambiguous',);
        if (reading.kind === 'ambiguous')
          expect(reading.detail,).toContain('where an earlier pair mapped [^2]',);
      },
    },),
  ],
},);

await describe({
  name: applyFootnoteRelabel.name,
  children: [
    it({
      name: 'rewrites only the mapped labels and leaves every other marker and the text between them alone',
      fn: async () => {
        expect(applyFootnoteRelabel({
          text: 'A[^1] B[^3] C[^1].\n\n[^1]: one\n\n[^3]: three\n',
          map: [ {
            from: '1',
            to: '2',
          }, ],
        },),).toBe('A[^2] B[^3] C[^2].\n\n[^2]: one\n\n[^3]: three\n',);
        expect(applyFootnoteRelabel({
          text: 'No markers.\n',
          map: [],
        },),).toBe('No markers.\n',);
      },
    },),
  ],
},);
