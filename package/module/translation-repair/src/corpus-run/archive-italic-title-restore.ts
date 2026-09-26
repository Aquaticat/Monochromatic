import type { ArchiveOriginalSpan, } from '../archive-original-note.ts';
import type { ChunkPair, } from '../chunk-document.ts';
import type { SliceReplacement, } from '../splice-slices.ts';
import { archiveItalicSpans, } from './archive-italic-spans.ts';
import {
  rewriteEverySlice,
  type TextRewrite,
} from './page-slice-rewrite.ts';
import {
  inProse,
  protectedRanges,
} from './prose-ranges.ts';

//region Archive italic title restore
// CLASS ONE HUNDRED SEVENTY-THREE (TianqiChen6668, 2026-09-26): the archive
// names an anime as *Anohana: The Flower We Saw That Day*, yet the page wrote
// the same words as “Anohana:\nThe Flower We Saw That Day”, in quotation
// marks and broken after the colon, so the page named the work in a form
// the archive never used. This page-assembly pass reads the words the
// archive sets in italics and, where a page slice quotes the same words in
// prose (whitespace runs, line breaks included, read as one space), writes
// the archive's italic span back. A period or comma the quotes held after
// the words moves outside the italics. Quotation marks around any other
// words are left alone, since those may be speech.

/**
 One pair of quotation marks a title may be written in.
 */
type QuotePair = {
  readonly open: string;
  readonly close: string;
};

/**
 Pairs read: curly doubles, and straight doubles for a page the quote-style
 pass left straight.
 */
const QUOTE_PAIRS: readonly QuotePair[] = [
  {
    open: '“',
    close: '”',
  },
  {
    open: '"',
    close: '"',
  },
];

/**
 Marks a title's quotes may hold after its words, moved outside the italics.
 */
const TRAILING_MARKS: ReadonlySet<string> = new Set([
  '.',
  ',',
],);

/**
 One quoted span of a text, with its words.
 */
type QuoteSpan = {
  readonly start: number;
  readonly end: number;
  readonly inner: string;
};

/**
 Words with every whitespace run read as one space.

 @param text - words as written

 @returns Words on one line

 @example
 ```ts
 oneLine({ text: 'Long:\nNap', },); // 'Long: Nap'
 ```
 */
function oneLine({ text, }: { readonly text: string; },): string {
  return text
    .replaceAll(
      '\n',
      ' ',
    )
    .split(' ',)
    .filter(function hasWords(piece,): boolean {
      return piece.length > 0;
    },)
    .join(' ',);
}

/**
 Every span of a text one pair of quotation marks encloses, in order.

 @param text - text under scan

 @param pair - quotation marks to read

 @returns Quoted spans, the marks included

 @example
 ```ts
 quoteSpans({ text: 'a “b” c', pair: QUOTE_PAIRS[0], },); // [{ start: 2, end: 5, inner: 'b' }]
 ```
 */
function quoteSpans(
  {
    text,
    pair,
  }: {
    readonly text: string;
    readonly pair: QuotePair;
  },
): readonly QuoteSpan[] {
  /**
   Spans found so far.
   */
  const spans: QuoteSpan[] = [];
  for (let open = text.indexOf(pair.open,); open !== (-1);) {
    /**
     Where this span's closing mark stands.
     */
    const close = text.indexOf(
      pair.close,
      open + 1,
    );
    if (close === (-1))
      break;
    spans.push({
      start: open,
      end: close + 1,
      inner: text.slice(
        open + 1,
        close,
      ),
    },);
    open = text.indexOf(
      pair.open,
      close + 1,
    );
  }
  return spans;
}

/**
 The italic form one quoted span takes, where its words are an archive title.

 @param inner - quoted words

 @param titles - archive italic spans

 @returns The span's italic form, or the empty string where it names no title

 @example
 ```ts
 italicForm({ inner: 'Long Nap.', titles: new Set(['Long Nap',],), },); // '*Long Nap*.'
 ```
 */
function italicForm(
  {
    inner,
    titles,
  }: {
    readonly inner: string;
    readonly titles: ReadonlySet<string>;
  },
): string {
  /**
   Quoted words on one line.
   */
  const words = oneLine({ text: inner, },);
  if (titles.has(words,))
    return `*${words}*`;
  /**
   Mark the quotes hold after the words.
   */
  const last = words.slice(-1,);
  /**
   Words before that mark.
   */
  const head = words.slice(
    0,
    -1,
  );
  return TRAILING_MARKS.has(last,) && titles.has(head,) ? `*${head}*${last}` : '';
}

/**
 Writes each quoted archive title in one slice's text in italics.

 @param text - one slice's text as the page carries it

 @param titles - archive italic spans

 @returns Text with those spans in italics and a note per span

 @example
 ```ts
 italicizeSlice({ text: 'She loved “Long Nap”.', titles: new Set(['Long Nap',],), },).text; // 'She loved *Long Nap*.'
 ```
 */
function italicizeSlice(
  {
    text,
    titles,
  }: {
    readonly text: string;
    readonly titles: ReadonlySet<string>;
  },
): TextRewrite {
  /**
   Non-prose ranges of the text.
   */
  const ranges = protectedRanges({ text, },);
  /**
   Quoted titles in prose, last first so earlier offsets hold as each is
   written.
   */
  const rewrites = QUOTE_PAIRS
    .flatMap(function spansOf(pair,): readonly QuoteSpan[] {
      return quoteSpans({
        text,
        pair,
      },);
    },)
    .map(function withForm(span,): QuoteSpan & { readonly form: string; } {
      return {
        ...span,
        form: italicForm({
          inner: span.inner,
          titles,
        },),
      };
    },)
    .filter(function restorable(span,): boolean {
      return (span.form !== '') && inProse({
        ranges,
        start: span.start,
        end: span.end,
      },);
    },)
    .toSorted(function lastFirst(
      left,
      right,
    ): number {
      return right.start - left.start;
    },);
  return {
    text: rewrites.reduce(
      function write(
        current,
        span,
      ): string {
        return `${current.slice(
          0,
          span.start,
        )}${span.form}${current.slice(span.end,)}`;
      },
      text,
    ),
    changed: rewrites.map(function note(span,): string {
      return `${oneLine({ text: span.inner, },)} to ${span.form}`;
    },),
  };
}

/**
 Writes the page's quoted archive titles in the archive's italics, the slices
 no lane replaced included.

 @param slices - prepared pairs, whose archive text stands where no row replaces it

 @param replacements - what the page would write per slice

 @param archiveOriginalSpans - spans sealed as the English original

 @returns Replacements with the titles in italics (a row added for an archive
 slice the pass changed), the rewritten rows alone, and one finding per
 slice changed

 @example
 ```ts
 const page = restoreArchiveItalicTitles({ slices, replacements, archiveOriginalSpans: [], },);
 ```
 */
export function restoreArchiveItalicTitles(
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
   Words the archive sets in italics.
   */
  const titles = archiveItalicSpans({ slices, },);
  if (titles.size === 0) {
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
    rewrite: function rewrite({ text, },): TextRewrite {
      return italicizeSlice({
        text,
        titles,
      },);
    },
    findingName: 'archive-italic-title-restored',
  },);
}

//endregion Archive italic title restore
