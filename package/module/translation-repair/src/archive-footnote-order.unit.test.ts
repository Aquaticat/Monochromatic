/**
 * Tests for moving the archive's footnote definitions into the original's
 * order.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  definitionLabelOrder,
  reorderFootnoteDefinitions,
} from '../dist/final/node/index.mjs';

await describe({
  name: definitionLabelOrder.name,
  children: [
    it({
      name: 'lists the labels of a text’s definitions in document order',
      fn: async () => {
        expect(definitionLabelOrder({ text: 'A[^2] B[^1].\n\n[^1]: one\n\n[^2]: two\n', },),).toStrictEqual([
          '1',
          '2',
        ],);
        expect(definitionLabelOrder({ text: 'No notes.\n', },),).toStrictEqual([],);
      },
    },),
  ],
},);

await describe({
  name: reorderFootnoteDefinitions.name,
  children: [
    it({
      name: 'moves a contiguous run of definitions into the order asked for, keeping the gap between them',
      fn: async () => {
        /**
         * The yuki archive after the relabel: labels the original's, order
         * still the archive's.
         */
        const reordered = reorderFootnoteDefinitions({
          text: '---\nname: Yuki\n---\n\nZhouzhou[^2] and Zhenli[^1].\n\n[^2]: A substitute parent.\n\n[^1]: Younger.\n',
          order: [
            '1',
            '2',
          ],
        },);
        expect(reordered.changed,).toBe(true,);
        expect(reordered.text,).toBe(
          '---\nname: Yuki\n---\n\nZhouzhou[^2] and Zhenli[^1].\n\n[^1]: Younger.\n\n[^2]: A substitute parent.\n',
        );
      },
    },),

    it({
      name: 'leaves a text standing where the definitions already sit in that order, where there is one, '
        + 'or where prose sits among them',
      fn: async () => {
        expect(reorderFootnoteDefinitions({
          text: 'A[^1].\n\n[^1]: one\n\n[^2]: two\n',
          order: [
            '1',
            '2',
          ],
        },),).toStrictEqual({
          text: 'A[^1].\n\n[^1]: one\n\n[^2]: two\n',
          changed: false,
        },);
        expect(reorderFootnoteDefinitions({
          text: 'A[^1].\n\n[^1]: one\n',
          order: [ '1', ],
        },).changed,).toBe(false,);
        /**
         * Prose between the definitions.
         */
        const interleaved = reorderFootnoteDefinitions({
          text: 'A[^1].\n\n[^2]: two\n\nMore prose.\n\n[^1]: one\n',
          order: [
            '1',
            '2',
          ],
        },);
        expect(interleaved.changed,).toBe(false,);
        expect(interleaved.note,).toContain('interleaved',);
      },
    },),

    it({
      name: 'places a definition the order does not name after the ones it does, in document order',
      fn: async () => {
        expect(reorderFootnoteDefinitions({
          text: '[^9]: nine\n\n[^2]: two\n\n[^1]: one\n',
          order: [
            '1',
            '2',
          ],
        },).text,).toBe('[^1]: one\n\n[^2]: two\n\n[^9]: nine\n',);
      },
    },),
  ],
},);
