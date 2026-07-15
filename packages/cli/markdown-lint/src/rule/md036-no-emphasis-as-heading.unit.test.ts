import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { runRules, } from '../lint.ts';
import type { Diagnostic, } from '../types.ts';
import { noEmphasisAsHeading, } from './md036-no-emphasis-as-heading.ts';

/**
 * Run only MD036 over Markdown source.
 *
 * @param source - Markdown source
 *
 * @returns diagnostics from the rule
 */
function lint(source: string,): readonly Diagnostic[] {
  return runRules({
    rules: [noEmphasisAsHeading,],
    source,
    mdx: false,
  },);
}

await describe({
  name: 'MD036 no-emphasis-as-heading',
  children: [
    it({
      name: 'flags a paragraph that is only strong text',
      fn: async function strongHeading() {
        expect(lint('**Section title**\n',).length,).toBe(1,);
      },
    },),
    it({
      name: 'flags a paragraph that is only emphasized text',
      fn: async function emphasisHeading() {
        expect(lint('*Another section*\n',).length,).toBe(1,);
      },
    },),
    it({
      name: 'allows emphasized text ending in punctuation',
      fn: async function sentence() {
        expect(lint('**Note:**\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'allows emphasis that is not the whole paragraph',
      fn: async function inline() {
        expect(lint('This is **important** text.\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'allows strong-only list item labels',
      fn: async function listLabel() {
        expect(lint('1. **CSS Nesting**\n',).length,).toBe(0,);
      },
    },),
  ],
},);
