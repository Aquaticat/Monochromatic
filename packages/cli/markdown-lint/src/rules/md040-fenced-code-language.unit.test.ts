import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { runRules, } from '../lint.ts';
import type { Diagnostic, } from '../types.ts';
import { fencedCodeLanguage, } from './md040-fenced-code-language.ts';

/**
 * Run only MD040 over Markdown source.
 *
 * @param source - Markdown source
 *
 * @returns diagnostics from the rule
 */
function lint(source: string,): readonly Diagnostic[] {
  return runRules({
    rules: [fencedCodeLanguage,],
    source,
    mdx: false,
  },);
}

await describe({
  name: 'MD040 fenced-code-language',
  children: [
    it({
      name: 'flags a fenced block with no language',
      fn: async function unlabeled() {
        expect(lint('```\nplain\n```\n',).length,).toBe(1,);
      },
    },),
    it({
      name: 'passes a fenced block with a language',
      fn: async function labeled() {
        expect(lint('```ts\nconst a = 1;\n```\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'ignores indented code blocks',
      fn: async function indented() {
        expect(lint('Paragraph.\n\n    indented code line\n',).length,).toBe(0,);
      },
    },),
  ],
},);
