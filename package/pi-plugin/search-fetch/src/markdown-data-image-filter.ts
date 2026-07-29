/**
 * Markdown data-image filtering for fetched page responses.
 *
 * @module
 */

//region Constants

/**
 * Markdown inline-image opening token.
 */
const IMAGE_OPEN = '![';

/**
 * Data URL prefix limited to image media types.
 */
const IMAGE_DATA_PREFIX = 'data:image/';

/**
 * Data URL marker introducing base64 payload bytes.
 */
const BASE64_MARKER = ';base64,';

/**
 * Parser result for unsupported or malformed Markdown syntax.
 */
const UNPARSEABLE_MARKDOWN: unique symbol = Symbol('Markdown candidate is unsupported or malformed',);

//endregion Constants

//region Types

/**
 * Half-open character range inside Markdown text.
 */
type CharacterRange = {
  /**
   * Inclusive range start.
   */
  readonly start: number;
  /**
   * Exclusive range end.
   */
  readonly end: number;
};

/**
 * Parsed value or domain-specific rejection sentinel.
 */
type MarkdownParseResult<Value> = Value | typeof UNPARSEABLE_MARKDOWN;

/**
 * Filtered Markdown and removal count.
 */
type MarkdownDataImageFilterResult = {
  /**
   * Markdown after base64-backed inline images are removed.
   */
  readonly markdown: string;
  /**
   * Number of removed image constructs.
   */
  readonly removedImageCount: number;
};

/**
 * Fetch response after Markdown filtering.
 */
type FetchResponseDataImageFilterResult = {
  /**
   * Original response or shallow copy carrying filtered Markdown.
   */
  readonly linkupResponse: unknown;
  /**
   * Number of removed image constructs.
   */
  readonly removedImageCount: number;
};

//endregion Types

//region Public API

/**
 * Remove inline base64 image constructs from Markdown in a fetched response.
 *
 * A construct that owns its physical lines removes those complete lines.
 * Inline constructs remove only their Markdown span so surrounding prose survives.
 * Non-Markdown response shapes and responses without matching images retain identity.
 *
 * @param response - parsed provider response
 *
 * @returns response for model-visible output and removal count
 *
 * @example
 * ```ts
 * filterFetchResponseDataImages({ markdown: 'Before\n![logo](data:image/png;base64,AAAA)\nAfter' });
 * ```
 */
function filterFetchResponseDataImages(response: unknown,): FetchResponseDataImageFilterResult {
  if (!hasMarkdownString(response,))
    return {
      linkupResponse: response,
      removedImageCount: 0,
    };

  /**
   * Markdown-specific filter result.
   */
  const filtered = filterMarkdownDataImages(response.markdown,);
  if (filtered.removedImageCount === 0)
    return {
      linkupResponse: response,
      removedImageCount: 0,
    };

  return {
    linkupResponse: {
      ...response,
      markdown: filtered.markdown,
    },
    removedImageCount: filtered.removedImageCount,
  };
}

/**
 * Remove Markdown inline images whose destinations are base64 image data URLs.
 *
 * @param markdown - fetched page Markdown
 *
 * @returns filtered Markdown and removed image count
 *
 * @example
 * ```ts
 * filterMarkdownDataImages('Text ![logo](data:image/png;base64,AAAA) remains.');
 * ```
 */
function filterMarkdownDataImages(markdown: string,): MarkdownDataImageFilterResult {
  return (function scanMarkdownDataImages(): MarkdownDataImageFilterResult {
    /**
     * Retained text chunks joined once after scanning.
     */
    const retainedChunks: string[] = [];
    /**
     * Start of text not yet copied into retained chunks.
     */
    let retainedStart = 0;
    /**
     * Search start for next inline-image opener.
     */
    let searchStart = 0;
    /**
     * Number of accepted image constructs removed so far.
     */
    let removedImageCount = 0;
    /**
     * Next possible inline-image opener.
     */
    let imageStart = markdown.indexOf(
      IMAGE_OPEN,
      searchStart,
    );

    while (imageStart !== (-1)) {
      /**
       * Parsed base64 image token, or rejection sentinel.
       */
      const imageRange = base64ImageRange({
        markdown,
        imageStart,
      },);
      if (isUnparseableMarkdown(imageRange,)) {
        searchStart = imageStart + IMAGE_OPEN.length;
      }
      else {
        /**
         * Full linked-image wrapper when image is tightly wrapped by one.
         */
        const constructRange = linkedImageRange({
          markdown,
          imageRange,
        },);
        /**
         * Smallest safe range, widened to physical lines only when construct owns them.
         */
        const removalRange = lineOwnedRemovalRange({
          markdown,
          constructRange,
        },);
        retainedChunks.push(markdown.slice(
          retainedStart,
          removalRange.start,
        ),);
        retainedStart = removalRange.end;
        searchStart = removalRange.end;
        removedImageCount += 1;
      }
      imageStart = markdown.indexOf(
        IMAGE_OPEN,
        searchStart,
      );
    }

    retainedChunks.push(markdown.slice(retainedStart,),);
    return {
      markdown: retainedChunks.join('',),
      removedImageCount,
    };
  })();
}

//endregion Public API

//region Markdown parsing

/**
 * Parse one complete base64 image token beginning at candidate offset.
 *
 * @param markdown - fetched page Markdown
 *
 * @param imageStart - offset of `![`
 *
 * @returns image token range or parser rejection sentinel
 */
function base64ImageRange(
  {
    markdown,
    imageStart,
  }: {
    readonly markdown: string;
    readonly imageStart: number;
  },
): MarkdownParseResult<CharacterRange> {
  /**
   * Start of inline destination after balanced alt text and opening parenthesis.
   */
  const destinationStart = imageDestinationStart({
    markdown,
    imageStart,
  },);
  if (isUnparseableMarkdown(destinationStart,))
    return UNPARSEABLE_MARKDOWN;

  /**
   * Exclusive token end after validated data-image destination.
   */
  const imageEnd = base64ImageDestinationEnd({
    markdown,
    destinationStart,
  },);
  return isUnparseableMarkdown(imageEnd,)
    ? UNPARSEABLE_MARKDOWN
    : {
      start: imageStart,
      end: imageEnd,
    };
}

/**
 * Find inline image destination start after balanced alt text.
 *
 * @param markdown - fetched page Markdown
 *
 * @param imageStart - offset of `![`
 *
 * @returns destination start or parser rejection sentinel
 */
function imageDestinationStart(
  {
    markdown,
    imageStart,
  }: {
    readonly markdown: string;
    readonly imageStart: number;
  },
): MarkdownParseResult<number> {
  return (function scanAltText(): MarkdownParseResult<number> {
    /**
     * Nested square-bracket depth inside alt text.
     */
    let bracketDepth = 1;
    /**
     * Current alt-text offset.
     */
    let cursor = imageStart + IMAGE_OPEN.length;

    while (cursor < markdown.length) {
      /**
       * Current alt-text character.
       */
      const character = markdown.charAt(cursor,);
      if (character === '\\')
        cursor += 2;
      else if (character === '[') {
        bracketDepth += 1;
        cursor += 1;
      }
      else if (character === ']') {
        bracketDepth -= 1;
        if (bracketDepth === 0)
          return markdown.charAt(cursor + 1,) === '('
            ? cursor + 2
            : UNPARSEABLE_MARKDOWN;
        cursor += 1;
      }
      else
        cursor += 1;
    }
    return UNPARSEABLE_MARKDOWN;
  })();
}

/**
 * Find end of validated base64 image data destination.
 *
 * @param markdown - fetched page Markdown
 *
 * @param destinationStart - first destination character
 *
 * @returns exclusive image token end or parser rejection sentinel
 */
function base64ImageDestinationEnd(
  {
    markdown,
    destinationStart,
  }: {
    readonly markdown: string;
    readonly destinationStart: number;
  },
): MarkdownParseResult<number> {
  /**
   * Whether destination uses Markdown angle brackets.
   */
  const angleWrapped = markdown.charAt(destinationStart,) === '<';
  /**
   * Start of data URL after optional angle bracket.
   */
  const dataStart = angleWrapped
    ? destinationStart + 1
    : destinationStart;
  if (!markdown.startsWith(
    IMAGE_DATA_PREFIX,
    dataStart,
  ))
    return UNPARSEABLE_MARKDOWN;

  return (function scanDataImageDestination(): MarkdownParseResult<number> {
    /**
     * Cursor scanning media type, then payload.
     */
    let cursor = dataStart + IMAGE_DATA_PREFIX.length;
    while (!markdown.startsWith(
      BASE64_MARKER,
      cursor,
    )) {
      /**
       * Current media-type character.
       */
      const character = markdown.charAt(cursor,);
      if ((character === '')
        || isMarkdownWhitespace(character,)
        || (character === ')')
        || (character === '>'))
        return UNPARSEABLE_MARKDOWN;
      cursor += 1;
    }
    cursor += BASE64_MARKER.length;

    /**
     * Whether payload includes at least one base64 character.
     */
    let hasPayload = false;
    while (cursor < markdown.length) {
      /**
       * Current payload or closing character.
       */
      const character = markdown.charAt(cursor,);
      if ((!angleWrapped) && (character === ')'))
        return hasPayload
          ? cursor + 1
          : UNPARSEABLE_MARKDOWN;
      if (angleWrapped && (character === '>'))
        return hasPayload && (markdown.charAt(cursor + 1,) === ')')
          ? cursor + 2
          : UNPARSEABLE_MARKDOWN;
      if (isMarkdownWhitespace(character,))
        cursor += 1;
      else if (isBase64Character(character,)) {
        hasPayload = true;
        cursor += 1;
      }
      else
        return UNPARSEABLE_MARKDOWN;
    }
    return UNPARSEABLE_MARKDOWN;
  })();
}

/**
 * Expand image range to tight outer Markdown link when one is complete on its ending line.
 *
 * @param markdown - fetched page Markdown
 *
 * @param imageRange - parsed inner image range
 *
 * @returns linked-image range or unchanged inner image range
 */
function linkedImageRange(
  {
    markdown,
    imageRange,
  }: {
    readonly markdown: string;
    readonly imageRange: CharacterRange;
  },
): CharacterRange {
  if ((imageRange.start === 0)
    || (markdown.charAt(imageRange.start - 1,) !== '[')
    || (!markdown.startsWith(
      '](',
      imageRange.end,
    )))
    return imageRange;

  /**
   * Exclusive end of outer link when destination closes safely.
   */
  const linkedEnd = sameLineLinkEnd({
    markdown,
    destinationStart: imageRange.end + 2,
  },);
  return isUnparseableMarkdown(linkedEnd,)
    ? imageRange
    : {
      start: imageRange.start - 1,
      end: linkedEnd,
    };
}

/**
 * Find balanced outer-link destination end without scanning beyond its physical line.
 *
 * @param markdown - fetched page Markdown
 *
 * @param destinationStart - first outer destination character
 *
 * @returns exclusive link end or parser rejection sentinel
 */
function sameLineLinkEnd(
  {
    markdown,
    destinationStart,
  }: {
    readonly markdown: string;
    readonly destinationStart: number;
  },
): MarkdownParseResult<number> {
  return (function scanLinkDestination(): MarkdownParseResult<number> {
    /**
     * Parenthesis depth including already-consumed opening parenthesis.
     */
    let parenthesisDepth = 1;
    /**
     * Current outer destination offset.
     */
    let cursor = destinationStart;

    while ((cursor < markdown.length) && (markdown.charAt(cursor,) !== '\n')) {
      /**
       * Current destination character.
       */
      const character = markdown.charAt(cursor,);
      if (character === '\\')
        cursor += 2;
      else if (character === '(') {
        parenthesisDepth += 1;
        cursor += 1;
      }
      else if (character === ')') {
        parenthesisDepth -= 1;
        if (parenthesisDepth === 0)
          return cursor + 1;
        cursor += 1;
      }
      else
        cursor += 1;
    }
    return UNPARSEABLE_MARKDOWN;
  })();
}

/**
 * Widen construct range to complete physical lines only when no other content shares boundaries.
 *
 * @param markdown - fetched page Markdown
 *
 * @param constructRange - image or linked-image range
 *
 * @returns construct span or complete owned-line span
 */
function lineOwnedRemovalRange(
  {
    markdown,
    constructRange,
  }: {
    readonly markdown: string;
    readonly constructRange: CharacterRange;
  },
): CharacterRange {
  /**
   * Start of first physical line touched by construct.
   */
  const lineStart = (markdown.lastIndexOf(
    '\n',
    constructRange.start - 1,
  ) + 1);
  /**
   * Newline ending last touched line, when present.
   */
  const followingLineBreak = markdown.indexOf(
    '\n',
    constructRange.end,
  );
  /**
   * End of last physical line excluding newline.
   */
  const lineEnd = (followingLineBreak === (-1))
    ? markdown.length
    : followingLineBreak;
  /**
   * Content before construct on first touched line.
   */
  const prefix = markdown.slice(
    lineStart,
    constructRange.start,
  );
  /**
   * Content after construct on last touched line.
   */
  const suffix = markdown.slice(
    constructRange.end,
    lineEnd,
  );
  if ((prefix.trim() !== '') || (suffix.trim() !== ''))
    return constructRange;

  return {
    start: lineStart,
    end: (followingLineBreak === (-1))
      ? markdown.length
      : followingLineBreak + 1,
  };
}

//endregion Markdown parsing

//region Value helpers

/**
 * Return whether value is parser rejection sentinel.
 *
 * @param value - candidate parser result
 *
 * @returns whether candidate is exact parser sentinel
 */
function isUnparseableMarkdown(value: unknown,): value is typeof UNPARSEABLE_MARKDOWN {
  return ((typeof value) === 'symbol')
    && (value === UNPARSEABLE_MARKDOWN);
}

/**
 * Return whether value is a response record carrying Markdown text.
 *
 * @param value - candidate provider response
 *
 * @returns whether Markdown can be filtered and copied
 */
function hasMarkdownString(value: unknown,): value is Readonly<Record<string, unknown>> & {
  readonly markdown: string;
} {
  return (value !== null)
    && ((typeof value) === 'object')
    && (!Array.isArray(value,))
    && ('markdown' in value)
    && ((typeof value.markdown) === 'string');
}

/**
 * Return whether character is allowed inside standard base64 payload.
 *
 * @param character - candidate payload character
 *
 * @returns whether character belongs to standard base64 alphabet or padding
 */
function isBase64Character(character: string,): boolean {
  return ((character >= 'A') && (character <= 'Z'))
    || ((character >= 'a') && (character <= 'z'))
    || ((character >= '0') && (character <= '9'))
    || (character === '+')
    || (character === '/')
    || (character === '=');
}

/**
 * Return whether character is whitespace accepted in line-wrapped payloads.
 *
 * @param character - candidate Markdown character
 *
 * @returns whether character is space, tab, carriage return, or line feed
 */
function isMarkdownWhitespace(character: string,): boolean {
  return (character === ' ')
    || (character === '\t')
    || (character === '\r')
    || (character === '\n');
}

//endregion Value helpers

export {
  filterFetchResponseDataImages,
  filterMarkdownDataImages,
};
export type {
  FetchResponseDataImageFilterResult,
  MarkdownDataImageFilterResult,
};
