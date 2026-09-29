import { isAsciiDigits, } from './ascii-letters.ts';

//region Reference line head
// The head every cited-reference line opens with, written by the lookup and
// read back by the attestation, which looks for a reference quote in the one
// line of the reference an item names (ledger B25). Writer and reader share
// this module so the reader cannot drift from what is written.

/**
 What every reference line opens with, before its number.
 */
const REFERENCE_LINE_MARK = '- reference ';

/**
 Between reference lines in a block.
 */
const LINE_BREAK = '\n';

/**
 What `indexOf` answers when nothing is found.
 */
const NOT_FOUND = -1;

/**
 Head of one reference line: the mark, the position and the page, before
 the title and text the lookup writes after it.

 @param index - position among the entry's references, from one

 @param url - page as the original links it

 @returns Head, without what follows it

 @example
 ```ts
 referenceLineHead({ index: 2, url: 'https://cats.example/b', },);
 // => '- reference 2 https://cats.example/b'
 ```
 */
export function referenceLineHead(
  {
    index,
    url,
  }: {
    readonly index: number;
    readonly url: string;
  },
): string {
  return `${REFERENCE_LINE_MARK}${String(index,)} ${url}`;
}

/**
 One reference line read back with the number its head carries.

 @example
 ```ts
 const line: NumberedReferenceLine = { reference: 1, line: '- reference 1 https://cats.example/a: Mittens naps.', };
 ```
 */
export type NumberedReferenceLine = {
  /**
   Number the head carries, from one.
   */
  readonly reference: number;
  /**
   Whole line, head included.
   */
  readonly line: string;
};

/**
 A line in a reference block that does not open with a numbered head. The
 lookup writes one line per reference and folds every text it puts on it,
 so such a line is a defect upstream, not text to guess a number for.

 @example
 ```ts
 throw new ReferenceLineHeadError({ position: 2, count: 3, },);
 ```
 */
export class ReferenceLineHeadError extends Error {
  /**
   Builds the refusal naming where the line sits, never what it says, since
   a reference line carries a fetched page's text.

   @param position - which line of the block, from one

   @param count - lines in the block

   @example
   ```ts
   new ReferenceLineHeadError({ position: 2, count: 3, },);
   ```
   */
  constructor({
    position,
    count,
  }: {
    readonly position: number;
    readonly count: number;
  },) {
    super(
      `reference line ${String(position,)} of ${String(count,)} does not open with "${REFERENCE_LINE_MARK}<number> ", `
        + 'so the reference it belongs to cannot be read; the block must be one referenceLineOf line per reference',
    );
    this.name = 'ReferenceLineHeadError';
  }
}

/**
 Lines of a reference block, each with the number its head carries. An
 empty block is an original that links nowhere and has no lines.

 @param referenceContext - reference lines as `citedReferenceBlock` joins them

 @returns Lines in block order

 @throws ReferenceLineHeadError when a line does not open with a numbered head

 @example
 ```ts
 numberedReferenceLines({ referenceContext: '- reference 1 https://cats.example/a: Mittens naps.', },);
 // => [{ reference: 1, line: '- reference 1 https://cats.example/a: Mittens naps.', }]
 ```
 */
export function numberedReferenceLines(
  { referenceContext, }: { readonly referenceContext: string; },
): readonly NumberedReferenceLine[] {
  if (referenceContext === '')
    return [];
  /**
   Lines as written.
   */
  const lines = referenceContext.split(LINE_BREAK,);
  return lines.map(function numbered(
    line,
    at,
  ): NumberedReferenceLine {
    /**
     Line after the mark, opening with the number; empty without the mark.
     */
    const rest = line.startsWith(REFERENCE_LINE_MARK,) ? line.slice(REFERENCE_LINE_MARK.length,) : '';
    /**
     Where the number ends.
     */
    const numberEnd = rest.indexOf(' ',);
    /**
     Number as written, empty when there is no head.
     */
    const digits = (numberEnd === NOT_FOUND) ? '' : rest.slice(
      0,
      numberEnd,
    );
    if (!isAsciiDigits({ text: digits, },)) {
      throw new ReferenceLineHeadError({
        position: at + 1,
        count: lines.length,
      },);
    }
    return {
      reference: Number(digits,),
      line,
    };
  },);
}

//endregion Reference line head
