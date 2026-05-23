import type { Span, } from '@oxlint/plugins';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  effectiveEnd,
  isInterSegmentClean,
} from './chain.ts';

/**
 * Builds a fully-typed {@link Span} from a byte range for fixture nodes.
 *
 * `effectiveEnd` and `isInterSegmentClean` read only `start`/`end`; `loc` and
 * `range` carry single-line placeholders so the value satisfies the type
 * without an assertion.
 */
function makeSpan({
  start,
  end,
}: {
  readonly start: number;
  readonly end: number;
},): Span {
  return {
    start,
    end,
    range: [
      start,
      end,
    ],
    loc: {
      start: {
        line: 1,
        column: start,
      },
      end: {
        line: 1,
        column: end,
      },
    },
  };
}

await describe({
  name: '',
  children: [
    //region effectiveEnd

    describe({
      name: effectiveEnd.name,
      children: [
        it({
          name: 'returns node.end unchanged when the node is not parenthesised',
          fn: async () => {
            expect(
              effectiveEnd({
                node: makeSpan({
                  start: 0,
                  end: 1,
                },),
                sourceText: 'a + b',
              },),
            ).toBe(1,);
          },
        },),
        it({
          name: 'advances past a closing paren that abuts the node end',
          fn: async () => {
            // '(b + c) + d': inner span 'b + c' ends at 6, ')' sits at 6.
            expect(
              effectiveEnd({
                node: makeSpan({
                  start: 1,
                  end: 6,
                },),
                sourceText: '(b + c) + d',
              },),
            ).toBe(7,);
          },
        },),
        it({
          name: 'tolerates whitespace between the node end and the closing paren',
          fn: async () => {
            // '(b + c ) + d': inner span ends at 6, space at 6, ')' at 7.
            expect(
              effectiveEnd({
                node: makeSpan({
                  start: 1,
                  end: 6,
                },),
                sourceText: '(b + c ) + d',
              },),
            ).toBe(8,);
          },
        },),
        it({
          name: 'returns node.end when only non-ASCII whitespace precedes the close',
          fn: async () => {
            // hasParens trims the U+00A0 (Unicode trim), but the scan's ASCII-only
            // whitespace set does not, so the close is not located: node.end stands.
            expect(
              effectiveEnd({
                node: makeSpan({
                  start: 1,
                  end: 2,
                },),
                sourceText: '(b\u00A0)',
              },),
            ).toBe(2,);
          },
        },),
        it({
          name: 'scans a long whitespace gap to the close in a single linear pass',
          fn: async () => {
            const pad = 50_000;
            // '(b' + pad spaces + ')': ')' sits at index pad + 2.
            const sourceText = `(b${' '.repeat(pad,)})`;
            expect(
              effectiveEnd({
                node: makeSpan({
                  start: 1,
                  end: 2,
                },),
                sourceText,
              },),
            ).toBe(pad + 3,);
          },
        },),
      ],
    },),

    //endregion effectiveEnd

    //region isInterSegmentClean

    describe({
      name: isInterSegmentClean.name,
      children: [
        it({
          name: 'returns true for an empty slice (from equals boundaryOffset)',
          fn: async () => {
            expect(
              isInterSegmentClean({
                sourceText: 'a+b',
                from: 1,
                boundaryOffset: 1,
              },),
            ).toBe(true,);
          },
        },),
        it({
          name: 'returns true when the slice is entirely whitespace',
          fn: async () => {
            expect(
              isInterSegmentClean({
                sourceText: 'a   +b',
                from: 1,
                boundaryOffset: 4,
              },),
            ).toBe(true,);
          },
        },),
        it({
          name: 'returns false when the slice contains a comment',
          fn: async () => {
            expect(
              isInterSegmentClean({
                sourceText: 'a/**/+b',
                from: 1,
                boundaryOffset: 5,
              },),
            ).toBe(false,);
          },
        },),
        it({
          name: 'treats null typeArguments like absent type arguments',
          fn: async () => {
            expect(
              isInterSegmentClean({
                sourceText: 'a  +',
                from: 1,
                boundaryOffset: 3,
                typeArguments: null,
              },),
            ).toBe(true,);
          },
        },),
        it({
          name: 'permits a type-arguments span as the only non-whitespace content',
          fn: async () => {
            // 'f<T>(': type args '<T>' occupy [1,4); boundary '(' at 4.
            expect(
              isInterSegmentClean({
                sourceText: 'f<T>(',
                from: 1,
                boundaryOffset: 4,
                typeArguments: makeSpan({
                  start: 1,
                  end: 4,
                },),
              },),
            ).toBe(true,);
          },
        },),
        it({
          name: 'tolerates whitespace around a type-arguments span',
          fn: async () => {
            // 'f <T> (': type args '<T>' occupy [2,5); boundary '(' at 6.
            expect(
              isInterSegmentClean({
                sourceText: 'f <T> (',
                from: 1,
                boundaryOffset: 6,
                typeArguments: makeSpan({
                  start: 2,
                  end: 5,
                },),
              },),
            ).toBe(true,);
          },
        },),
        it({
          name: 'returns false for non-whitespace outside the type-arguments span',
          fn: async () => {
            // 'f x<T>(': stray 'x' before the type args fails the leading scan.
            expect(
              isInterSegmentClean({
                sourceText: 'f x<T>(',
                from: 1,
                boundaryOffset: 6,
                typeArguments: makeSpan({
                  start: 3,
                  end: 6,
                },),
              },),
            ).toBe(false,);
          },
        },),
        it({
          name: 'scans a long whitespace slice in a single linear pass',
          fn: async () => {
            const pad = 50_000;
            expect(
              isInterSegmentClean({
                sourceText: ' '.repeat(pad,),
                from: 0,
                boundaryOffset: pad,
              },),
            ).toBe(true,);
          },
        },),
      ],
    },),

    //endregion isInterSegmentClean
  ],
},);
