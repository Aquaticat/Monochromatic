//region Channel marker tails
// A provider emits special tokens of the shape `<|word|>` and filters them out
// of streamed content. The filter is not atomic across event boundaries, so
// when a token straddles two deltas a TAIL of it survives and lands in front of
// otherwise correct JSON.
//
// Observed on `hf:moonshotai/Kimi-K3`: `|>` on 2026-08-12, then `p|>` and
// `ep|>` on 2026-08-13, all three being suffixes of the same `<|...|>` shape.
// The first fix matched the exact string `|>` and therefore stopped working the
// moment the surviving tail grew by one character, which is how 21 of the 23
// voices lost in the most recent run window were lost.
//
// SO THE RULE IS THE SHAPE, NOT A VOCABULARY. Matching a list of known tokens
// would require knowing the provider's special-token set, which we do not and
// cannot read from here; every tail of every marker is covered by checking that
// what sits in front of the JSON could only be the end of a `<|word|>`.
//
// The property the previous implementation protected is kept: this refuses to
// be a general "skip junk until the first brace" rule, which would swallow a
// model prefixing an apology or partial refusal and turn content the refusal
// detector must classify into a silent parse success. An apology carries spaces
// and does not close with `|>` inside a dozen characters, so it still fails to
// parse, loudly.

/**
 * Longest marker tail considered.
 *
 * `<|im_start|>` is twelve characters, so a whole marker of that family fits
 * and anything longer is prose that happens to contain the closing characters.
 */
const MARKER_TAIL_LIMIT = 12;

/**
 * Characters every marker of this family ends with.
 */
const MARKER_CLOSE = '|>';

/**
 * Characters a whole, untruncated marker begins with.
 *
 * Optional here precisely because the interesting case is the one where the
 * opening did not survive.
 */
const MARKER_OPEN = '<|';

/**
 * Reports whether a character can appear in a marker's name.
 *
 * Compared by code point rather than by pattern, since the alphabet is three
 * contiguous ranges plus one character and an index scan states that directly.
 *
 * @param character - single character from the candidate marker
 *
 * @returns True for ASCII letters, digits and underscore
 *
 * @example
 * ```ts
 * const ok = isMarkerBodyCharacter({ character: 'p', },);
 * ```
 */
function isMarkerBodyCharacter(
  {
    character,
  }: {
    readonly character: string;
  },
): boolean {
  return ((character >= 'a') && (character <= 'z'))
    || ((character >= 'A') && (character <= 'Z'))
    || ((character >= '0') && (character <= '9'))
    || (character === '_');
}

/**
 * Content with any marker tail removed, and the tail that was removed.
 *
 * `marker` is empty when nothing was stripped, rather than absent, because the
 * caller logs it and an empty string reads as "nothing to report" at the call
 * site without a nullish check.
 *
 * @example
 * ```ts
 * const { content, marker, } = stripChannelMarker({ text: 'p|>{"count":2}', },);
 * ```
 */
export type ChannelMarkerStrip = {
  /**
   * Content the parser should see.
   */
  readonly content: string;

  /**
   * Exact fragment removed, empty when the input was left untouched.
   */
  readonly marker: string;
};

/**
 * Removes a truncated provider channel marker sitting in front of JSON.
 *
 * Strips only when the leading fragment is shaped like the end of a `<|word|>`
 * token AND what follows opens a JSON value, so a reply that merely begins with
 * those characters and then says something else still fails to parse.
 *
 * @param text - model content, fence already removed
 *
 * @returns Content without the marker, plus the marker for the caller to log
 *
 * @example
 * ```ts
 * const { content, marker, } = stripChannelMarker({ text: 'ep|>{"count":2}', },);
 * ```
 */
export function stripChannelMarker(
  {
    text,
  }: {
    readonly text: string;
  },
): ChannelMarkerStrip {
  /**
   * Nothing removed, which every rejection below returns.
   */
  const untouched: ChannelMarkerStrip = {
    content: text,
    marker: '',
  };

  /**
   * Input without leading whitespace so the marker sits at column zero.
   */
  const trimmed = text.trimStart();

  /**
   * Where the marker would close, taking the FIRST closing characters so a
   * `|>` occurring later inside the JSON cannot extend the candidate.
   */
  const closeAt = trimmed.indexOf(MARKER_CLOSE,);
  if (closeAt === (-1))
    return untouched;

  /**
   * Length of the whole candidate marker, closing characters included.
   */
  const markerLength = closeAt + MARKER_CLOSE.length;
  if (markerLength > MARKER_TAIL_LIMIT)
    return untouched;

  /**
   * Candidate marker with its closing characters removed.
   */
  const head = trimmed.slice(
    0,
    closeAt,
  );

  /**
   * Marker name, with the opening characters removed when they survived.
   */
  const body = head.startsWith(MARKER_OPEN,)
    ? head.slice(MARKER_OPEN.length,)
    : head;

  for (const character of body) {
    if (!isMarkerBodyCharacter({ character, },))
      return untouched;
  }

  /**
   * What follows the marker, which must itself open a JSON value.
   */
  const rest = trimmed
    .slice(markerLength,)
    .trimStart();
  if (!(rest.startsWith('{',) || rest.startsWith('[',)))
    return untouched;

  return {
    content: rest,
    marker: trimmed.slice(
      0,
      markerLength,
    ),
  };
}

//endregion Channel marker tails
