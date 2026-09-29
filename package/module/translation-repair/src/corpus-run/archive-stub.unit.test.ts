/**
 Tests the stub-marker strip the archive passes through before preparation.
 
 THE CASE IS ONE ARCHIVE: a page that is front matter, `(To-Do)`, an HTML
 comment of translator hints and nothing else, which the pipeline published
 with the marker standing over a finished translation. Here the marker goes
 with one blank line, the comment and the front matter stay byte for byte,
 and a marker inside a comment, a code fence, front matter or a sentence is
 left alone.
 
 Cat-themed invention throughout; no corpus content appears here.
 
 @module
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
  stripStubMarkersWithOrigins,
} from '../../dist/final/node/index.mjs';

/**
 A stub archive opening shaped as the corpus stores one.
 */
const STUB_OPENING = [
  '---',
  'name: Juzi Orange',
  'info:',
  '    alias: Juzi',
  '---',
  '',
  '(To-Do)',
  '',
  '<!-- 翻译提示：',
  '',
  '这篇文章偶尔用猫的口吻。',
  '',
  '-->',
  '<!-- 猫爬架：Cat Tree -->',
  '',
  '## Experience',
  '',
].join('\n',);

/**
 The same opening with the marker and its blank gone.
 */
const STUB_STRIPPED = [
  '---',
  'name: Juzi Orange',
  'info:',
  '    alias: Juzi',
  '---',
  '',
  '<!-- 翻译提示：',
  '',
  '这篇文章偶尔用猫的口吻。',
  '',
  '-->',
  '<!-- 猫爬架：Cat Tree -->',
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
    it({
      name: 'READS a placeholder in blockquote markers or a code span as a marker (ledger A1: one archive '
        + 'writes a nested blockquote of inline code saying Under Construction where the original has a heading)',
      fn: async () => {
        for (const paragraph of [
          '>>> `Under Construction`',
          '> Under Construction',
          '> > (WIP)',
          '`TODO`',
        ]) {
          expect(isStubMarkerParagraph({ paragraph, },),).toBe(true,);
        }
        for (const paragraph of [
          '> The tabby\'s house was under construction all spring.',
          '>>> ``',
          '>',
          '``TODO``',
          '> To be continued!',
        ]) {
          expect(isStubMarkerParagraph({ paragraph, },),).toBe(false,);
        }
      },
    },),
  ],
},);

await describe({
  name: stripStubMarkersWithOrigins.name,
  children: [
    it({
      name: 'REMOVES the stub marker with its following blank line and KEEPS the front matter and the '
        + 'comments byte for byte',
      fn: async () => {
        const { text, stripped, } = stripStubMarkersWithOrigins({ text: STUB_OPENING, },);
        expect(text,).toBe(STUB_STRIPPED,);
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
          const { text: kept, stripped, } = stripStubMarkersWithOrigins({ text, },);
          expect(kept,).toBe(text,);
          expect(stripped,).toEqual([],);
        }
      },
    },),
    it({
      name: 'REMOVES a marker that ends the document with the blank line above it, so no trailing blank '
        + 'pair is left, and REMOVES a marker that is the whole body',
      fn: async () => {
        expect(stripStubMarkersWithOrigins({ text: 'Body.\n\n(To-Do)\n', },).text,).toBe('Body.\n',);
        expect(stripStubMarkersWithOrigins({ text: '---\nname: X\n---\n\nTBD\n', },).text,).toBe('---\nname: X\n---\n',);
        expect(stripStubMarkersWithOrigins({ text: '(To-Do)', },).text,).toBe('',);
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
