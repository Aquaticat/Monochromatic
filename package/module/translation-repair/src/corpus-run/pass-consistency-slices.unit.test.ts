/**
 Tests for what the consistency pass reads of each slice: the original, the
 wording the slice would ship at this point, and the facts the floors need.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  type ArchiveDispute,
  type ConsistencySliceFacts,
  consistencySlicesOf,
  type PreparedDocumentPair,
} from '../../dist/final/node/index.mjs';
import {
  archiveEnglishOf,
  preparedCatPage,
  projectedCatPage,
} from './consistency-page.test-fixture.ts';

/**
 Reads the facts of the cat page with the fields a case replaces.

 @param prepared - preparation of the page, the cat page by default

 @param english - what each slice ships, the archive by default

 @param archiveDisputes - slices whose archive rendering was disputed

 @returns One entry per slice

 @example
 ```ts
 const facts = factsOf({},);
 ```
 */
function factsOf(
  {
    prepared = preparedCatPage(),
    english = archiveEnglishOf({ prepared, },),
    archiveDisputes = new Map<number, ArchiveDispute>(),
  }: {
    readonly prepared?: PreparedDocumentPair;
    readonly english?: readonly string[];
    readonly archiveDisputes?: ReadonlyMap<number, ArchiveDispute>;
  },
): readonly ConsistencySliceFacts[] {
  return consistencySlicesOf({
    prepared,
    projected: projectedCatPage({ prepared, english, },),
    contestSlices: [],
    consolidateSlices: [],
    archiveDisputes,
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: consistencySlicesOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS EACH SLICE\'S ORIGINAL, ITS OFFSET AND BLOCKS, and the wording it would ship: the archive\'s '
            + 'where the archive stands',
          fn: async () => {
            const prepared = preparedCatPage();
            const facts = factsOf({ prepared, },);
            const first = nonNullishOrThrow(facts[0],);
            expect({
              count: facts.length,
              sliceIndex: first.sliceIndex,
              sourceIndex: first.sourceIndex,
              sourceText: first.sourceText,
              sourceStart: first.sourceStart,
              nodes: first.nodes.length,
              current: first.current,
              lineStructured: first.lineStructured,
              disputedWordings: first.disputedWordings,
            },).toEqual({
              count: 4,
              sliceIndex: 0,
              sourceIndex: 0,
              sourceText: '## 一\n\n窗台上的阳光让小猫睡着了。所以这只猫一定是胖胖的小宝贝。',
              sourceStart: 0,
              nodes: 2,
              current: {
                kind: 'present',
                text: '## One\n\nThe sunny window put the kitten to sleep. So this cat must be a chubby little treasure.',
              },
              lineStructured: false,
              disputedWordings: [],
            },);
          },
        },),
        it({
          name: 'READS THE WORDING THE LANES SHIPPED where the archive does not stand',
          fn: async () => {
            const prepared = preparedCatPage();
            const english = [...archiveEnglishOf({ prepared, },),];
            english[1] = '## Two\n\nThe fish smell woke the kitten.';
            expect(nonNullishOrThrow(factsOf({ prepared, english, },)[1],).current,).toEqual({
              kind: 'present',
              text: '## Two\n\nThe fish smell woke the kitten.',
            },);
          },
        },),
        it({
          name: 'READS A SLICE NOTHING SHIPS AT AS CARRYING NO ENGLISH, never as an empty wording',
          fn: async () => {
            const prepared = preparedCatPage();
            const english = [...archiveEnglishOf({ prepared, },),];
            english[2] = '';
            expect(nonNullishOrThrow(factsOf({ prepared, english, },)[2],).current,).toEqual({ kind: 'absent', },);
          },
        },),
        it({
          name: 'CARRIES THE LINE-STRUCTURE FLAG OF A SLICE the preparation marks',
          fn: async () => {
            const whole = preparedCatPage();
            const prepared = { ...whole, lineStructuredSliceIndices: new Set([1,],), };
            const facts = factsOf({ prepared, english: archiveEnglishOf({ prepared: whole, },), },);
            expect(facts.map(function flagOf(entry,): boolean {
              return entry.lineStructured;
            },),).toEqual([false, true, false, false,],);
          },
        },),
        it({
          name: 'CARRIES THE WORDINGS A DISPUTED SLICE REFUSES, the archive\'s own and the stand-in that may not stand',
          fn: async () => {
            const prepared = preparedCatPage();
            const dispute: ArchiveDispute = {
              sliceIndex: 1,
              standIn: '## Two\n\nThe fish smell woke the kitten.',
              acceptedClaims: [],
              standInEligible: false,
              standInRefusal: 'unresolved',
            };
            const facts = factsOf({ prepared, archiveDisputes: new Map([[1, dispute,],],), },);
            expect(nonNullishOrThrow(facts[1],).disputedWordings.map(function textOf(wording,): string {
              return wording.text;
            },),).toEqual([
              archiveEnglishOf({ prepared, },)[1],
              '## Two\n\nThe fish smell woke the kitten.',
            ],);
            expect(nonNullishOrThrow(facts[0],).disputedWordings,).toEqual([],);
          },
        },),
        it({
          name: 'REFUSES A SLICE THE COMPARISON HAS NO ROW FOR, by name, since the comparison is derived from rows of '
            + 'that preparation',
          fn: async () => {
            const prepared = preparedCatPage();
            const projected = projectedCatPage({ prepared, english: archiveEnglishOf({ prepared, },), });
            let refusal = '';
            try {
              consistencySlicesOf({
                prepared,
                projected: { ...projected, comparison: projected.comparison.slice(0, 3,), },
                contestSlices: [],
                consolidateSlices: [],
                archiveDisputes: new Map(),
              },);
            }
            catch (error) {
              refusal = String(error,);
            }
            expect(refusal,).toBe(
              'ConsistencyInvariantError: unreachable: slice 3 of the preparation has no comparison row, '
                + 'and the comparison is derived from rows of that preparation',
            );
          },
        },),
      ],
    },),
  ],
},);
