/**
 * Tests the stub-marker strip the archive passes through before preparation.
 *
 * THE CASE IS XIEPT2: an archive page that is front matter, `(To-Do)`, an HTML
 * comment of translator hints and nothing else, which the pipeline published
 * with the marker standing over a finished translation. Here the marker goes
 * with one blank line, the comment and the front matter stay byte for byte,
 * and a marker inside a comment, a code fence, front matter or a sentence is
 * left alone.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isStubMarkerParagraph,
  passArchiveText,
  STUB_MARKER_TOKENS,
  stripStubMarkers,
} from '../../dist/final/node/index.mjs';

/**
 * XIEPT2's archive opening as the corpus stores it.
 */
const XIEPT2_OPENING = [
  '---',
  'name: Xiafeng Grape',
  'info:',
  '    alias: Grape',
  '---',
  '',
  '(To-Do)',
  '',
  '<!-- 翻译提示：',
  '',
  '这篇文章有时候是作者视角。',
  '',
  '-->',
  '<!-- 起床战争：Bed Wars -->',
  '',
  '## Experience',
  '',
].join('\n',);

/**
 * The same opening with the marker and its blank gone.
 */
const XIEPT2_STRIPPED = [
  '---',
  'name: Xiafeng Grape',
  'info:',
  '    alias: Grape',
  '---',
  '',
  '<!-- 翻译提示：',
  '',
  '这篇文章有时候是作者视角。',
  '',
  '-->',
  '<!-- 起床战争：Bed Wars -->',
  '',
  '## Experience',
  '',
].join('\n',);

await describe({
  name: isStubMarkerParagraph.name,
  children: [
    it({
      name: 'READS a bare or bracketed placeholder token in any case as a marker, and NOTHING ELSE',
      fn: async () => {
        expect(STUB_MARKER_TOKENS.has('to-do',),).toBe(true,);
        for (const paragraph of [
          '(To-Do)',
          'To-Do',
          'TODO',
          '[tbd]',
          '（WIP）',
          '  (todo)  ',
        ]) {
          expect(isStubMarkerParagraph({ paragraph, },),).toBe(true,);
        }
        for (const paragraph of [
          '(To-Do) write the childhood section',
          'the to-do list she kept',
          '()',
          '',
          'Done',
          '((To-Do))',
        ]) {
          expect(isStubMarkerParagraph({ paragraph, },),).toBe(false,);
        }
      },
    },),
  ],
},);

await describe({
  name: stripStubMarkers.name,
  children: [
    it({
      name: 'REMOVES the XIEPT2 marker with its following blank line and KEEPS the front matter and the '
        + 'comments byte for byte',
      fn: async () => {
        const { text, stripped, } = stripStubMarkers({ text: XIEPT2_OPENING, },);
        expect(text,).toBe(XIEPT2_STRIPPED,);
        expect(stripped,).toEqual([{
          lineNumber: 7,
          text: '(To-Do)',
        },],);
      },
    },),
    it({
      name: 'LEAVES a marker alone inside a comment, inside a code fence, inside front matter, or inside a '
        + 'sentence, and RETURNS a marker-free page unchanged',
      fn: async () => {
        for (const text of [
          '---\ntitle: (To-Do)\n---\n\nBody.\n',
          'Before.\n\n<!--\n\n(To-Do)\n\n-->\n\nAfter.\n',
          'Before.\n\n```\n\nTODO\n\n```\n\nAfter.\n',
          'Before.\n\n(To-Do) is what she called the list.\n\nAfter.\n',
          'Before.\n\nAfter.\n',
        ]) {
          const { text: kept, stripped, } = stripStubMarkers({ text, },);
          expect(kept,).toBe(text,);
          expect(stripped,).toEqual([],);
        }
      },
    },),
    it({
      name: 'REMOVES a marker that ends the document with the blank line above it, so no trailing blank '
        + 'pair is left, and REMOVES a marker that is the whole body',
      fn: async () => {
        expect(stripStubMarkers({ text: 'Body.\n\n(To-Do)\n', },).text,).toBe('Body.\n',);
        expect(stripStubMarkers({ text: '---\nname: X\n---\n\nTBD\n', },).text,).toBe('---\nname: X\n---\n',);
        expect(stripStubMarkers({ text: '(To-Do)', },).text,).toBe('',);
      },
    },),
  ],
},);

await describe({
  name: passArchiveText.name,
  children: [
    it({
      name: 'FOLDS invisible variants first and STRIPS the marker second, so a marker spelled with a '
        + 'non-breaking hyphen still goes',
      fn: async () => {
        const archive = passArchiveText({
          text: 'Before.\n\n(To‑Do)\n\nnon‑binary after.\n',
          l: tagged({ tag: 'archive-stub-test', },),
        },);
        expect(archive,).toBe('Before.\n\nnon-binary after.\n',);
      },
    },),
  ],
},);
