import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { runRules, } from '../lint.ts';
import type { Diagnostic, } from '../types.ts';
import { headingIncrement, } from './md001-heading-increment.ts';

/**
 * Run only MD001 over Markdown source.
 *
 * @param source - Markdown source
 *
 * @returns diagnostics from the rule
 */
function lint(source: string,): readonly Diagnostic[] {
  return runRules({
    rules: [headingIncrement,],
    source,
    mdx: false,
  },);
}

await describe({
  name: 'MD001 heading-increment',
  children: [
    it({
      name: 'passes when headings increment by one',
      fn: async function increments() {
        expect(lint('# A\n\n## B\n\n### C\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'flags a skipped level',
      fn: async function skips() {
        /**
         * Diagnostics for an h1 followed by an h3.
         */
        const diagnostics = lint('# A\n\n### C\n',);
        expect(diagnostics.length,).toBe(1,);
        expect(nonNullishOrThrow(diagnostics[0],).line,).toBe(3,);
      },
    },),
    it({
      name: 'allows decrements',
      fn: async function decrements() {
        expect(lint('## A\n\n# B\n\n## C\n',).length,).toBe(0,);
      },
    },),
  ],
},);
