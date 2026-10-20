/**
 Tests for the notes between translators: which comments they are, how a text
 is shown without them, and which of an archive's a page lacks. The shapes are
 the ones the pinned archives carry (a note ending a sentence, a note on lines
 of its own, a multi-line glossary, a JSX note, a note the original repeats).
 Fixtures are cat-themed invention only.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  archiveNotesMissingFrom,
  translatorsNotesIn,
  withoutTranslatorsNotes,
} from '../dist/final/node/index.mjs';

/**
 A note ending a sentence, as XingZ60 slice 6's does.
 */
const TRAILING = '<!-- 前面这句猫话懂什么意思，先这么翻译，大家看一下 -->';

await describe({
  name: '',
  children: [
    describe({
      name: translatorsNotesIn.name,
      children: [
        it({
          name: 'FINDS a closed HTML comment and a closed JSX comment whose words hold Han, with their offsets',
          fn: async () => {
            const text = `The cat slept. ${TRAILING}\n\nIt purred. {/* 这句不知道如何翻译 */}\n`;
            const notes = translatorsNotesIn({ text, },);
            expect(notes.map(function textOf(note,): string {
              return note.text;
            },),).toEqual([TRAILING, '{/* 这句不知道如何翻译 */}',],);
            expect(text.slice(notes[0]?.startOffset, notes[0]?.endOffset,),).toBe(TRAILING,);
          },
        },),
        it({
          name: 'LEAVES a comment in English, a contributor credit the archive translated, and an open comment',
          fn: async () => {
            expect(translatorsNotesIn({ text: 'Mew. <!-- Contributor: Cat Friend -->', },),).toEqual([],);
            expect(translatorsNotesIn({ text: 'Mew. <!-- 猫的备注，没有结尾', },),).toEqual([],);
            expect(translatorsNotesIn({ text: 'Mew. {/* 猫的备注，没有结尾', },),).toEqual([],);
          },
        },),
        it({
          name: 'READS a multi-line glossary as one note, and a JSX note after it',
          fn: async () => {
            const glossary = '<!-- 猫窝：Cat Bed\n\n逗猫棒：Cat Teaser -->';
            const notes = translatorsNotesIn({ text: `Mew.\n\n${glossary}\n\nPurr. {/* 注 */}`, },);
            expect(notes.map(function textOf(note,): string {
              return note.text;
            },),).toEqual([glossary, '{/* 注 */}',],);
          },
        },),
      ],
    },),

    describe({
      name: withoutTranslatorsNotes.name,
      children: [
        it({
          name: 'CUTS a note ending a sentence with the space before it',
          fn: async () => {
            expect(withoutTranslatorsNotes({ text: `The cat slept. ${TRAILING}`, },),).toBe('The cat slept.',);
            expect(withoutTranslatorsNotes({ text: `The cat slept. ${TRAILING} \nIt purred.`, },),).toBe(
              'The cat slept.\nIt purred.',
            );
          },
        },),
        it({
          name: 'CUTS a note alone on its lines with the lines, so no blank line splits a paragraph',
          fn: async () => {
            expect(withoutTranslatorsNotes({ text: `The cat slept.\n${TRAILING}\nIt purred.\n`, },),).toBe(
              'The cat slept.\nIt purred.\n',
            );
            expect(withoutTranslatorsNotes({ text: `The cat slept.\n\n${TRAILING}\n\nIt purred.\n`, },),).toBe(
              'The cat slept.\n\n\nIt purred.\n',
            );
            expect(withoutTranslatorsNotes({ text: `The cat slept.\n${TRAILING}`, },),).toBe('The cat slept.\n',);
          },
        },),
        it({
          name: 'CUTS a note between words with one of the two spaces around it, and every note of a text',
          fn: async () => {
            expect(withoutTranslatorsNotes({ text: `The ${TRAILING} cat slept.`, },),).toBe('The cat slept.',);
            expect(withoutTranslatorsNotes({ text: `A ${TRAILING} cat {/* 注 */}`, },),).toBe('A cat',);
          },
        },),
        it({
          name: 'KEEPS a comment the original carries, in Han or not, and returns a text with no note as it is',
          fn: async () => {
            const original = '猫睡了。<!-- 猫窝：Cat Bed -->';
            const text = `The cat slept. <!-- 猫窝：Cat Bed --> ${TRAILING}`;
            expect(withoutTranslatorsNotes({ text, original, },),).toBe('The cat slept. <!-- 猫窝：Cat Bed -->',);
            expect(withoutTranslatorsNotes({ text: 'The cat slept. <!-- Cat Bed -->', original, },),).toBe(
              'The cat slept. <!-- Cat Bed -->',
            );
          },
        },),
      ],
    },),

    describe({
      name: archiveNotesMissingFrom.name,
      children: [
        it({
          name: 'NAMES the archive\'s notes the page lacks, in archive order, and none the page repeats',
          fn: async () => {
            const archive = `The cat slept. ${TRAILING}\n\n<!-- 猫窝：Cat Bed -->`;
            const missing = archiveNotesMissingFrom({ archive, page: `The cat napped. ${TRAILING}`, },);
            expect(missing.map(function textOf(note,): string {
              return note.text;
            },),).toEqual(['<!-- 猫窝：Cat Bed -->',],);
            expect(archiveNotesMissingFrom({ archive, page: archive, },),).toEqual([],);
          },
        },),
        it({
          name: 'COUNTS a note the page re-wrapped across lines as carried',
          fn: async () => {
            const archive = 'Mew. <!-- 猫窝：Cat Bed 逗猫棒：Cat Teaser -->';
            expect(archiveNotesMissingFrom({ archive, page: 'Mew.\n\n<!-- 猫窝：Cat Bed\n  逗猫棒：Cat Teaser -->', },),).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);
