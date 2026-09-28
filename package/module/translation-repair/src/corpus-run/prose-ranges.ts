//region Prose ranges
// CLASS ONE HUNDRED THIRTY-FOUR (hulicaijia19, 2026-09-25): a pass that
// rewrites the page's own English (dates, spellings) must leave everything
// that is not prose as it stands: a tag and its attributes (`text-align:
// center` is CSS, not a word), a JSX expression, a link destination, a bare
// URL, inline and fenced code, an HTML comment and the front matter. Each is
// found by one index scan and returned as a half-open range the rewrite may
// not touch.

/**
 One half-open range of a text the rewrite leaves alone.
 */
export type ProtectedRange = {
  readonly start: number;
  readonly end: number;
};

/**
 Opening of an HTML comment.
 */
const COMMENT_OPEN = '<!--';

/**
 Closing of an HTML comment.
 */
const COMMENT_CLOSE = '-->';

/**
 Fence a front matter block opens and closes with.
 */
const FRONT_MATTER_FENCE = '---\n';

/**
 Fence a code block opens and closes with.
 */
const CODE_FENCE = '```';

/**
 Characters that end a bare URL.
 */
const URL_END: ReadonlySet<string> = new Set([
  ' ',
  '\n',
  '\t',
  ')',
  '>',
  '"',
  '<',
],);

/**
 Schemes that open a bare URL.
 */
const URL_SCHEMES: readonly string[] = [
  'https://',
  'http://',
];

/**
 Where a closing marker ends, or the text's end when it never closes.

 @param text - text under scan

 @param marker - closing marker

 @param from - where to look from

 @returns Offset just past the marker, or the text's length

 @example
 ```ts
 pastMarker({ text: 'a --> b', marker: '-->', from: 0, },); // 5
 ```
 */
function pastMarker(
  {
    text,
    marker,
    from,
  }: {
    readonly text: string;
    readonly marker: string;
    readonly from: number;
  },
): number {
  /**
   Where the marker starts, or minus one.
   */
  const at = text.indexOf(
    marker,
    from,
  );
  return (at === (-1)) ? text.length : at + marker.length;
}

/**
 Where a run of backticks starting at one offset ends.

 @param text - text under scan

 @param from - offset of the run's first backtick

 @returns Offset just past the run

 @example
 ```ts
 backtickRunEnd({ text: '``x', from: 0, },); // 2
 ```
 */
function backtickRunEnd(
  {
    text,
    from,
  }: {
    readonly text: string;
    readonly from: number;
  },
): number {
  for (let at = from; at < text.length; at += 1) {
    if (text.charAt(at,) !== '`')
      return at;
  }
  return text.length;
}

/**
 Where an inline code span opened by the backtick run at one offset ends: at
 the next run of exactly as many backticks inside the same paragraph
 (CommonMark). A run with no such partner is literal text (ledger K7: a stray
 backtick shielded the rest of the text, and a double-backtick span closed at
 the single backtick inside it).

 @param text - text under scan

 @param at - offset of the run's first backtick

 @returns Offset just past the closing run, or minus one where the run is
 literal

 @example
 ```ts
 codeSpanEnd({ text: '``a `b` c`` d', at: 0, },); // 11
 ```
 */
function codeSpanEnd(
  {
    text,
    at,
  }: {
    readonly text: string;
    readonly at: number;
  },
): number {
  /**
   The opening run's length.
   */
  const length = backtickRunEnd({
    text,
    from: at,
  },) - at;
  /**
   Where the paragraph ends, past which no span closes.
   */
  const blankLine = text.indexOf(
    '\n\n',
    at,
  );
  /**
   Offset no closing run may start at or past.
   */
  const limit = (blankLine === (-1)) ? text.length : blankLine;
  for (let from = at + length; from < limit;) {
    /**
     Next backtick at or after the cursor.
     */
    const close = text.indexOf(
      '`',
      from,
    );
    if ((close === (-1)) || (close >= limit))
      return -1;
    /**
     Where that run ends.
     */
    const closeEnd = backtickRunEnd({
      text,
      from: close,
    },);
    if ((closeEnd - close) === length)
      return closeEnd;
    from = closeEnd;
  }
  return -1;
}

/**
 Whether a quote mark opened just before one offset closes on its line.

 @param text - text under scan

 @param at - offset just past the opening mark

 @param quote - the opening mark

 @returns Whether the same mark stands again before the next line break

 @example
 ```ts
 closesOnLine({ text: "{cat's} nap", at: 5, quote: "'", },); // false
 ```
 */
function closesOnLine(
  {
    text,
    at,
    quote,
  }: {
    readonly text: string;
    readonly at: number;
    readonly quote: string;
  },
): boolean {
  /**
   Where the partner stands, or minus one.
   */
  const close = text.indexOf(
    quote,
    at,
  );
  /**
   Where the line ends, or minus one.
   */
  const newline = text.indexOf(
    '\n',
    at,
  );
  return (close !== (-1)) && ((newline === (-1)) || (close < newline));
}

/**
 Where a JavaScript comment opening at one offset ends.

 @param text - text under scan

 @param at - offset under the cursor

 @returns Offset just past a block comment's close or a line comment's line,
 or minus one where no comment opens here

 @example
 ```ts
 jsCommentEnd({ text: "/* cat's *\/ x", at: 0, },); // 11
 ```
 */
function jsCommentEnd(
  {
    text,
    at,
  }: {
    readonly text: string;
    readonly at: number;
  },
): number {
  if (text.startsWith(
    '/*',
    at,
  )) {
    return pastMarker({
      text,
      marker: '*/',
      from: at + 2,
    },);
  }
  if (!text.startsWith(
    '//',
    at,
  ))
    return -1;
  /**
   Where the line comment's line ends.
   */
  const newline = text.indexOf(
    '\n',
    at,
  );
  return (newline === (-1)) ? text.length : newline;
}

/**
 Where a tag or JSX expression opened at one offset ends: the first `>` (for
 a tag) or the matching `}` (for an expression) outside quotes and nested
 braces.

 @param text - text under scan

 @param from - offset of the opening `<` or `{`

 @returns Offset just past the construct, or the text's length

 @example
 ```ts
 pastConstruct({ text: '<p a="x>y">', from: 0, },); // 11
 ```
 */
function pastConstruct(
  {
    text,
    from,
  }: {
    readonly text: string;
    readonly from: number;
  },
): number {
  /**
   Whether the construct is a tag, closed by `>`, or an expression, closed
   by its matching brace.
   */
  const isTag = text.charAt(from,) === '<';
  /**
   Brace depth, quote in force and position, carried through the scan.
   */
  const state = {
    depth: isTag ? 0 : 1,
    quote: '',
    at: from + 1,
  };
  while (state.at < text.length) {
    /**
     Where a comment opening here ends, inside an expression, where quote
     marks are prose (ledger K7: "{/* cat's note *\/}" opened a quote that
     never closed and shielded the rest of the text).
     */
    const commentEnd = ((state.quote === '') && ((!isTag) || (state.depth > 0)))
      ? jsCommentEnd({
        text,
        at: state.at,
      },)
      : -1;
    if (commentEnd !== (-1)) {
      state.at = commentEnd;
      continue;
    }
    /**
     Character under the cursor.
     */
    const character = text.charAt(state.at,);
    state.at += 1;
    if (state.quote !== '') {
      if (character === state.quote)
        state.quote = '';
      continue;
    }
    /**
     Whether an attribute value may run on across lines here, as a tag's
     does; a JavaScript string in an expression ends on its line, so a quote
     mark with no partner there is a stray apostrophe, not a string.
     */
    const multiline = isTag && (state.depth === 0);
    if (character === '`')
      state.quote = character;
    else if ((character === '"') || (character === '\'')) {
      if (multiline || closesOnLine({
        text,
        at: state.at,
        quote: character,
      },))
        state.quote = character;
    } else if (character === '{')
      state.depth += 1;
    else if (character === '}') {
      state.depth -= 1;
      if ((!isTag) && (state.depth === 0))
        return state.at;
    } else if (isTag && (character === '>')
      && (state.depth === 0))
      return state.at;
  }
  return text.length;
}

/**
 Whether a `<` at one offset opens a tag rather than standing as a character.

 @param text - text under scan

 @param at - offset of the `<`

 @returns Whether a letter or `/` follows it

 @example
 ```ts
 opensTag({ text: 'a < b', at: 2, },); // false
 ```
 */
function opensTag(
  {
    text,
    at,
  }: {
    readonly text: string;
    readonly at: number;
  },
): boolean {
  /**
   Character after the `<`.
   */
  const next = text.charAt(at + 1,);
  return (next === '/') || (next.toLowerCase() !== next.toUpperCase());
}

/**
 Where the construct starting at one offset ends, or minus one where no
 protected construct starts there.

 @param text - text under scan

 @param at - offset under the cursor

 @returns Offset just past the construct, or minus one

 @example
 ```ts
 constructEnd({ text: '`x` y', at: 0, },); // 3
 ```
 */
function constructEnd(
  {
    text,
    at,
  }: {
    readonly text: string;
    readonly at: number;
  },
): number {
  if (text.startsWith(
    COMMENT_OPEN,
    at,
  ))
    return pastMarker({
      text,
      marker: COMMENT_CLOSE,
      from: at + COMMENT_OPEN.length,
    },);
  if (text.startsWith(
    CODE_FENCE,
    at,
  ))
    return pastMarker({
      text,
      marker: CODE_FENCE,
      from: at + CODE_FENCE.length,
    },);
  /**
   Character under the cursor.
   */
  const character = text.charAt(at,);
  if (character === '`') {
    return (text.charAt(at - 1,) === '`')
      ? -1
      : codeSpanEnd({
        text,
        at,
      },);
  }
  if ((character === '<') && opensTag({
    text,
    at,
  },))
    return pastConstruct({
      text,
      from: at,
    },);
  if (character === '{')
    return pastConstruct({
      text,
      from: at,
    },);
  if (text.startsWith(
    '](',
    at,
  ))
    return pastMarker({
      text,
      marker: ')',
      from: at + 2,
    },);
  if (URL_SCHEMES.some(function opens(scheme,): boolean {
    return text.startsWith(
      scheme,
      at,
    );
  },)) {
    /**
     Where the URL stops.
     */
    let end = at;
    while ((end < text.length) && (!URL_END.has(text.charAt(end,),)))
      end += 1;
    return end;
  }
  return -1;
}

/**
 Every range of a text that is not prose, in order.

 @param text - text under scan

 @returns Protected ranges, non-overlapping and in order

 @example
 ```ts
 protectedRanges({ text: 'a `b` c', },); // [{ start: 2, end: 5 }]
 ```
 */
export function protectedRanges(
  { text, }: { readonly text: string; },
): readonly ProtectedRange[] {
  /**
   Ranges found so far.
   */
  const ranges: ProtectedRange[] = [];
  /**
   Where the scan resumes: past the front matter when the text opens with it.
   */
  let at = 0;
  if (text.startsWith(FRONT_MATTER_FENCE,)) {
    at = pastMarker({
      text,
      marker: `\n${FRONT_MATTER_FENCE}`,
      from: FRONT_MATTER_FENCE.length - 1,
    },);
    ranges.push({
      start: 0,
      end: at,
    },);
  }
  while (at < text.length) {
    /**
     End of a construct opening here, or minus one.
     */
    const end = constructEnd({
      text,
      at,
    },);
    if (end === (-1)) {
      at += 1;
      continue;
    }
    ranges.push({
      start: at,
      end,
    },);
    at = end;
  }
  return ranges;
}

/**
 Whether a span lies wholly outside every protected range.

 @param ranges - protected ranges of the text

 @param start - span's first offset

 @param end - span's exclusive end

 @returns Whether no range overlaps the span

 @example
 ```ts
 inProse({ ranges: [{ start: 2, end: 5 }], start: 6, end: 8, },); // true
 ```
 */
export function inProse(
  {
    ranges,
    start,
    end,
  }: {
    readonly ranges: readonly ProtectedRange[];
    readonly start: number;
    readonly end: number;
  },
): boolean {
  return ranges.every(function apart(range,): boolean {
    return (range.end <= start) || (range.start >= end);
  },);
}
//endregion Prose ranges
