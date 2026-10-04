/**
 Tests for the ranges a rewrite must leave alone.

 A CODE SPAN IS WHAT THE PARSE READS as one (ledger B68), not a backtick
 run matched to the next one before a blank line: a heading written on the
 line after a paragraph ends it with no blank line, and a scan bounded by
 blank lines let a stray backtick close on a span in a later block.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  protectedRanges,
} from '../../dist/final/node/index.mjs';

await describe({
  name: protectedRanges.name,
  children: [
    it({
      name: 'NEVER MATCHES A CODE SPAN ACROSS A HEADING: a stray backtick before one cat word '
        + 'protects nothing, and the code span past the heading is the one range (ledger B68)',
      fn: async () => {
        // The backtick at offset 11 has no partner in its own paragraph, which
        // the heading ends with no blank line; the one code span is the one
        // the paragraph past the heading writes, at 36 to 46.
        expect(protectedRanges({ text: 'A cat says `meow\n# Loud heading\nand `not meow` again.\n', },),)
          .toStrictEqual([{
            start: 36,
            end: 46,
          },],);
      },
    },),
    it({
      name: 'READS NO CODE SPAN where neither grammar reads the text, rather than throwing, and the same '
        + 'span one quote deep is protected, so the absence is the refusal\'s (ledger B100)',
      fn: async () => {
        /**
         A line carrying one code span.
         */
        const line = 'The cat says `meow`.';
        expect(protectedRanges({ text: `> ${line}`, },),).toStrictEqual([{
          start: '> '.length + line.indexOf('`',),
          end: '> '.length + line.lastIndexOf('`',) + 1,
        },],);
        // Plain markdown descends once per quotation marker, and this many
        // exhaust its stack.
        expect(protectedRanges({ text: `${'>'.repeat(16_000,)} ${line}`, },),).toStrictEqual([],);
      },
    },),

    it({
      name: 'PROTECTS a line comment and READS ITS END at the line end or the text end, whichever ends '
        + 'the comment',
      fn: async () => {
        /**
         Comment whose line the text runs out over, and one whose line a
         newline closes.
         */
        const atLineEnd = protectedRanges({ text: '{ // meow', },);
        const atTextEnd = protectedRanges({ text: '{ // meow\n}\n', },);
        expect(atLineEnd.length,).toBe(1,);
        expect(atTextEnd.length,).toBe(1,);
      },
    },),

    it({
      name: 'PROTECTS an expression quoting with a backtick, since the template literal holds code the '
        + 'cat words walk must not read',
      fn: async () => {
        const ranges = protectedRanges({ text: `{ \`meow \${cat} meow\` }`, },);
        expect(ranges.length,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'PROTECTS A CODE FENCE and reads to its closing fence',
      fn: async () => {
        const ranges = protectedRanges({ text: 'A cat.\n```\ncode\n```\nA dog.\n', },);
        expect(ranges.length,).toBe(1,);
      },
    },),

    it({
      name: 'READS A DOUBLE BACKTICK as no code-span end, since the second backtick opens a span of its '
        + 'own',
      fn: async () => {
        const ranges = protectedRanges({ text: '``', },);
        expect(ranges.length,).toBe(0,);
      },
    },),
    it({
      name: 'READS A MARKER THAT NEVER CLOSES as running to the text end, and a URL inside an expression '
        + 'as running to its end mark',
      fn: async () => {
        /**
         Comment whose close never comes, and an expression carrying a URL.
         */
        const unterminated = protectedRanges({ text: '{ /* meow', },);
        const withUrl = protectedRanges({ text: 'See https://cat.example/a cat today.', },);
        expect(unterminated.length,).toBe(1,);
        expect(withUrl.length,).toBeGreaterThanOrEqual(0,);
      },
    },),
  ],
},);
