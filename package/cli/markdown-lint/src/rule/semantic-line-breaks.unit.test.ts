import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { fixSource, } from '../fix.ts';
import { runRules, } from '../lint.ts';
import { semanticLineBreaks, } from './semantic-line-breaks.ts';

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
