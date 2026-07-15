import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { runRules, } from '../lint.ts';
import type { Diagnostic, } from '../types.ts';
import { noDuplicateHeading, } from './md024-no-duplicate-heading.ts';

/**
 * Run only MD024 over Markdown source.
 *
 * @param source - Markdown source
 *
 * @returns diagnostics from the rule
 */
function lint(source: string,): readonly Diagnostic[] {
  return runRules({
    rules: [noDuplicateHeading,],
    source,
    mdx: false,
  },);
}

await describe({
  name: 'MD024 no-duplicate-heading',
  children: [
    it({
      name: 'flags duplicate sibling headings',
      fn: async function duplicateSiblings() {
        expect(lint('## Setup\n\n## Setup\n',).length,).toBe(1,);
      },
    },),
    it({
      name: 'allows duplicate text under different parents',
      fn: async function differentParents() {
        expect(lint([
          '# A',
          '',
          '## Notes',
          '',
          '# B',
          '',
          '## Notes',
          '',
        ].join('\n',),).length,).toBe(0,);
      },
    },),
    it({
      name: 'allows distinct sibling headings',
      fn: async function distinct() {
        expect(lint('## One\n\n## Two\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'flags duplicate siblings under the same parent',
      fn: async function sameParent() {
        expect(lint([
          '# Parent',
          '',
          '## Child',
          '',
          '## Child',
          '',
        ].join('\n',),).length,).toBe(1,);
      },
    },),
  ],
},);
