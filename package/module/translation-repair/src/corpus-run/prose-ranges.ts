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
     Character under the cursor.
     */
    const character = text.charAt(state.at,);
    state.at += 1;
    if (state.quote !== '') {
      if (character === state.quote)
        state.quote = '';
      continue;
    }
    if ((character === '"') || (character === '\'')
      || (character === '`'))
      state.quote = character;
    else if (character === '{')
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
  if (character === '`')
    return pastMarker({
      text,
      marker: '`',
      from: at + 1,
    },);
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
