/**
 * Tests the notes an entry carries, rendered as identity-context lines.
 *
 * THE CASES ARE THE CORPUS'S: XIEPT2's one source footnote and its archive of
 * seventeen editor comments (a translation hint and a glossary), yulianNyanner's
 * comment glossary, and a multi-line definition that must fold onto one line.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  commentBody,
  commentNoteLines,
  entryNoteLines,
  foldedLine,
  footnoteNoteLines,
  parseDocument,
} from '../dist/final/node/index.mjs';

/**
 * Original carrying one footnote and one comment.
 */
const SOURCE_TEXT = '---\nname: 葡萄\n---\n\n她做代购[^1]。\n\n<!-- 起床战争：Bed Wars -->\n\n[^1]: 意为个人「代购」境外漫画书籍\n';

/**
 * Archive carrying a multi-line comment and a two-line footnote.
 */
const TARGET_TEXT = '---\nname: Putao\n---\n\n<!-- 翻译提示：\n\n这篇文章有时候是作者视角。 -->\n\nShe ran a buying service[^1].\n\n[^1]: A personal buying service\n    for comics from abroad.\n';

await describe({
  name: foldedLine.name,
  children: [
    it({
      name: 'FOLDS every run of whitespace to one space and trims the ends, so a note stays one line',
      fn: async () => {
        expect(foldedLine({ text: '  [^1]: first\n    second\t third  ', },),).toBe('[^1]: first second third',);
        expect(foldedLine({ text: '\n \n', },),).toBe('',);
      },
    },),
  ],
},);

await describe({
  name: commentBody.name,
  children: [
    it({
      name: 'STRIPS the delimiters and keeps the tail of an unterminated comment',
      fn: async () => {
        expect(commentBody({ comment: '<!-- 起床战争：Bed Wars -->', },),).toBe(' 起床战争：Bed Wars ',);
        expect(commentBody({ comment: '<!-- never closed', },),).toBe(' never closed',);
      },
    },),
  ],
},);

await describe({
  name: entryNoteLines.name,
  children: [
    it({
      name: 'LABELS footnotes and comments by side and kind, footnotes first, the original before the '
        + 'archive, each folded onto one line',
      fn: async () => {
        /**
         * Both sides parsed as preparation parses them.
         */
        const sourceDocument = parseDocument({ text: SOURCE_TEXT, },);
        /**
         * Archive side.
         */
        const targetDocument = parseDocument({ text: TARGET_TEXT, },);
        expect(entryNoteLines({
          sourceDocument,
          targetDocument,
        },),).toEqual([
          '- ORIGINAL note: [^1]: 意为个人「代购」境外漫画书籍',
          '- ARCHIVE note: [^1]: A personal buying service for comics from abroad.',
          '- ORIGINAL editor comment: 起床战争：Bed Wars',
          '- ARCHIVE editor comment: 翻译提示： 这篇文章有时候是作者视角。',
        ],);
      },
    },),

    it({
      name: 'EMITS NOTHING for documents carrying neither a footnote nor a comment, and no line for an '
        + 'empty comment',
      fn: async () => {
        /**
         * Plain pair.
         */
        const plain = parseDocument({ text: '毛毛很可爱。\n', },);
        expect(entryNoteLines({
          sourceDocument: plain,
          targetDocument: parseDocument({ text: 'Mittens is adorable.\n', },),
        },),).toEqual([],);
        expect(commentNoteLines({
          document: parseDocument({ text: 'Body.\n\n<!-- -->\n', },),
          side: 'ARCHIVE',
        },),).toEqual([],);
        expect(footnoteNoteLines({
          document: plain,
          side: 'ORIGINAL',
        },),).toEqual([],);
      },
    },),
  ],
},);
