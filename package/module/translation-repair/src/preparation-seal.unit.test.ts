/**
 * Tests for the seal as the preparation applies it: a span the archive's note
 * calls the English original reaches no slice, is recorded on the
 * preparation, and is named in a finding.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  parseDocument,
  prepareDocumentPair,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * hakureico's note above the letter.
 */
const SPAN_NOTE = '这段话以下全部，包括结尾的两句祝愿，原文都是英文，中文是反向翻译的，请仅修可能造成误解或明显的非刻意语法错误，不大修';

/**
 * Original: an intro, the back-translated letter and closing, and a footnote
 * definition the archive never rendered.
 */
const SOURCE_TEXT = '## 千歌的信\n\n千歌给她的朋友留下了一封信：\n\n> 我其实未曾离去\n>\n> 只是换了地方\n\n'
  + '是时候说晚安了，愿大家都能保持微笑。\n\n[^1]: 即 Google App Engine\n';

/**
 * Archive: the intro, the note, the English letter and closing.
 */
const TARGET_TEXT = '## Her Letter\n\nHanasaka left a letter for her only friend:\n\n'
  + `<!-- ${SPAN_NOTE}-->\n\n> I am never gone,\n>\n> Just changed where I live,\n\nTime to sleep friends, and keep smiling.\n`;

//endregion Fixtures

await describe({
  name: `${prepareDocumentPair.name} sealing`,
  children: [
    it({
      name: 'keeps the sealed blocks out of every slice, records the span and names it in a finding when asked '
        + 'to seal, and slices everything when not asked',
      fn: async () => {
        /**
         * Sealed preparation.
         */
        const sealed = prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          sealArchiveOriginal: true,
        },);
        /**
         * Archive blocks the seal should cover: the letter and the closing.
         */
        const archive = parseDocument({ text: TARGET_TEXT, },);
        const sealedIds = archive.nodes
          .filter(function isBelowNote(node,): boolean {
            return node.startOffset > TARGET_TEXT.indexOf('-->',);
          },)
          .map(function toId(node,): string {
            return node.id;
          },);
        expect(sealedIds.length,).toBe(2,);
        /**
         * Every archive block id the slices carry.
         */
        const slicedTargetIds = sealed.slices
          .flatMap(function toIds(slice,): readonly string[] {
            return slice.target
              .nodes
              .map(function toId(node,): string {
                return node.id;
              },);
          },);
        for (const id of sealedIds)
          expect(slicedTargetIds,).not
            .toContain(id,);
        expect(sealed.archiveOriginalSpans?.length,).toBe(1,);
        expect(sealed.archiveOriginalSpans?.[0]?.note,).toBe(SPAN_NOTE,);
        expect(sealed.alignmentFindings
          .some(function namesSeal(finding,): boolean {
            return finding.includes('archive-original',);
          },),).toBe(true,);
        expect(sealed.unclaimedTargetBlocks
          .some(function isSealed(block,): boolean {
            return sealedIds.includes(block.blockId,);
          },),).toBe(false,);

        /**
         * The same pair, unsealed.
         */
        const open = prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
        },);
        expect(open.archiveOriginalSpans,).toBeUndefined();
        /**
         * Every archive block id the open slices carry.
         */
        const openTargetIds = open.slices
          .flatMap(function toIds(slice,): readonly string[] {
            return slice.target
              .nodes
              .map(function toId(node,): string {
                return node.id;
              },);
          },);
        for (const id of sealedIds)
          expect(openTargetIds,).toContain(id,);
      },
    },),

    it({
      name: 'records nothing on an archive with no such note, sealed or not',
      fn: async () => {
        /**
         * Archive without the note.
         */
        const plain = TARGET_TEXT.replace(
          `<!-- ${SPAN_NOTE}-->\n\n`,
          '',
        );
        expect(prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: plain,
          sealArchiveOriginal: true,
        },).archiveOriginalSpans,).toBeUndefined();
      },
    },),
  ],
},);
