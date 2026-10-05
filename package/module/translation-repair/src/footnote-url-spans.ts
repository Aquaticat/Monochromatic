//region Footnote URL spans
// Where a text keeps a link's URL, so a footnote marker shape read inside one
// is not counted as a mention (ledger B159). `footnote-mentions.ts` scans raw
// fragments and deliberately does not parse them, so this is a bounded
// lexical reading of the three places a URL stands: an inline link's
// destination, an angle autolink, and a bare `http://`, `https://` or `www.`
// literal. Each scan stops at the next whitespace or `<`, and a failed scan
// resumes one character on, so the whole pass is linear.
//
// THE GRAPH READS THE SAME SHAPES FROM THE PARSE (`footnote-graph.ts` skips
// the text of a tokenized literal and of an angle autolink, and an
// unpositioned run's link text). A marker in a link's LABEL is no URL and is
// not skipped.

/**
 Raw span of one URL in a text, the end exclusive.

 @example
 ```ts
 const span: UrlSpan = { start: 8, end: 31, };
 ```
 */
export type UrlSpan = {
  /**
   Offset of the URL's first character.
   */
  readonly start: number;
  /**
   Offset after the URL's last character.
   */
  readonly end: number;
};

/**
 No URL stands at this offset, distinct from a span that is empty.

 @example
 ```ts
 if (urlSpanAt({ text, offset, },) === NO_URL_SPAN) advance();
 ```
 */
const NO_URL_SPAN: unique symbol = Symbol('no URL starts at this offset',);

/**
 Letters a URL scheme starts with.
 */
const SCHEME_LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 Characters a URL scheme continues with, after its first letter.
 */
const SCHEME_CONTINUATION = `${SCHEME_LETTERS}0123456789+.-`;

/**
 Longest scheme CommonMark gives an autolink, in characters.
 */
const MAX_SCHEME_LENGTH = 32;

/**
 Shortest scheme CommonMark gives an autolink, in characters.
 */
const MIN_SCHEME_LENGTH = 2;

/**
 Characters a bare literal may follow, besides whitespace and the text's start.
 */
const LITERAL_PRECEDERS = '*_~(';

/**
 Beginnings of a bare literal, compared in lower case.
 */
const LITERAL_STARTS: readonly string[] = [
  'http://',
  'https://',
  'www.',
];

/**
 Longest beginning of a bare literal, in characters.
 */
const LONGEST_LITERAL_START = 8;

/**
 Whether one character is whitespace or a control character, which ends a URL.
 The empty string, which `charAt` answers past the text's end, ends one too.

 @param character - one character, or the empty string past the text's end

 @returns Whether a URL scan stops here

 @example
 ```ts
 const stops = endsUrl({ character: text.charAt(offset,), },);
 ```
 */
function endsUrl({ character, }: { readonly character: string; },): boolean {
  return (character < ' ') || (character.trim() === '');
}

/**
 Finds where an inline link's bare destination ends: at the first whitespace,
 or the first `)` its own parentheses do not balance, a backslash escaping the
 next character.

 @param text - fragment read

 @param start - offset of the destination's first character

 @returns Offset after the destination's last character

 @example
 ```ts
 const end = bareDestinationEndAt({ text: '(https://cat.example)', start: 1, },);
 ```
 */
function bareDestinationEndAt(
  {
    text,
    start,
  }: {
    readonly text: string;
    readonly start: number;
  },
): number {
  for (let cursor = start, depth = 0; cursor < text.length; cursor += 1) {
    /**
     Character under the scan.
     */
    const character = text.charAt(cursor,);
    if (endsUrl({ character, },))
      return cursor;
    if (character === '\\')
      cursor += 1;
    else if (character === '(')
      depth += 1;
    else if (character === ')') {
      if (depth === 0)
        return cursor;
      depth -= 1;
    }
  }
  return text.length;
}

/**
 Reads an inline link's destination, which starts after `](`.

 An angle destination runs to its `>`, and holds no `<` or line break; a bare
 one is read by {@link bareDestinationEndAt}.

 @param text - fragment read

 @param offset - offset of the `]` that may close a link label

 @returns The destination's span, or {@link NO_URL_SPAN} when none starts here

 @example
 ```ts
 const span = destinationSpanAt({ text: '[a](https://cat.example)', offset: 2, },);
 ```
 */
function destinationSpanAt(
  {
    text,
    offset,
  }: {
    readonly text: string;
    readonly offset: number;
  },
): UrlSpan | typeof NO_URL_SPAN {
  if (!text.startsWith(
    '](',
    offset,
  ))
    return NO_URL_SPAN;
  /**
   First character of the destination.
   */
  const start = offset + 2;
  if (text.charAt(start,) === '<') {
    for (let cursor = start + 1; cursor < text.length; cursor += 1) {
      /**
       Character under the angle destination's scan.
       */
      const character = text.charAt(cursor,);
      if (character === '>') {
        return {
          start,
          end: cursor + 1,
        };
      }
      if ((character === '<') || (character === '\n'))
        return NO_URL_SPAN;
    }
    return NO_URL_SPAN;
  }
  /**
   Offset after the bare destination.
   */
  const end = bareDestinationEndAt({
    text,
    start,
  },);
  return (end === start) ? NO_URL_SPAN : {
    start,
    end,
  };
}

/**
 Finds the end of the scheme an angle autolink opens with: the run of scheme
 characters from its first letter.

 @param text - fragment read

 @param start - offset of the scheme's first character

 @returns Offset after the run, `start` itself when the first character is no letter

 @example
 ```ts
 const end = schemeEndAt({ text: 'https://cat.example', start: 0, },);
 ```
 */
function schemeEndAt(
  {
    text,
    start,
  }: {
    readonly text: string;
    readonly start: number;
  },
): number {
  for (let cursor = start; cursor < text.length; cursor += 1) {
    /**
     Characters this position may carry.
     */
    const allowed = (cursor === start) ? SCHEME_LETTERS : SCHEME_CONTINUATION;
    if (!allowed.includes(text.charAt(cursor,),))
      return cursor;
  }
  return text.length;
}

/**
 Reads an angle autolink, `<scheme:rest>`, whose rest holds no whitespace or `<`.

 @param text - fragment read

 @param offset - offset of the `<` that may open one

 @returns The autolink's span with its brackets, or {@link NO_URL_SPAN}

 @example
 ```ts
 const span = angleSpanAt({ text: '<https://cat.example>', offset: 0, },);
 ```
 */
function angleSpanAt(
  {
    text,
    offset,
  }: {
    readonly text: string;
    readonly offset: number;
  },
): UrlSpan | typeof NO_URL_SPAN {
  if (text.charAt(offset,) !== '<')
    return NO_URL_SPAN;
  /**
   First character of the scheme.
   */
  const start = offset + 1;
  /**
   Offset of the colon that ends a scheme.
   */
  const colon = schemeEndAt({
    text,
    start,
  },);
  if (text.charAt(colon,) !== ':')
    return NO_URL_SPAN;
  /**
   Characters the scheme holds.
   */
  const schemeLength = colon - start;
  if ((schemeLength < MIN_SCHEME_LENGTH) || (schemeLength > MAX_SCHEME_LENGTH))
    return NO_URL_SPAN;
  for (let cursor = colon + 1; cursor < text.length; cursor += 1) {
    /**
     Character under the autolink's scan.
     */
    const character = text.charAt(cursor,);
    if (character === '>') {
      return {
        start: offset,
        end: cursor + 1,
      };
    }
    if ((character === '<') || endsUrl({ character, },))
      return NO_URL_SPAN;
  }
  return NO_URL_SPAN;
}

/**
 Whether GFM lets a bare literal begin after this character.

 @param before - character before the offset, empty at the text's start

 @returns Whether a literal may begin here

 @example
 ```ts
 const may = mayPrecedeLiteral({ before: '(', },);
 ```
 */
function mayPrecedeLiteral({ before, }: { readonly before: string; },): boolean {
  if ((before === '') || endsUrl({ character: before, },))
    return true;
  return LITERAL_PRECEDERS.includes(before,);
}

/**
 Reads a bare literal, which begins where GFM lets one and runs to the next
 whitespace or `<`.

 @param text - fragment read

 @param offset - offset a literal may begin at

 @returns The literal's span, or {@link NO_URL_SPAN}

 @example
 ```ts
 const span = literalSpanAt({ text: 'see www.cat.example', offset: 4, },);
 ```
 */
function literalSpanAt(
  {
    text,
    offset,
  }: {
    readonly text: string;
    readonly offset: number;
  },
): UrlSpan | typeof NO_URL_SPAN {
  if (!mayPrecedeLiteral({ before: text.charAt(offset - 1,), },))
    return NO_URL_SPAN;
  /**
   Opening characters, lower-cased for comparison.
   */
  const opening = text
    .slice(
      offset,
      offset + LONGEST_LITERAL_START,
    )
    .toLowerCase();
  if (!LITERAL_STARTS.some(function opens(start,): boolean {
    return opening.startsWith(start,);
  },))
    return NO_URL_SPAN;
  for (let cursor = offset; cursor < text.length; cursor += 1) {
    /**
     Character under the literal's scan.
     */
    const character = text.charAt(cursor,);
    if ((character === '<') || endsUrl({ character, },)) {
      return {
        start: offset,
        end: cursor,
      };
    }
  }
  return {
    start: offset,
    end: text.length,
  };
}

/**
 Reads the URL that starts at one offset, whichever of the three shapes it is.

 @param text - fragment read

 @param offset - offset to try

 @returns The URL's span, or {@link NO_URL_SPAN}

 @example
 ```ts
 const span = urlSpanAt({ text: '<https://cat.example>', offset: 0, },);
 ```
 */
function urlSpanAt(
  {
    text,
    offset,
  }: {
    readonly text: string;
    readonly offset: number;
  },
): UrlSpan | typeof NO_URL_SPAN {
  /**
   Inline link destination starting here.
   */
  const destination = destinationSpanAt({
    text,
    offset,
  },);
  if (destination !== NO_URL_SPAN)
    return destination;
  /**
   Angle autolink starting here.
   */
  const angle = angleSpanAt({
    text,
    offset,
  },);
  if (angle !== NO_URL_SPAN)
    return angle;
  return literalSpanAt({
    text,
    offset,
  },);
}

/**
 Every URL a fragment keeps, in source order and disjoint.

 @param text - fragment read, never parsed

 @returns Spans of inline destinations, angle autolinks and bare literals

 @example
 ```ts
 const spans = urlSpansOf({ text: 'See https://cat.example/[^9]x [^1].', },);
 ```
 */
export function urlSpansOf({ text, }: { readonly text: string; },): readonly UrlSpan[] {
  /**
   Owned result list.
   */
  const spans: UrlSpan[] = [];
  for (let cursor = 0; cursor < text.length; cursor += 1) {
    /**
     URL starting at the cursor, when one does.
     */
    const span = urlSpanAt({
      text,
      offset: cursor,
    },);
    if (span === NO_URL_SPAN)
      continue;
    spans.push(span,);
    // The loop's own step moves past the span's last character.
    cursor = span.end - 1;
  }
  return spans;
}

/**
 Whether an offset lies inside one of the spans, by binary search over their
 order.

 @param spans - disjoint spans in source order

 @param offset - offset to place

 @returns Whether a span holds the offset

 @example
 ```ts
 const inside = insideUrlSpan({ spans: urlSpansOf({ text, },), offset: 20, },);
 ```
 */
export function insideUrlSpan(
  {
    spans,
    offset,
  }: {
    readonly spans: readonly UrlSpan[];
    readonly offset: number;
  },
): boolean {
  for (let high = spans.length, low = 0; low < high;) {
    /**
     Middle of the indices in play.
     */
    const middle = Math.floor((low + high) / 2,);
    /**
     Span at that index, present because the middle lies inside the range.
     */
    const span = spans[middle];
    if (span === undefined)
      throw new Error(`unreachable: no span at index ${String(middle,)} of the spans a search was given`,);
    if (offset < span.start)
      high = middle;
    else if (offset >= span.end)
      low = middle + 1;
    else
      return true;
  }
  return false;
}

//endregion Footnote URL spans
