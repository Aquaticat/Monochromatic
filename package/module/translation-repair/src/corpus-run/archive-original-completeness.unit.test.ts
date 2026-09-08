/**
 * Tests for the publication guard that keeps a sealed span as the archive has
 * it.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ArchiveOriginalCompletenessError,
  assertArchiveOriginalComplete,
} from '../../dist/final/node/index.mjs';

/**
 * Archive with a sealed letter.
 */
const ARCHIVE = 'Intro.\n\n<!-- note -->\n\n> I am never gone,\n\nTime to sleep friends.\n';

/**
 * The sealed span: from the note's end to the archive's end.
 */
const SPAN = {
  startOffset: ARCHIVE.indexOf('-->',) + '-->'.length,
  endOffset: ARCHIVE.length,
  note: 'note',
};

await describe({
  name: assertArchiveOriginalComplete.name,
  children: [
    it({
      name: 'passes a page carrying the sealed bytes verbatim, wherever the slices before them moved',
      fn: async () => {
        expect(function guard(): void {
          assertArchiveOriginalComplete({
            entryId: 'hakureico',
            archiveText: ARCHIVE,
            pageText: ARCHIVE.replace(
              'Intro.',
              'A longer introduction than the archive had.',
            ),
            spans: [ SPAN, ],
          },);
        },).not
          .toThrow();
      },
    },),

    it({
      name: 'passes with nothing sealed',
      fn: async () => {
        expect(function guard(): void {
          assertArchiveOriginalComplete({
            entryId: 'hakureico',
            archiveText: ARCHIVE,
            pageText: 'Anything.\n',
            spans: [],
          },);
        },).not
          .toThrow();
      },
    },),

    it({
      name: 'refuses a page whose sealed span was reworded, naming the entry and the span',
      fn: async () => {
        expect(function guard(): void {
          assertArchiveOriginalComplete({
            entryId: 'hakureico',
            archiveText: ARCHIVE,
            pageText: ARCHIVE.replace(
              'I am never gone,',
              'I am never really gone,',
            ),
            spans: [ SPAN, ],
          },);
        },).toThrow(ArchiveOriginalCompletenessError,);
        expect(function guard(): void {
          assertArchiveOriginalComplete({
            entryId: 'hakureico',
            archiveText: ARCHIVE,
            pageText: 'Nothing of it.\n',
            spans: [ SPAN, ],
          },);
        },).toThrow('entry hakureico page does not carry archive-original span 0',);
      },
    },),
  ],
},);
