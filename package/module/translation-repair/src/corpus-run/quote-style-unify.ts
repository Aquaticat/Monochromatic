import type { ArchiveOriginalSpan, } from '../archive-original-note.ts';
import type { ChunkPair, } from '../chunk-document.ts';
import { restoreTypography, } from '../restore-typography.ts';
import type { SliceReplacement, } from '../splice-slices.ts';
import { proseMask, } from '../typography-prose-mask.ts';
import { pageTextBySlice, } from './assembly-page-text.ts';
import {
  rewriteEverySlice,
  type TextRewrite,
} from './page-slice-rewrite.ts';

//region Quote style unify
// CLASS ONE HUNDRED FORTY-TWO (XingZ6012, 2026-09-26): the page wrote its
// quotes curly (134 curly double marks, 108 curly apostrophes against two
// straight lines of each), yet four archive paragraphs no lane rewrote kept
// their straight marks ("take it slow", "didn't"), because the typography
// restoration reads only the text a lane replaced. This page-assembly pass
// counts the prose quote marks on every slice the page carries and, where the
// curly form of a mark outnumbers the straight form, curls that mark on every
// slice through the same restoration, so tags, code, unbalanced doubles and
// the ellipsis stay as they are. The front matter and a span sealed as the
// English original stand aside, as for every whole-page pass.

/**
 Straight double quote.
 */
const STRAIGHT_DOUBLE = '"';

/**
 Straight single quote, in prose an apostrophe.
 */
const STRAIGHT_SINGLE = '\'';

/**
 Curly double quotes, opening and closing.
 */
const CURLY_DOUBLES = '“”';

/**
 Curly apostrophe.
 */
const CURLY_SINGLE = '’';

/**
 Prose quote marks counted on the page, by form.
 */
type QuoteTally = {
  readonly straightDouble: number;
  readonly curlyDouble: number;
  readonly straightSingle: number;
  readonly curlySingle: number;
};

/**
 Tally with nothing counted.
 */
const EMPTY_TALLY: QuoteTally = {
  straightDouble: 0,
  curlyDouble: 0,
  straightSingle: 0,
  curlySingle: 0,
};

/**
 Adds one text's prose quote marks to a tally.

 @param tally - marks counted so far

 @param text - one slice's text as the page carries it

 @returns Tally with the text's marks added

 @example
 ```ts
 tallyQuotes({ tally: EMPTY_TALLY, text: 'The cat said "meow".', },).straightDouble; // 2
 ```
 */
function tallyQuotes(
  {
    tally,
    text,
  }: {
    readonly tally: QuoteTally;
    readonly text: string;
  },
): QuoteTally {
  /**
   Which units of the text are prose.
   */
  const mask = proseMask({ text, },);
  // The mask holds one flag per UTF-16 unit, so the text is read by unit: a
  // handle in astral letters would shift a code-point index off the mask.
  return mask.reduce(
    function count(
      counted,
      prose,
      index,
    ): QuoteTally {
      if (!prose)
        return counted;
      /**
       Unit under the scan.
       */
      const character = text.charAt(index,);
      if (character === STRAIGHT_DOUBLE)
        return {
          ...counted,
          straightDouble: counted.straightDouble + 1,
        };
      if (CURLY_DOUBLES.includes(character,))
        return {
          ...counted,
          curlyDouble: counted.curlyDouble + 1,
        };
      if (character === STRAIGHT_SINGLE)
        return {
          ...counted,
          straightSingle: counted.straightSingle + 1,
        };
      if (character === CURLY_SINGLE)
        return {
          ...counted,
          curlySingle: counted.curlySingle + 1,
        };
      return counted;
    },
    tally,
  );
}

/**
 The curly marks the page writes more often than their straight forms, as a
 convention the typography restoration reads; empty where neither mark is
 curly on most of the page.

 @param slices - prepared pairs

 @param replacements - what the page would write per slice

 @returns Convention text holding the curly marks the page mostly uses

 @example
 ```ts
 const convention = pageQuoteConvention({ slices, replacements, },);
 ```
 */
function pageQuoteConvention(
  {
    slices,
    replacements,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): string {
  /**
   Text the page carries per slice.
   */
  const carried = pageTextBySlice({
    slices,
    replacements,
  },);
  /**
   Every prose quote mark on the page outside the front matter.
   */
  const tally = slices
    .filter(function isBody(slice,): boolean {
      return slice.syntax !== 'front-matter';
    },)
    .reduce(
      function add(
        counted,
        slice,
      ): QuoteTally {
        return tallyQuotes({
          tally: counted,
          text: carried.get(slice.target
            .sliceIndex,) ?? '',
        },);
      },
      EMPTY_TALLY,
    );
  /**
   Whether curly doubles are the page's form.
   */
  const curlyDoubles = tally.curlyDouble > tally.straightDouble;
  /**
   Whether the curly apostrophe is the page's form.
   */
  const curlySingles = tally.curlySingle > tally.straightSingle;
  return `${curlyDoubles ? CURLY_DOUBLES : ''}${curlySingles ? CURLY_SINGLE : ''}`;
}

/**
 Counts the UTF-16 units two texts of one length differ in; curling a mark
 swaps one unit for one unit, so the lengths agree.

 @param before - text as the page carried it

 @param after - text after the restoration

 @returns Units changed

 @example
 ```ts
 changedUnits({ before: '"a"', after: '“a”', },); // 2
 ```
 */
function changedUnits(
  {
    before,
    after,
  }: {
    readonly before: string;
    readonly after: string;
  },
): number {
  /**
   Whether each unit differs.
   */
  const differences = Array.from(
    { length: after.length, },
    function differs(
      _unused,
      index,
    ): boolean {
      return after.charAt(index,) !== before.charAt(index,);
    },
  );
  return differences
    .filter(Boolean,)
    .length;
}

/**
 Brings every slice's prose quote marks to the page's majority style, the
 slices no lane replaced included.

 @param slices - prepared pairs, whose archive text stands where no row replaces it

 @param replacements - what the page would write per slice

 @param archiveOriginalSpans - spans sealed as the English original

 @returns Replacements with the marks curled (a row added for an archive slice
 the pass changed), the rewritten rows alone, and one finding per slice changed

 @example
 ```ts
 const page = unifyQuoteStyle({ slices, replacements, archiveOriginalSpans: [], },);
 ```
 */
export function unifyQuoteStyle(
  {
    slices,
    replacements,
    archiveOriginalSpans,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
    readonly archiveOriginalSpans: readonly ArchiveOriginalSpan[];
  },
): {
  readonly replacements: readonly SliceReplacement[];
  readonly restored: readonly SliceReplacement[];
  readonly findings: readonly string[];
} {
  /**
   Curly marks the page mostly writes.
   */
  const convention = pageQuoteConvention({
    slices,
    replacements,
  },);
  if (convention === '') {
    return {
      replacements,
      restored: [],
      findings: [],
    };
  }
  return rewriteEverySlice({
    slices,
    replacements,
    archiveOriginalSpans,
    rewrite: function curl({ text, },): TextRewrite {
      /**
       Text with the page's curly marks restored.
       */
      const curled = restoreTypography({
        replacement: text,
        replaced: '',
        convention,
      },);
      if (curled === text) {
        return {
          text,
          changed: [],
        };
      }
      return {
        text: curled,
        changed: [`${changedUnits({
          before: text,
          after: curled,
        },)} quote marks to the page's curly style`,],
      };
    },
    findingName: 'quote-style-unified',
  },);
}

//endregion Quote style unify
