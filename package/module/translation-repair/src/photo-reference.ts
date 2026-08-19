//region Photo reference
// WHICH IMAGES A PASSAGE SHOWS, so a stage can be handed the picture rather
// than only the markup that names it.
//
// `#111` supplies the image to translators and judges, so a passage transcribed
// from one has a source that can be CHECKED rather than only preserved. The
// asset is already named in the markdown, so finding it is path work rather
// than a new corpus reader.
//
// ONE FORM, MEASURED. Across the pinned corpus the only image reference in any
// page is `<PhotoScroll photos={[ ... ]} />`, 173 occurrences, naming 380 assets
// of which 376 are `.webp` and 4 are `.jpg`. There are no markdown image
// references and no `<img>` elements, so this reader deliberately understands
// one construct rather than markdown's whole image vocabulary.
//
// THE PLACEHOLDER IS THE ENTRY. Every reference is written `${path}/photos/…`,
// where `${path}` stands for the entry's own directory. One reference in the
// corpus writes `${path} /photos/…` with a stray space, so the prefix is matched
// with whitespace tolerated rather than as a fixed string: a reader that missed
// that one asset would report an entry as having fewer images than it shows.
//
// NO REGEX, per `RG1`: the rule is "inside a PhotoScroll element, take every
// single-quoted string", which a scan states directly and in one pass.

/**
 * Element that names images in this corpus.
 */
const ELEMENT_OPEN = '<PhotoScroll';

/**
 * How an element's attributes end.
 */
const ELEMENT_CLOSE = '/>';

/**
 * Quote the corpus writes asset paths in.
 */
const QUOTE = '\'';

/**
 * Directory every asset sits in, under the entry's own directory.
 */
const ASSET_DIRECTORY = '/photos/';

/**
 * Placeholder standing for the entry's directory.
 */
const ENTRY_PLACEHOLDER = '${path}';

/**
 * One image a passage shows.
 *
 * @example
 * ```ts
 * const shown: PhotoReference = { assetName: 'intro.webp', };
 * ```
 */
export type PhotoReference = {
  /**
   * File name within the entry's `photos` directory.
   */
  readonly assetName: string;
};

/**
 * Reads every quoted string inside one element's attributes.
 *
 * @param text - passage to read
 *
 * @param from - offset of the element's opening
 *
 * @returns Quoted strings, and where the element ended
 *
 * @example
 * ```ts
 * const found = quotedWithin({ text, from, },);
 * ```
 */
function quotedWithin(
  {
    text,
    from,
  }: {
    readonly text: string;
    readonly from: number;
  },
): {
  readonly quoted: readonly string[];
  readonly ended: number;
} {
  /**
   * Where this element's attributes stop, or the end of the passage when the
   * element is never closed.
   */
  const closeAt = text.indexOf(ELEMENT_CLOSE, from,);

  /**
   * End of the region to read, exclusive.
   */
  const limit = (closeAt === (-1)) ? text.length : closeAt;

  /**
   * Strings found so far.
   */
  const quoted: string[] = [];

  /**
   * Cursor, walking quote to quote.
   */
  const at = { offset: from, };

  while (at.offset < limit) {
    /**
     * Opening quote of the next string.
     */
    const opened = text.indexOf(QUOTE, at.offset,);
    if ((opened === (-1)) || (opened >= limit))
      break;

    /**
     * Its closing quote.
     */
    const closed = text.indexOf(QUOTE, opened + 1,);
    if ((closed === (-1)) || (closed >= limit))
      break;

    quoted.push(text.slice(opened + 1, closed,),);
    at.offset = closed + 1;
  }

  return {
    quoted,
    ended: (closeAt === (-1)) ? text.length : (closeAt + ELEMENT_CLOSE.length),
  };
}

/**
 * Turns one quoted asset path into the file name it names.
 *
 * TOLERATES WHITESPACE AFTER THE PLACEHOLDER, because one reference in the
 * corpus writes `${path} /photos/…`. Reading it as a different prefix would
 * report that entry as showing one image fewer than it does.
 *
 * @param quoted - quoted string from a photo element
 *
 * @returns Asset file name, or absent when the string names something else
 *
 * @example
 * ```ts
 * const name = assetNameOf({ quoted: '${path}/photos/intro.webp', },);
 * ```
 */
function assetNameOf({ quoted, }: { readonly quoted: string; },): string | undefined {
  if (!quoted.startsWith(ENTRY_PLACEHOLDER,))
    return undefined;

  /**
   * Everything after the placeholder, whose leading whitespace is incidental.
   */
  const rest = quoted.slice(ENTRY_PLACEHOLDER.length,)
    .trimStart();
  if (!rest.startsWith(ASSET_DIRECTORY,))
    return undefined;

  /**
   * File name, which must not itself be a path.
   */
  const assetName = rest.slice(ASSET_DIRECTORY.length,);
  if ((assetName === '') || assetName.includes('/',))
    return undefined;
  return assetName;
}

/**
 * Every image one passage shows, in the order it shows them.
 *
 * @param text - passage to read
 *
 * @returns Images it names, empty when it names none
 *
 * @example
 * ```ts
 * const shown = photoReferences({ text: slice.target.text, },);
 * ```
 */
export function photoReferences({ text, }: { readonly text: string; },): readonly PhotoReference[] {
  /**
   * References found so far.
   */
  const found: PhotoReference[] = [];

  /**
   * Cursor, walking element to element.
   */
  const at = { offset: 0, };

  while (at.offset < text.length) {
    /**
     * Next photo element.
     */
    const opened = text.indexOf(ELEMENT_OPEN, at.offset,);
    if (opened === (-1))
      break;

    /**
     * Its quoted attribute strings.
     */
    const within = quotedWithin({
      text,
      from: opened + ELEMENT_OPEN.length,
    },);

    for (const quoted of within.quoted) {
      /**
       * File name this string names, absent when it names something else.
       */
      const assetName = assetNameOf({ quoted, },);
      if (assetName !== undefined)
        found.push({ assetName, },);
    }
    at.offset = Math.max(within.ended, opened + ELEMENT_OPEN.length,);
  }

  return found;
}

/**
 * Where an entry's asset sits within the corpus.
 *
 * @param entryId - corpus entry
 *
 * @param assetName - file name within its photos directory
 *
 * @returns Repository-relative path
 *
 * @example
 * ```ts
 * const path = photoPath({ entryId: 'Tabby', assetName: 'intro.webp', },);
 * ```
 */
export function photoPath(
  {
    entryId,
    assetName,
  }: {
    readonly entryId: string;
    readonly assetName: string;
  },
): string {
  return `people/${entryId}${ASSET_DIRECTORY}${assetName}`;
}

//endregion Photo reference
