import { parse as parseYaml, } from 'yaml';

//region Front matter model
// Upstream strips metadata before MDX compilation and repairs must never rewrite this
// zone, so the split keeps an exact raw slice alongside parsed data.

/**
 * Verbatim YAML front matter block split from a corpus MDX document.
 *
 * @example
 * ```ts
 * const block: FrontMatterBlock = { raw: '---\nname: x\n---\n', data: { name: 'x', }, };
 * ```
 */
export type FrontMatterBlock = {
  /**
   * Exact source slice spanning both fence lines, preserved byte-for-byte for output.
   */
  readonly raw: string;

  /**
   * Parsed YAML value; typed `unknown` because corpus metadata shapes vary per entry.
   */
  readonly data: unknown;
};

/**
 * Result of splitting optional front matter from remaining MDX body.
 *
 * @example
 * ```ts
 * const split: SplitMdxDocument = { frontMatter: undefined, body: '# t', bodyOffset: 0, };
 * ```
 */
export type SplitMdxDocument = {
  /**
   * Present only when source opens with a well-terminated `---` fence pair.
   */
  readonly frontMatter?: FrontMatterBlock;

  /**
   * MDX source following front matter; equals whole input when front matter is absent.
   */
  readonly body: string;

  /**
   * Character offset of body start inside original text;
   * anchors mdast positions back onto full-document offsets.
   */
  readonly bodyOffset: number;
};

//endregion Front matter model

//region Front matter splitting

/**
 * Signals YAML inside a front matter fence pair that refuses to parse;
 * corpus metadata parses upstream, so failure here indicates corruption.
 *
 * @example
 * ```ts
 * throw new FrontMatterParseError({ cause: error, },);
 * ```
 */
export class FrontMatterParseError extends Error {
  /**
   * Builds failure carrying original YAML parser error for diagnosis.
   *
   * @param cause - underlying YAML parser error
   *
   * @mutates cause - `super` may invoke a getter or proxy trap while storing supplied cause
   *
   * @example
   * ```ts
   * new FrontMatterParseError({ cause: error, },);
   * ```
   */
  public constructor({ cause, }: { readonly cause: unknown; },) {
    super(
      'Front matter fence pair found but YAML inside refused to parse;'
        + ' corpus metadata parses upstream, so this signals corruption.',
      { cause, },
    );
    this.name = 'FrontMatterParseError';
  }
}

/**
 * Fence line delimiting YAML front matter on both sides.
 */
const FRONT_MATTER_FENCE = '---';

/**
 * Opening sequence a document must start with for front matter to exist.
 */
const FENCE_OPEN = `${FRONT_MATTER_FENCE}\n`;

/**
 * Closing sequence terminating front matter when body content follows.
 */
const FENCE_CLOSE_INNER = `\n${FRONT_MATTER_FENCE}\n`;

/**
 * Closing sequence terminating front matter at end of input.
 */
const FENCE_CLOSE_EOF = `\n${FRONT_MATTER_FENCE}`;

/**
 * The three fence strings for one document's line ending.
 */
type FenceSet = {
  /**
   * Sequence the document must open with.
   */
  readonly open: string;

  /**
   * Sequence closing front matter when a body follows.
   */
  readonly closeInner: string;

  /**
   * Sequence closing front matter at end of input.
   */
  readonly closeEof: string;
};

/**
 * Fences matching the line ending this document actually uses.
 *
 * The fences were fixed to `\n`, so a document written with CRLF failed
 * `startsWith` and reported NO front matter at all. One corpus original does
 * exactly that, and the consequence is not a missing field: the whole YAML
 * block is then parsed as body, where `---` becomes a thematic break and
 * `name: Ara` becomes a setext heading. The critics receive the metadata as
 * content to compare, and the identity context built from front matter is
 * empty for the one entry whose names most needed declaring.
 *
 * Matching rather than rewriting, because every offset downstream indexes the
 * original text and normalising line endings would move all of them.
 *
 * @param text - whole document text
 *
 * @returns Fence strings to match with
 *
 * @example
 * ```ts
 * const fences = fencesFor({ text, },);
 * ```
 */
function fencesFor({ text, }: { readonly text: string; },): FenceSet {
  /**
   * Opening fence spelled with a carriage return.
   */
  const carriageOpen = `${FRONT_MATTER_FENCE}\r\n`;
  if (!text.startsWith(carriageOpen,)) {
    return {
      open: FENCE_OPEN,
      closeInner: FENCE_CLOSE_INNER,
      closeEof: FENCE_CLOSE_EOF,
    };
  }

  return {
    open: carriageOpen,
    closeInner: `\r\n${FRONT_MATTER_FENCE}\r\n`,
    closeEof: `\r\n${FRONT_MATTER_FENCE}`,
  };
}

/**
 * Parses YAML between fences, converting parser failures into domain errors.
 *
 * @param yamlSource - text between fence lines
 *
 * @returns Parsed YAML value; corpus shapes vary, so no schema is imposed here
 *
 * @throws {@link FrontMatterParseError} when YAML refuses to parse
 *
 * @example
 * ```ts
 * parseFrontMatterYaml({ yamlSource: 'name: mittens', },);
 * ```
 */
function parseFrontMatterYaml(
  { yamlSource, }: { readonly yamlSource: string; },
): unknown {
  try {
    return parseYaml(yamlSource,);
  }
  catch (error) {
    throw new FrontMatterParseError({ cause: error, },);
  }
}

/**
 * Builds split result once closing fence position is known.
 *
 * @param text - full document source
 *
 * @param closeStart - index of newline beginning closing fence sequence
 *
 * @param rawEnd - end index (exclusive) of raw front matter slice
 *
 * @returns Split with parsed front matter and offset-adjusted body
 *
 * @throws {@link FrontMatterParseError} when YAML between fences refuses to parse
 *
 * @example
 * ```ts
 * buildSplit({ text: '---\nname: n\n---\n', closeStart: 11, rawEnd: 16, },);
 * ```
 */
function buildSplit(
  {
    text,
    closeStart,
    rawEnd,
    openLength,
  }: {
    readonly text: string;
    readonly closeStart: number;
    readonly rawEnd: number;
    readonly openLength: number;
  },
): SplitMdxDocument {
  /**
   * Parsed metadata value from YAML between fence lines.
   */
  const data: unknown = parseFrontMatterYaml({
    yamlSource: text.slice(
      openLength,
      closeStart,
    ),
  },);

  return {
    frontMatter: {
      raw: text.slice(
        0,
        rawEnd,
      ),
      data,
    },
    body: text.slice(rawEnd,),
    bodyOffset: rawEnd,
  };
}

/**
 * Splits optional YAML front matter from MDX body without regex,
 * mirroring how upstream strips metadata before MDX compilation.
 *
 * Unterminated fences are treated as body text:
 * remark parses stray `---` lines as thematic breaks,
 * so returning whole input preserves that interpretation instead of guessing.
 *
 * @param text - full document source possibly opening with YAML front matter
 *
 * @returns Split parts plus body offset for absolute position anchoring
 *
 * @throws {@link FrontMatterParseError} when fences exist but YAML refuses to parse
 *
 * @example
 * ```ts
 * const { frontMatter, body, bodyOffset, } = splitFrontMatter({
 *   text: '---\nname: n\n---\n\nBody',
 * },);
 * ```
 */
export function splitFrontMatter({ text, }: { readonly text: string; },): SplitMdxDocument {
  /**
   * Fences spelled with this document's own line ending.
   */
  const fences = fencesFor({ text, },);
  if (!text.startsWith(fences.open,))
    return {
      body: text,
      bodyOffset: 0,
    };

  /**
   * Index of newline beginning closing fence sequence; -1 when only EOF close can apply.
   * Search starts at opening fence's newline so empty front matter still terminates.
   */
  const {
    open,
    closeInner,
    closeEof,
  } = fences;

  /**
   * Where the search for a closing fence begins: at the opening fence's own
   * line break, so empty front matter still terminates.
   */
  const searchFrom = open.length - closeInner.indexOf(
    FRONT_MATTER_FENCE,
    0,
  );

  /**
   * Index of the line break beginning the closing fence; -1 when only an
   * end-of-input close can apply.
   */
  const closeStart = text.indexOf(
    closeInner,
    searchFrom,
  );

  if (closeStart !== (-1)) {
    return buildSplit({
      text,
      closeStart,
      rawEnd: closeStart + closeInner.length,
      openLength: open.length,
    },);
  }

  /**
   * Candidate index of newline beginning EOF-terminated closing fence.
   */
  const eofCloseStart = text.length - closeEof.length;
  if (text.endsWith(closeEof,) && (eofCloseStart >= (open.length - 1))) {
    return buildSplit({
      text,
      closeStart: eofCloseStart,
      rawEnd: text.length,
      openLength: open.length,
    },);
  }

  return {
    body: text,
    bodyOffset: 0,
  };
}

//endregion Front matter splitting
