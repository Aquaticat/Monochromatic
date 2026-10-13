/**
 Tests for what the changed slices of a recorded consistency section say beside
 the places that were replaced: one row per slice, a row for each slice that
 holds a replaced place and for none other, and one fate for the places of a
 slice.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ArtifactConsistencyGroup,
  ArtifactParseError,
  assertSlicesCoherent,
} from '../../dist/final/node/index.mjs';

/**
 A group whose places stand in the slices and end in the outcomes a case names.

 @param placed - slice and outcome of each place, in page order

 @param located - whether each place's rendering is located, unlocated when absent

 @returns Group of a repeated sentence

 @example
 ```ts
 const group = groupOf({ placed: [[0, 'chosen',], [1, 'replaced',],], },);
 ```
 */
function groupOf(
  {
    placed,
    located = false,
  }: {
    readonly placed: readonly (readonly [number, string])[];
    readonly located?: boolean;
  },
): ArtifactConsistencyGroup {
  return {
    repeat: { kind: 'maximal', wording: '窗台上的阳光让小猫睡着了', },
    occurrences: placed.map(function placeOf(
      [sliceIndex, outcome,],
      at,
    ) {
      return {
        label: `OCCURRENCE ${String(at + 1,)}`,
        sliceIndex,
        startOffset: 6 + (at * 30),
        endOffset: 18 + (at * 30),
        line: 3,
        rendering: located
          ? { kind: 'located', quote: 'The kitten naps', start: 6 + (at * 30), }
          : { kind: 'unlocated', reason: 'not-found', },
        outcome,
      };
    },),
    unplaced: [],
    verdict: { kind: 'not-asked', reason: 'too-few-placed', },
  } as unknown as ArtifactConsistencyGroup;
}

/**
 What reading the slices refuses with, or a note that nothing was refused.

 @param groups - recorded groups

 @param slices - recorded changed slices

 @returns The refusal's message

 @example
 ```ts
 const message = refusalOf({ groups: [], slices: [], },);
 ```
 */
function refusalOf(
  {
    groups,
    slices,
  }: {
    readonly groups: readonly ArtifactConsistencyGroup[];
    readonly slices: readonly { readonly sliceIndex: number; readonly text: string; }[];
  },
): string {
  try {
    assertSlicesCoherent({
      groups,
      slices,
      path: 'cat.consistency.slices',
    },);
  }
  catch (error) {
    if (error instanceof ArtifactParseError)
      return error.message;
    throw error;
  }
  return 'not refused';
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: assertSlicesCoherent.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ACCEPTS ONE ROW FOR EACH SLICE THAT HOLDS A REPLACED PLACE, and no row for a slice that holds none',
          fn: async () => {
            expect(refusalOf({
              groups: [groupOf({ placed: [[0, 'chosen',], [2, 'replaced',], [3, 'unlocated',],], },),],
              slices: [{ sliceIndex: 2, text: 'The kitten naps.', },],
            },),).toBe('not refused',);
          },
        },),
        it({
          name: 'REFUSES A ROW FOR A SLICE WITH NO REPLACED PLACE, A REPLACED PLACE WITH NO ROW, AND A SLICE NAMED TWICE',
          fn: async () => {
            const groups = [groupOf({ placed: [[0, 'chosen',], [2, 'replaced',],], },),];
            expect([
              refusalOf({ groups, slices: [{ sliceIndex: 2, text: 'a', }, { sliceIndex: 0, text: 'b', },], },),
              refusalOf({ groups, slices: [], },),
              refusalOf({ groups, slices: [{ sliceIndex: 2, text: 'a', }, { sliceIndex: 2, text: 'b', },], },),
            ],).toEqual([
              'artifact parse failed at cat.consistency.slices: expected a replaced place in slice 0, which a changed slice needs.',
              'artifact parse failed at cat.consistency.slices: expected a changed slice row for slice 2, which holds a replaced place.',
              'artifact parse failed at cat.consistency.slices: expected one row per slice; slice 2 appears more than once.',
            ],);
          },
        },),
        it({
          name: 'REFUSES A SLICE THAT HOLDS BOTH A REPLACED PLACE AND A PLACE THE FLOORS REFUSED, since they answer for it once',
          fn: async () => {
            expect(refusalOf({
              groups: [groupOf({ placed: [[0, 'chosen',], [2, 'replaced',],], },), groupOf({ placed: [[2, 'kept-floor',], [3, 'chosen',],], },),],
              slices: [{ sliceIndex: 2, text: 'a', },],
            },),).toBe(
              'artifact parse failed at cat.consistency.slices: expected one fate for slice 2, which holds a replaced place and a place the floors refused.',
            );
          },
        },),
        it({
          name: 'ACCEPTS AN OVERLAP BESIDE A REPLACED PLACE, A REFUSED ONE OR A LOCATED PLACE OF ANOTHER GROUP, and refuses one '
            + 'with none of them in its slice',
          fn: async () => {
            expect([
              refusalOf({
                groups: [groupOf({ placed: [[0, 'chosen',], [2, 'replaced',],], },), groupOf({ placed: [[2, 'overlapped',], [3, 'chosen',],], },),],
                slices: [{ sliceIndex: 2, text: 'a', },],
              },),
              refusalOf({
                groups: [groupOf({ placed: [[0, 'chosen',], [2, 'kept-floor',],], },), groupOf({ placed: [[2, 'overlapped',], [3, 'chosen',],], },),],
                slices: [],
              },),
              refusalOf({
                groups: [
                  groupOf({ placed: [[0, 'chosen',], [2, 'overlapped',],], },),
                  groupOf({ placed: [[2, 'chosen',], [3, 'replaced',],], located: true, },),
                ],
                slices: [{ sliceIndex: 3, text: 'a', },],
              },),
              refusalOf({
                groups: [
                  groupOf({ placed: [[0, 'chosen',], [2, 'overlapped',],], },),
                  groupOf({ placed: [[2, 'chosen',], [3, 'replaced',],], },),
                ],
                slices: [{ sliceIndex: 3, text: 'a', },],
              },),
              refusalOf({
                groups: [groupOf({ placed: [[0, 'chosen',], [2, 'overlapped',],], located: true, },),],
                slices: [],
              },),
            ],).toEqual([
              'not refused',
              'not refused',
              'not refused',
              'artifact parse failed at cat.consistency.slices: expected a replacement, or a located place of another group, '
              + 'in slice 2 for the overlapped place to overlap.',
              'artifact parse failed at cat.consistency.slices: expected a replacement, or a located place of another group, '
              + 'in slice 2 for the overlapped place to overlap.',
            ],);
          },
        },),
      ],
    },),
  ],
},);
