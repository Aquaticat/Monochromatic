import type { Root, } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified, } from 'unified';

import { NAMED_POSITION_UNSTATED, } from './refusal-text.ts';

//region MDX parsing
// Corpus pages compile as MDX upstream (@mdx-js/mdx with a Vue pragma), so this module
// parses with the same grammar family. GFM is enabled here even though upstream omits
// it: footnote reference/definition nodes carry the semantic graph this library
// validates, while emitted repairs preserve the literal textual convention.
//
// LEDGER X22 (2026-09-29): the site also compiles with remark-math
// (one-among-us/data scripts/mdx.ts), so text between dollar signs is a
// formula there, and the strict parse reads it the same way. Over the 92
// sources and archives at the pin and 273 settled pages, adding it changed no
// tree. The tolerant fallback stays without it: with no MDX grammar, the
// template strings inside JSX attributes (`'${...}'`) read as prose there, and
// math would pair their dollar signs in 171 of those 457 inputs.

/**
 Describes where an MDX refusal stopped, quoting nothing it read.
 
 MOSTLY SAFE ALREADY, and that is why this is narrow rather than absent. Four
 of five measured failure shapes report a position and an expectation. The
 fifth, an unclosed tag, embeds the tag NAME from the source, which is enough
 to carry a page's own markup into a stored finding.
 
 @param cause - caught value, of unknown type by construction
 
 @returns Phrase naming position and rule
 
 @example
 ```ts
 `refused to parse ${mdxRefusalSite({ cause, },)}`;
 ```
 */
function mdxRefusalSite({ cause, }: { readonly cause: unknown; },): string {
  if (!Error.isError(cause,))
    return `at ${NAMED_POSITION_UNSTATED}`;

  /**
   Package that raised it, prefixed so two rules sharing a name stay apart.
   */
  const from = (('source' in cause) && ((typeof cause.source) === 'string'))
    ? `${cause.source}/`
    : '';

  /**
   Rule the grammar names, falling back to the class that raised it.
   */
  const rule = (('ruleId' in cause) && ((typeof cause.ruleId) === 'string'))
    ? `${from}${cause.ruleId}`
    : cause.name;

  // `VFileMessage` sets `name` to "line:column". Any other Error's name is its
  // class, and neither spelling repeats the source.
  return `at ${cause.name} (${rule})`;
}

/**
 Where a parser message says the grammar stopped, each part present only
 when the message names it.
 */
type RefusalPlace = {
  /**
   One-based line.
   */
  readonly line?: number;

  /**
   One-based column.
   */
  readonly column?: number;
};

/**
 What a parser message says the grammar stopped at: the end of the span it
 names, or the point it names, or the message itself when it names neither.

 THE END OF A SPAN, NOT ITS START (ledger B86). `mdast-util-mdx-jsx` raises
 its refusals on leaving the span it names (`onErrorRightIsTag`,
 `exitMdxJsxTag` in 3.2.0), so an element left open in a paragraph stops the
 grammar where the paragraph ends. A `VFileMessage` copies its own `line` and
 `column` from the span's start, which read that refusal at the paragraph's
 first character. Micromark's own refusals name a point.

 @param cause - caught error, of unknown shape beyond being an object

 @returns Object whose `line` and `column`, when numeric, name the stop

 @example
 ```ts
 const stop = stopPointOf({ cause, },);
 ```
 */
function stopPointOf({ cause, }: { readonly cause: object; },): object {
  if ((!('place' in cause))
    || ((typeof cause.place) !== 'object')
    || (cause.place === null))
    return cause;
  /**
   Point or span the message names.
   */
  const { place, } = cause;
  if (('end' in place)
    && ((typeof place.end) === 'object')
    && (place.end !== null))
    return place.end;
  return place;
}

/**
 Reads the line and column a parser message says the grammar stopped at,
 when it names them.

 A micromark message carries the place as numbers; anything else names no
 place. An element still open when the document ends is refused with no
 place at all, since the parser stopped at the end of the document.

 @param cause - caught value, of unknown type by construction

 @returns Line and column, each absent when unstated

 @example
 ```ts
 const { line, column, } = refusalPlace({ cause, },);
 ```
 */
function refusalPlace(
  { cause, }: { readonly cause: unknown; },
): RefusalPlace {
  if (!Error.isError(cause,))
    return {};
  /**
   Where the message says the grammar stopped.
   */
  const stop = stopPointOf({ cause, },);
  /**
   Line it names, when numeric.
   */
  const line: RefusalPlace = (('line' in stop) && ((typeof stop.line) === 'number'))
    ? { line: stop.line, }
    : {};
  /**
   Column it names, when numeric.
   */
  const column: RefusalPlace = (('column' in stop) && ((typeof stop.column) === 'number'))
    ? { column: stop.column, }
    : {};
  return {
    ...line,
    ...column,
  };
}

/**
 Signals MDX source that refuses to parse.
 
 Corpus documents compile upstream, so a refusal indicates corruption or a
 construct outside the mirrored grammar.
 
 @example
 ```ts
 throw new MdxParseError({ cause: error, },);
 ```
 */
export class MdxParseError extends Error {
  /**
   Declares this message safe to forward: it states where the grammar stopped
   and which rule it broke, and repeats no document text.
   */
  readonly messageNamesOnly: true = true;

  /**
   One-based line the grammar stopped on, absent when the parser named none.
   */
  readonly line?: number;

  /**
   One-based column the grammar stopped at, absent when the parser named none.
   */
  readonly column?: number;

  /**
   Builds failure stating where the grammar stopped, never what it read.
   
   DOES NOT CARRY THE PARSER ERROR AS `cause`, for the reason
   `FrontMatterParseError` records: a cause chain is rendered by Node's
   uncaught-exception reporter, and `parse-document.ts` used to stringify this
   one straight into a stored finding.
   
   @param cause - underlying micromark/remark error, read for position and rule
   
   @example
   ```ts
   new MdxParseError({ cause: error, },);
   ```
   */
  public constructor({ cause, }: { readonly cause: unknown; },) {
    super(
      `MDX body refused to parse ${mdxRefusalSite({ cause, },)}; corpus documents`
        + ' compile as MDX upstream, so failure signals corruption or an'
        + ' unsupported construct.',
    );
    this.name = 'MdxParseError';
    /**
     Where the grammar stopped, as the parser's message carries it.
     */
    const place = refusalPlace({ cause, },);
    if (place.line !== undefined)
      this.line = place.line;
    if (place.column !== undefined)
      this.column = place.column;
  }
}

/**
 Parses MDX body text into an mdast tree with positions on every node.
 
 @param body - MDX source with front matter already split away
 
 @returns mdast root whose node positions are body-relative character offsets
 
 @throws {@link MdxParseError} when source refuses to parse as MDX, and for
 any other failure inside the grammar too, a stack overflow on deep nesting
 among them

 @example
 ```ts
 const root = parseMdxBody({ body: '# Title\n\nParagraph with[^1]\n\n[^1]: note\n', },);
 ```
 */
export function parseMdxBody({ body, }: { readonly body: string; },): Root {
  try {
    return unified()
      .use(remarkParse,)
      .use(remarkMdx,)
      .use(remarkGfm,)
      .use(remarkMath,)
      .parse(body,);
  }
  catch (error) {
    throw new MdxParseError({ cause: error, },);
  }
}

/**
 The strict grammar's refusal a catch around {@link parseMdxBody} holds,
 for a catch that acts on the refusal alone.

 SHARED RATHER THAN REPEATED (ledger T8, sixth batch). Seven catches around
 the grammar each tested the class and rethrew anything else, and no test
 reached a rethrow: `parseMdxBody` raises every failure as an
 {@link MdxParseError}, and the rest of their bodies throws only where an
 invariant breaks (a parsed node without a position). The narrowing stands
 here once, where a case reaches the rethrow.

 @param error - what the catch caught

 @returns The refusal

 @throws The caught value unchanged when it is anything but the grammar's
 refusal, an unexpected state that must keep propagating

 @example
 ```ts
 const refusal = requireMdxRefusal({ error, },);
 ```
 */
export function requireMdxRefusal({ error, }: { readonly error: unknown; },): MdxParseError {
  if (error instanceof MdxParseError)
    return error;
  throw error;
}

/**
 Parses body text as plain markdown (GFM, no MDX extensions).
 Tolerant fallback grammar: markdown parsing is total,
 so constructs the MDX grammar rejects (raw HTML, brace expressions)
 survive as literal `html` and text nodes instead of failing the document.
 
 @param body - markdown source with front matter already split away
 
 @returns mdast root whose node positions are body-relative character offsets
 
 @example
 ```ts
 const root = parseMarkdownBody({ body: '<!-- note -->\n\nParagraph.\n', },);
 ```
 */
export function parseMarkdownBody({ body, }: { readonly body: string; },): Root {
  return unified()
    .use(remarkParse,)
    .use(remarkGfm,)
    .parse(body,);
}

//endregion MDX parsing
