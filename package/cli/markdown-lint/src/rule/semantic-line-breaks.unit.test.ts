import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { fixSource, } from '../fix.ts';
import { runRules, } from '../lint.ts';
import { semanticLineBreaks, } from './semantic-line-breaks.ts';

/**
 * One diagnostic as `runRules` reports it.
 */
type ReportedDiagnostic = ReturnType<typeof runRules>[number];

/**
 * Count semantic-line-breaks diagnostics for a source.
 *
 * @param source - Markdown source
 *
 * @returns number of break diagnostics
 */
function count(source: string,): number {
  return runRules({
    rules: [semanticLineBreaks,],
    source,
    mdx: false,
  },).length;
}

/**
 * Report semantic-line-breaks diagnostics as `line:column` strings.
 *
 * @param source - Markdown source
 *
 * @returns reported positions, in the order found
 */
function positions(source: string,): readonly string[] {
  return runRules({
    rules: [semanticLineBreaks,],
    source,
    mdx: false,
  },).map(function positionOf(diagnostic: ReportedDiagnostic,): string {
    return `${diagnostic.line}:${diagnostic.column}`;
  },);
}

/**
 * Fix a source with only semantic-line-breaks.
 *
 * @param source - Markdown source
 *
 * @returns fixed source and remaining diagnostics
 */
function fix(source: string,): {
  readonly source: string;
  readonly diagnostics: readonly unknown[];
} {
  return fixSource({
    rules: [semanticLineBreaks,],
    source,
    mdx: false,
  },);
}

await describe({
  name: 'semantic-line-breaks',
  children: [
    it({
      name: 'breaks after each break-point character mid-clause',
      fn: async function breakPoints() {
        // Each source has one mid-clause break point plus a paragraph-final
        // period that is left alone, so each yields exactly one break.
        expect(count('left, right word.\n',),).toBe(1,);
        expect(count('first. second word.\n',),).toBe(1,);
        expect(count('left; right word.\n',),).toBe(1,);
        expect(count('left: right word.\n',),).toBe(1,);
        expect(count('really? yes word.\n',),).toBe(1,);
        expect(count('stop! go word.\n',),).toBe(1,);
      },
    },),
    it({
      name: 'leaves the paragraph-final punctuation alone',
      fn: async function tailUntouched() {
        expect(count('a single sentence here.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'skips a comma inside inline code',
      fn: async function inlineCode() {
        expect(count('use `a, b` here.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'skips break points inside a fenced code block',
      fn: async function codeBlock() {
        expect(count('```js\nconst a = 1, b = 2;\n```\n',),).toBe(0,);
      },
    },),
    it({
      name: 'skips a comma inside a link URL',
      fn: async function linkUrl() {
        expect(count('see [a](https://example.com/p,q) here.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'skips dots in an abbreviation',
      fn: async function abbreviation() {
        expect(count('this is e.g. important here.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'skips a dot in a decimal',
      fn: async function decimal() {
        expect(count('pi is 3.14 here.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'skips dots in an ellipsis',
      fn: async function ellipsis() {
        expect(count('wait... here.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'skips a comma inside a number',
      fn: async function numberComma() {
        expect(count('about 1,000 here.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'keeps a bare dotted token whole',
      fn: async function dottedToken() {
        // Every one of these was measured splitting mid-token across
        // `doc/planning/` before the word-separator guard: the extension, the
        // domain, the qualified member and the pre-release segment each start
        // straight after the dot.
        expect(count('rule AGENTS.md ITR applies here.\n',),).toBe(0,);
        expect(count('published on crates.io last week.\n',),).toBe(0,);
        expect(count('running under Node.js here.\n',),).toBe(0,);
        expect(count('the type is checker.TupleType here.\n',),).toBe(0,);
        expect(count('pinned at 9.0.0-rc.3 for now.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'breaks after a closing quote or bracket, never in front of one',
      fn: async function closingDelimiter() {
        // The sentence has not ended at the period, so a break there strands the
        // delimiter at the head of the next line with nothing to close.
        expect(fix('called "same concept." Two hosts differ here.\n',).source,)
          .toBe('called "same concept."\n Two hosts differ here.\n',);
        expect(fix('- (the user chose rules only.) Execution follows here.\n',).source
          .includes('only.)\n',),).toBe(true,);
        // Already written that way is correct, so reporting it would be a false
        // positive: the status is read from past the delimiter too.
        expect(count('called "same concept."\nTwo hosts differ here.\n',),).toBe(0,);
        // The run ends where the sentence does, so a comma outside the quote is
        // its own break point and gets its own break.
        expect(fix('asked "which rule?", and then moved on here.\n',).source
          .includes('rule?",\n and then',),).toBe(true,);
        // Nothing ends a word past the run, so nothing breaks.
        expect(count('a call to fn(arg.value) reads it here.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'still breaks when a word ends at the break-point character',
      fn: async function separatorBreaks() {
        // The guard is about what follows, not about the character itself: the
        // same period breaks once a space stands after it.
        expect(count('rule AGENTS. md ITR applies here.\n',),).toBe(1,);
        expect(count('a tab-separated one,\there.\n',),).toBe(1,);
      },
    },),
    it({
      name: 'skips a comma in a heading',
      fn: async function headingSkip() {
        expect(count('# Title, here\n\nplain prose here.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'inserts a list-item-aligned continuation prefix',
      fn: async function listPrefix() {
        /**
         * Fixed list item.
         */
        const fixed = fix('- first, second word.\n',);
        expect(fixed.source.includes('- first,\n',),).toBe(true,);
        expect(fixed.source.includes('  second',),).toBe(true,);
        expect(fixed.diagnostics.length,).toBe(0,);
      },
    },),
    it({
      name: 'inserts a blockquote continuation prefix',
      fn: async function blockquotePrefix() {
        /**
         * Fixed blockquote.
         */
        const fixed = fix('> first, second word.\n',);
        expect(fixed.source.includes('> first,\n>',),).toBe(true,);
        expect(fixed.diagnostics.length,).toBe(0,);
      },
    },),
    it({
      name: 'breaks after a bold span rather than inside its closing delimiter',
      fn: async function boldTail() {
        /**
         * Fixed definition-list item, the shape the documentation tree is full of.
         */
        const fixed = fix('- **Term.** Explanation continues.\n',);
        expect(fixed.source.includes('- **Term.**\n',),).toBe(true,);
        expect(fixed.source.includes('**Term.\n',),).toBe(false,);
        expect(fixed.diagnostics.length,).toBe(0,);
      },
    },),
    it({
      name: 'leaves a bold span alone once the break sits after it',
      fn: async function boldAlreadyBroken() {
        // The break belongs after the closing delimiter, so a document already
        // written that way is correct and reporting it is a false positive.
        expect(count('- **Term.**\n  Explanation continues.\n',),).toBe(0,);
      },
    },),
    it({
      name: 'leaves a bold span ending its paragraph alone',
      fn: async function boldParagraphTail() {
        // The paragraph's last child is the span, not the text inside it, so the
        // final punctuation has to be recognized through the delimiter.
        expect(count('**the end.**\n',),).toBe(0,);
        expect(count('a lead-in and **the end.**\n',),).toBe(0,);
        // Not simply "a span tail never breaks": the same span breaks when prose
        // follows it.
        expect(count('**the end.** and more here.\n',),).toBe(1,);
      },
    },),
    it({
      name: 'still breaks between sentences inside one bold span',
      fn: async function boldInternalBreak() {
        /**
         * Fixed multi-sentence bold run.
         */
        const fixed = fix('**First. Second.** Tail text here.\n',);
        expect(fixed.source.includes('**First.\n',),).toBe(true,);
        expect(fixed.source.includes('Second.**\n',),).toBe(true,);
        expect(fixed.diagnostics.length,).toBe(0,);
      },
    },),
    it({
      name: 'treats every break-point character the same at a span tail',
      fn: async function boldTailCharacters() {
        // One break each, after the closing delimiter rather than before it.
        expect(count('- **Term,** rest of it here.\n',),).toBe(1,);
        expect(count('- **Term;** rest of it here.\n',),).toBe(1,);
        expect(count('- **Term:** rest of it here.\n',),).toBe(1,);
        expect(count('- **Term?** rest of it here.\n',),).toBe(1,);
        expect(count('- **Term!** rest of it here.\n',),).toBe(1,);
        expect(fix('- **Term!** rest of it here.\n',).source
          .includes('**Term!**\n',),).toBe(true,);
      },
    },),
    it({
      name: 'reaches the tail through italics and through nesting',
      fn: async function emphasisTail() {
        expect(fix('- *Term.* Explanation continues.\n',).source
          .includes('*Term.*\n',),).toBe(true,);
        expect(fix('- **_Term._** Explanation continues.\n',).source
          .includes('**_Term._**\n',),).toBe(true,);
      },
    },),
    it({
      name: 'reads a CRLF line ending as a break and writes one back',
      fn: async function crlf() {
        // A `\r` read as ordinary content makes an already broken sentence look
        // unbroken, and the inserted newline then lands in front of the existing
        // one, which is a blank line and splits the paragraph in two.
        expect(count('First sentence.\r\nSecond sentence here.\r\n',),).toBe(0,);
        expect(fix('First. Second sentence here.\r\n',).source,)
          .toBe('First.\r\n Second sentence here.\r\n',);
      },
    },),
    it({
      name: 'sees an existing break however far the whitespace runs',
      fn: async function unboundedGap() {
        // The gap between a break point and the newline after it has no length
        // limit, and a lookahead that stopped short reported a break that was
        // already there, so fixing it wrote a blank line into the paragraph.
        expect(count(`First.${' '.repeat(300,)}\nSecond sentence here.\n`,),).toBe(0,);
      },
    },),
    it({
      name: 'never turns trailing spaces into a hard break',
      fn: async function hardBreak() {
        /**
         * Two spaces before an inline node, which the delimiter remap would
         * otherwise step over and leave at the end of the inserted line.
         */
        const fixed = fix('Sentence.  `code` follows here.\n',);
        expect(fixed.source.includes('  \n',),).toBe(false,);
        expect(fixed.source,).toBe('Sentence.\n  `code` follows here.\n',);
      },
    },),
    it({
      name: 'points at the break itself, not at the paragraph it sits in',
      fn: async function anchoredAtTheBreak() {
        // The offence is on the paragraph's fourth line. Anchoring at the text
        // node reported the paragraph's first line with a column past that
        // line's end, which is a position that moves whenever nearby text is
        // edited and reads exactly like feedback about the edit.
        // Column 6 is where the break goes, one past the comma, which is what
        // the message says rather than where the break-point character sits.
        expect(positions('one\ntwo\nthree\nfour, five\n',),).toEqual(['4:6',],);
        // Through a closing delimiter the anchor follows the insertion, so it
        // lands after the `**` rather than in front of it.
        expect(positions('- **Term.** Explanation continues here.\n',),)
          .toEqual(['1:12',],);
      },
    },),
    it({
      name: 'the add-only fix is clean and idempotent in one pass',
      fn: async function idempotent() {
        /**
         * First fixpoint result.
         */
        const once = fix('one, two. three word.\n',);
        expect(once.diagnostics.length,).toBe(0,);
        /**
         * Re-fixing the settled source.
         */
        const twice = fix(once.source,);
        expect(twice.source,).toBe(once.source,);
      },
    },),
  ],
},);
