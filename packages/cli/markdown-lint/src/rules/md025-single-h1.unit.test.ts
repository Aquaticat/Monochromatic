import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { runRules, } from '../lint.ts';
import type { Diagnostic, } from '../types.ts';
import { singleH1, } from './md025-single-h1.ts';

/**
 * Run only MD025 over Markdown source.
 *
 * @param source - Markdown source
 *
 * @returns diagnostics from the rule
 */
function lint(source: string,): readonly Diagnostic[] {
  return runRules({
    rules: [singleH1,],
    source,
    mdx: false,
  },);
}

await describe({
  name: 'MD025 single-h1',
  children: [
    it({
      name: 'passes with a single top-level heading',
      fn: async function single() {
        expect(lint('# Title\n\n## Section\n\n## Another\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'flags a second top-level heading',
      fn: async function second() {
        /**
         * Diagnostics for two level-1 headings.
         */
        const diagnostics = lint('# First\n\n# Second\n',);
        expect(diagnostics.length,).toBe(1,);
        expect(nonNullishOrThrow(diagnostics[0],).line,).toBe(3,);
      },
    },),
  ],
},);
