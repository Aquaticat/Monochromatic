import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  applyFixes,
  commandsShowOutput,
  type Diagnostic,
  runRules,
} from '../../dist/final/node/index.mjs';

/**
 * Run only MD014 over Markdown source.
 *
 * @param source - Markdown source
 *
 * @returns diagnostics from the rule
 */
function lint(source: string,): readonly Diagnostic[] {
  return runRules({
    rules: [commandsShowOutput,],
    source,
    mdx: false,
  },);
}

/**
 * Fenced shell block of prompts with no shown output.
 */
const PROMPTS_ONLY = [
  '```sh',
  '$ ls',
  '$ cd /tmp',
  '```',
  '',
].join('\n',);

await describe({
  name: 'MD014 commands-show-output',
  children: [
    it({
      name: 'flags a block of only shell prompts',
      fn: async function promptsOnly() {
        expect(lint(PROMPTS_ONLY,).length,).toBe(1,);
      },
    },),
    it({
      name: 'allows a block that interleaves output',
      fn: async function withOutput() {
        expect(lint([
          '```sh',
          '$ ls',
          'file.txt',
          '```',
          '',
        ].join('\n',),).length,).toBe(0,);
      },
    },),
    it({
      name: 'fix strips the prompts and is idempotent',
      fn: async function stripsPrompts() {
        /**
         * Source after stripping the prompts.
         */
        const fixed = applyFixes({
          source: PROMPTS_ONLY,
          diagnostics: lint(PROMPTS_ONLY,),
        },);
        expect(fixed,).toBe([
          '```sh',
          'ls',
          'cd /tmp',
          '```',
          '',
        ].join('\n',),);
        expect(lint(fixed,).length,).toBe(0,);
      },
    },),
  ],
},);
