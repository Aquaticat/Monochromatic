import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { applyFixes, } from '../fix.ts';
import { runRules, } from '../lint.ts';
import type { Diagnostic, } from '../types.ts';
import { noTrailingPunctuation, } from './md026-no-trailing-punctuation.ts';

/**
 * Run only MD026 over Markdown source.
 *
 * @param source - Markdown source
 *
 * @returns diagnostics from the rule
 */
function lint(source: string,): readonly Diagnostic[] {
  return runRules({
    rules: [noTrailingPunctuation,],
    source,
    mdx: false,
  },);
}

await describe({
  name: 'MD026 no-trailing-punctuation',
  children: [
    it({
      name: 'flags a heading ending with a colon and offers a fix',
      fn: async function colon() {
        /**
         * Diagnostics for a heading ending in a colon.
         */
        const diagnostics = lint('# Setup:\n',);
        expect(diagnostics.length,).toBe(1,);
        expect(nonNullishOrThrow(diagnostics[0],).fix,).toBeTruthy();
      },
    },),
    it({
      name: 'allows a heading without trailing punctuation',
      fn: async function clean() {
        expect(lint('# Setup\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'allows a question mark (not in the configured set)',
      fn: async function question() {
        expect(lint('# Why?\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'fix strips the trailing punctuation and is idempotent',
      fn: async function stripsAndSettles() {
        /**
         * Heading after applying the fix.
         */
        const fixed = applyFixes({
          source: '## Configure the linter.\n',
          diagnostics: lint('## Configure the linter.\n',),
        },);
        expect(fixed,).toBe('## Configure the linter\n',);
        expect(lint(fixed,).length,).toBe(0,);
      },
    },),
    it({
      name: 'strips punctuation inside trailing emphasis',
      fn: async function insideEmphasis() {
        /**
         * Heading with punctuation inside trailing strong text, after the fix.
         */
        const fixed = applyFixes({
          source: '# **Done:**\n',
          diagnostics: lint('# **Done:**\n',),
        },);
        expect(fixed,).toBe('# **Done**\n',);
      },
    },),
  ],
},);
