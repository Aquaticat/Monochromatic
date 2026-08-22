import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  applyFixes,
  type Diagnostic,
  linkImageStyle,
  runRules,
} from '../../dist/final/node/index.mjs';

/**
 * Run only MD054 over Markdown source.
 *
 * @param source - Markdown source
 *
 * @returns diagnostics from the rule
 */
function lint(source: string,): readonly Diagnostic[] {
  return runRules({
    rules: [linkImageStyle,],
    source,
    mdx: false,
  },);
}

await describe({
  name: 'MD054 link-image-style',
  children: [
    it({
      name: 'flags a shortcut reference link',
      fn: async function shortcut() {
        expect(lint('See [the docs].\n\n[the docs]: https://example.com\n',).length,).toBe(1,);
      },
    },),
    it({
      name: 'allows collapsed and full reference styles',
      fn: async function allowed() {
        expect(lint('See [the docs][] and [more][the docs].\n\n[the docs]: https://example.com\n',).length,)
          .toBe(0,);
      },
    },),
    it({
      name: 'fix converts a shortcut reference to collapsed and is idempotent',
      fn: async function convertsToCollapsed() {
        /**
         * Source whose shortcut reference is converted by the fix.
         */
        const source = 'See [the docs].\n\n[the docs]: https://example.com\n';
        /**
         * Source after the fix.
         */
        const fixed = applyFixes({
          source,
          diagnostics: lint(source,),
        },);
        expect(fixed.includes('[the docs][]',),).toBe(true,);
        expect(lint(fixed,).length,).toBe(0,);
      },
    },),
  ],
},);
