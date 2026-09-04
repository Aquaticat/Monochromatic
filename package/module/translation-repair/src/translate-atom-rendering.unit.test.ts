/**
 * Tests for the pools of renderings the original and the page disagree on,
 * and the findings drawn from them.
 *
 * WHAT THESE PIN is the owner's rule of 2026-09-04: where the page rendered
 * a reference another way, a candidate owes one rendering and not both;
 * a kind that diverges one way only stays owed as an addition or a drop.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  atomFindings,
  type ProtectedAtom,
  renderingPoolsOf,
} from '../dist/final/node/index.mjs';

/**
 * Link atom for a destination.
 *
 * @param url - destination
 *
 * @returns Atom as the skeleton reader emits it
 *
 * @example
 * ```ts
 * const atom = link('https://a.example');
 * ```
 */
function link(url: string,): ProtectedAtom {
  return {
    kind: 'link-url',
    value: url,
  };
}

/**
 * Footnote atom for a marker.
 *
 * @param marker - footnote label
 *
 * @returns Atom as the skeleton reader emits it
 *
 * @example
 * ```ts
 * const atom = footnote('1');
 * ```
 */
function footnote(marker: string,): ProtectedAtom {
  return {
    kind: 'footnote',
    value: marker,
  };
}

/**
 * Original's destination.
 */
const A = 'https://twitter.example/cat';

/**
 * Page's rewritten destination.
 */
const B = 'https://x.example/cat';

/**
 * Destination neither carries.
 */
const C = 'https://cats.example/naps';

await describe({
  name: renderingPoolsOf.name,
  children: [
    it({
      name: 'POOLS A KIND that diverges both ways, owing the larger side',
      fn: async () => {
        expect(renderingPoolsOf({
          source: [link(A,), link(A,),],
          page: [link(B,),],
        },),).toEqual([{
          kind: 'link-url',
          fromSource: [`link-url ${A}`, `link-url ${A}`,],
          fromPage: [`link-url ${B}`,],
          owed: 2,
        },],);
      },
    },),

    it({
      name: 'LEAVES ONE-WAY DIVERGENCE OUT, whether an addition or a drop, and keeps kinds apart',
      fn: async () => {
        expect(renderingPoolsOf({
          source: [link(A,),],
          page: [link(A,), footnote('1',),],
        },),).toEqual([],);
        expect(renderingPoolsOf({
          source: [link(A,), footnote('1',),],
          page: [link(A,),],
        },),).toEqual([],);
        expect(renderingPoolsOf({
          source: [link(A,), footnote('1',),],
          page: [link(B,), footnote('2',),],
        },).map(function toKind(pool,): string {
          return pool.kind;
        },),).toEqual(['link-url', 'footnote',],);
        expect(renderingPoolsOf({
          source: [],
          page: [],
        },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: atomFindings.name,
  children: [
    it({
      name: 'ACCEPTS EITHER RENDERING of a pooled reference',
      fn: async () => {
        expect(atomFindings({
          source: [link(A,),],
          page: [link(B,),],
          candidate: [link(A,),],
          referenceName: 'ORIGINAL or the PAGE AS IT STANDS',
        },),).toEqual([],);
        expect(atomFindings({
          source: [link(A,),],
          page: [link(B,),],
          candidate: [link(B,),],
          referenceName: 'ORIGINAL or the PAGE AS IT STANDS',
        },),).toEqual([],);
      },
    },),

    it({
      name: 'REFUSES NEITHER AND BOTH, naming the two renderings and the count owed',
      fn: async () => {
        /**
         * Findings over a candidate that dropped the reference.
         */
        const neither = atomFindings({
          source: [link(A,),],
          page: [link(B,),],
          candidate: [],
          referenceName: 'ORIGINAL or the PAGE AS IT STANDS',
        },);
        expect(neither,).toEqual([
          `The ORIGINAL carries link-url ${A} where the PAGE AS IT STANDS carries link-url ${B}: the page rendered `
            + 'the original\'s reference another way, and your translation must carry exactly 1 of these, taken from '
            + 'either side; it carries 0.',
        ],);
        /**
         * Findings over a candidate that carried both renderings.
         */
        const both = atomFindings({
          source: [link(A,),],
          page: [link(B,),],
          candidate: [link(A,), link(B,),],
          referenceName: 'ORIGINAL or the PAGE AS IT STANDS',
        },);
        expect(both.length,).toBe(1,);
        expect(both[0],).toContain('it carries 2.',);
      },
    },),

    it({
      name: 'STILL OWES an addition the page made and a reference the page dropped, and refuses an invention',
      fn: async () => {
        expect(atomFindings({
          source: [link(A,),],
          page: [link(A,), link(C,),],
          candidate: [link(A,),],
          referenceName: 'ORIGINAL or the PAGE AS IT STANDS',
        },),).toEqual([
          `The ORIGINAL or the PAGE AS IT STANDS carries link-url ${C} and your translation does not.`,
        ],);
        expect(atomFindings({
          source: [link(A,), link(C,),],
          page: [link(A,),],
          candidate: [link(A,),],
          referenceName: 'ORIGINAL or the PAGE AS IT STANDS',
        },),).toEqual([
          `The ORIGINAL or the PAGE AS IT STANDS carries link-url ${C} and your translation does not.`,
        ],);
        expect(atomFindings({
          source: [link(A,),],
          page: [],
          candidate: [link(A,), link(C,),],
          referenceName: 'ORIGINAL',
        },),).toEqual([
          `Your translation carries link-url ${C} and the ORIGINAL does not.`,
        ],);
      },
    },),
  ],
},);
