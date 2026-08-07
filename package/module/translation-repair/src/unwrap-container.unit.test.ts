import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { parseDocument, } from '../dist/final/node/index.mjs';

//region Container unwrapping tests
// Fixtures are cat-themed inventions that reproduce the STRUCTURE read off the
// pinned corpus: a page that collapses a trailing gallery into one disclosure
// element against a counterpart carrying the same blocks at top level. Real
// corpus text is never reproduced here.

/**
 * Counterpart shape: blocks at top level, no disclosure wrapper.
 */
const FLAT_PAGE = `## Gallery

<PhotoScroll photos={['a.webp']} />

> Mittens napping in the sun

<PhotoScroll photos={['b.webp']} />

> Mittens demanding tuna
`;

/**
 * Same blocks, wrapped in a disclosure the way the en side wraps them.
 */
const NESTED_PAGE = `## Gallery

<details>
<summary>Original</summary>

<PhotoScroll photos={['a.webp']} />

> Mittens napping in the sun

<PhotoScroll photos={['b.webp']} />

> Mittens demanding tuna

</details>
`;

await describe({
  name: '',
  children: [
    describe({
      name: 'flattenContainers via parseDocument',
      children: [
        it({
          name: 'promotes disclosure children so a nested page matches its flat counterpart',
          fn: async () => {
            /**
             * Blocks the flat page exposes.
             */
            const { nodes: flat, } = parseDocument({ text: FLAT_PAGE, },);

            /**
             * Blocks the nested page exposes once containers flatten.
             */
            const { nodes: nested, } = parseDocument({ text: NESTED_PAGE, },);

            // The nested page carries one extra block: its summary, which the
            // flat counterpart has no equivalent for.
            expect(nested.length,).toBe(flat.length + 1,);
            expect(
              nested.filter(function isPhoto(node,) {
                return node.text
                  .includes('PhotoScroll',);
              },),
            ).toHaveLength(2,);
          },
        },),

        it({
          name: 'keeps a self-closing component whole, since it is content not packaging',
          fn: async () => {
            /**
             * Page whose only block is a childless component.
             */
            const { nodes, } = parseDocument({
              text: "<PhotoScroll photos={['a.webp']} />\n",
            },);

            expect(nodes,).toHaveLength(1,);
            expect(nodes.at(0,)
              ?.kind,).toBe('mdxJsxFlowElement',);
          },
        },),

        it({
          name: 'preserves document order when promoting',
          fn: async () => {
            /**
             * Promoted blocks must take the container's exact place.
             */
            const { nodes, } = parseDocument({ text: NESTED_PAGE, },);

            expect(nodes.at(0,)
              ?.kind,).toBe('heading',);
            expect(nodes.at(-1,)
              ?.kind,).toBe('blockquote',);
          },
        },),

        it({
          name: 'keeps promoted offsets sliceable from the original text',
          fn: async () => {
            /**
             * Every node's text must still equal its own offset slice, the
             * invariant offset-based splicing depends on.
             */
            const { nodes, } = parseDocument({ text: NESTED_PAGE, },);

            for (const node of nodes) {
              expect(
                NESTED_PAGE.slice(
                  node.startOffset,
                  node.endOffset,
                ),
              ).toBe(node.text,);
            }
          },
        },),

        it({
          name: 'leaves the disclosure tags outside every promoted span',
          fn: async () => {
            /**
             * Wrapper tags must survive as inter-block text so splicing keeps
             * the document well formed.
             */
            const { nodes, } = parseDocument({ text: NESTED_PAGE, },);

            for (const node of nodes) {
              expect(node.text,).not.toContain('<details>',);
              expect(node.text,).not.toContain('</details>',);
            }
          },
        },),

        it({
          name: 'flattens a disclosure nested inside another disclosure',
          fn: async () => {
            /**
             * The work stack re-inspects promoted children, so depth is not
             * limited to one level.
             */
            const { nodes, } = parseDocument({
              text: `<details>
<summary>Outer</summary>

<details>
<summary>Inner</summary>

> Mittens all the way down

</details>

</details>
`,
            },);

            expect(
              nodes.some(function isQuote(node,) {
                return node.kind === 'blockquote';
              },),
            ).toBe(true,);
          },
        },),
      ],
    },),
  ],
},);

//endregion Container unwrapping tests
