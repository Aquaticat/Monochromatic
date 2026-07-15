import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { applyFixes, } from '../fix.ts';
import { runRules, } from '../lint.ts';
import type { Diagnostic, } from '../types.ts';
import { referenceDefinitions, } from './md053-reference-definitions.ts';

/**
 * Run only MD053 over Markdown source.
 *
 * @param source - Markdown source
 *
 * @returns diagnostics from the rule
 */
function lint(source: string,): readonly Diagnostic[] {
  return runRules({
    rules: [referenceDefinitions,],
    source,
    mdx: false,
  },);
}

/**
 * A used definition, an unused definition, and a duplicate of the used one.
 */
const SOURCE = [
  'See [the docs][ref].',
  '',
  '[ref]: https://example.com/a',
  '[unused]: https://example.com/b',
  '[ref]: https://example.com/c',
  '',
].join('\n',);

await describe({
  name: 'MD053 reference-definitions',
  children: [
    it({
      name: 'flags unused and duplicate definitions',
      fn: async function flagsBoth() {
        expect(lint(SOURCE,).length,).toBe(2,);
      },
    },),
    it({
      name: 'allows a single used definition',
      fn: async function allowsUsed() {
        expect(lint('See [docs][ref].\n\n[ref]: https://example.com\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'fix removes the unused and duplicate definitions, keeping the first used one',
      fn: async function fixRemoves() {
        /**
         * Source after removing flagged definitions.
         */
        const fixed = applyFixes({
          source: SOURCE,
          diagnostics: lint(SOURCE,),
        },);
        expect(fixed.includes('[unused]:',),).toBe(false,);
        expect(fixed.includes('example.com/c',),).toBe(false,);
        expect(fixed.includes('[ref]: https://example.com/a',),).toBe(true,);
        expect(lint(fixed,).length,).toBe(0,);
      },
    },),
  ],
},);
