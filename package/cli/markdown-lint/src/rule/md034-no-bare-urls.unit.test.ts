import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { applyFixes, } from '../fix.ts';
import { runRules, } from '../lint.ts';
import type { Diagnostic, } from '../types.ts';
import { noBareUrls, } from './md034-no-bare-urls.ts';

/**
 * Run only MD034 over Markdown or MDX source.
 *
 * @param source - Markdown source
 *
 * @param mdx - whether to parse as MDX
 *
 * @returns diagnostics from the rule
 */
function lint(source: string, mdx = false,): readonly Diagnostic[] {
  return runRules({
    rules: [noBareUrls,],
    source,
    mdx,
  },);
}

await describe({
  name: 'MD034 no-bare-urls',
  children: [
    it({
      name: 'flags a bare http(s) URL',
      fn: async function bareUrl() {
        expect(lint('See https://example.com for details.\n',).length,).toBe(1,);
      },
    },),
    it({
      name: 'allows an autolinked URL',
      fn: async function autolink() {
        expect(lint('See <https://example.com> for details.\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'allows an inline link',
      fn: async function inline() {
        expect(lint('See [the site](https://example.com) for details.\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'fix wraps the bare URL in angle brackets and is idempotent',
      fn: async function wraps() {
        /**
         * Source after wrapping the bare URL.
         */
        const fixed = applyFixes({
          source: 'Go to https://example.com now.\n',
          diagnostics: lint('Go to https://example.com now.\n',),
        },);
        expect(fixed,).toBe('Go to <https://example.com> now.\n',);
        expect(lint(fixed,).length,).toBe(0,);
      },
    },),
    it({
      name: 'fix uses an inline link in MDX and is idempotent',
      fn: async function wrapsMdx() {
        /**
         * Bare MDX URL source.
         */
        const source = 'Go to https://example.com now.\n';
        /**
         * Source after converting the bare URL to an MDX-safe inline link.
         */
        const fixed = applyFixes({
          source,
          diagnostics: lint(source, true,),
        },);
        expect(fixed,).toBe('Go to [https://example.com](<https://example.com>) now.\n',);
        expect(lint(fixed, true,).length,).toBe(0,);
      },
    },),
  ],
},);
