import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type ChainSegment,
  renderCanonical,
  selectBreakOffsets,
} from './chain-render.ts';

/** Attached segment helper for building fixture segment streams. */
const attached: ChainSegment = { isBreak: false, };

/**
 * Builds a break segment at a byte offset for fixture segment streams.
 *
 * @param offset - byte offset where the break's continuation line begins
 *
 * @returns break segment carrying that offset
 */
function breakAt(offset: number,): ChainSegment {
  return {
    isBreak: true,
    breakOffset: offset,
  };
}

await describe({
  name: '',
  children: [
    //region selectBreakOffsets

    describe({
      name: selectBreakOffsets.name,
      children: [
        it({
          name: 'returns no offsets when nothing breaks',
          fn: async () => {
            expect(
              selectBreakOffsets([
                attached,
                attached,
                attached,
              ],),
            ).toEqual([],);
          },
        },),
        it({
          name: 'keeps a break point on the head line when only one segment precedes it',
          fn: async () => {
            // `a + b`: [leaf, operator break]; the break sits at index 1 and attaches.
            expect(
              selectBreakOffsets([
                attached,
                breakAt(2,),
              ],),
            ).toEqual([],);
          },
        },),
        it({
          name: 'breaks every break point at segment index two or greater',
          fn: async () => {
            // `obj.b.c.d`: [leaf, .b@4, .c@6, .d@8]; `.b` attaches, `.c` and `.d` break.
            expect(
              selectBreakOffsets([
                attached,
                breakAt(4,),
                breakAt(6,),
                breakAt(8,),
              ],),
            ).toEqual([
              6,
              8,
            ],);
          },
        },),
        it({
          name: 'counts attached segments toward the head when locating the first break',
          fn: async () => {
            // `foo().bar()[0]`: [leaf, call, .bar@5, call, computed]; `.bar` is index 2 and breaks.
            expect(
              selectBreakOffsets([
                attached,
                attached,
                breakAt(5,),
                attached,
                attached,
              ],),
            ).toEqual([5,],);
          },
        },),
      ],
    },),

    //endregion selectBreakOffsets

    //region renderCanonical

    describe({
      name: renderCanonical.name,
      children: [
        it({
          name: 'returns the verbatim region when there are no breaks',
          fn: async () => {
            expect(
              renderCanonical({
                sourceText: 'obj.method()',
                regionStart: 0,
                regionEnd: 12,
                breakOffsets: [],
                childIndent: '  ',
              },),
            ).toBe('obj.method()',);
          },
        },),
        it({
          name: 'lays each break onto its own continuation line at the child indent',
          fn: async () => {
            // `obj.b.c.d`: dots at 5 (`.c`) and 7 (`.d`).
            expect(
              renderCanonical({
                sourceText: 'obj.b.c.d',
                regionStart: 0,
                regionEnd: 9,
                breakOffsets: [
                  5,
                  7,
                ],
                childIndent: '  ',
              },),
            ).toBe('obj.b\n  .c\n  .d',);
          },
        },),
        it({
          name: 'trims trailing whitespace so no line ends in spaces',
          fn: async () => {
            // `a +  b` with a break at the operator (index 2) leaves no trailing space on the head.
            expect(
              renderCanonical({
                sourceText: 'a  +  b',
                regionStart: 0,
                regionEnd: 7,
                breakOffsets: [3,],
                childIndent: '  ',
              },),
            ).toBe('a\n  +  b',);
          },
        },),
        it({
          name: 'is idempotent: re-rendering already-canonical source reproduces it',
          fn: async () => {
            // Already laid out: dots at 8 (`.c`) and 13 (`.d`); trailing indent trims away.
            const canonical = 'obj.b\n  .c\n  .d';
            expect(
              renderCanonical({
                sourceText: canonical,
                regionStart: 0,
                regionEnd: canonical.length,
                breakOffsets: [
                  8,
                  13,
                ],
                childIndent: '  ',
              },),
            ).toBe(canonical,);
          },
        },),
      ],
    },),

    //endregion renderCanonical
  ],
},);
