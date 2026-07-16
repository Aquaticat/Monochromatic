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
  }: {
    readonly text: string;
    readonly closeStart: number;
    readonly rawEnd: number;
  },
): SplitMdxDocument {
  /**
   * Parsed metadata value from YAML between fence lines.
   */
  const data: unknown = parseFrontMatterYaml({
    yamlSource: text.slice(
      FENCE_OPEN.length,
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
  if (!text.startsWith(FENCE_OPEN,))
    return {
      body: text,
      bodyOffset: 0,
    };

  /**
   * Index of newline beginning closing fence sequence; -1 when only EOF close can apply.
   * Search starts at opening fence's newline so empty front matter still terminates.
   */
  const closeStart = text.indexOf(
    FENCE_CLOSE_INNER,
    FENCE_OPEN.length - 1,
  );

  if (closeStart !== (-1)) {
    return buildSplit({
      text,
      closeStart,
      rawEnd: closeStart + FENCE_CLOSE_INNER.length,
    },);
  }

  /**
   * Candidate index of newline beginning EOF-terminated closing fence.
   */
  const eofCloseStart = text.length - FENCE_CLOSE_EOF.length;

  if (text.endsWith(FENCE_CLOSE_EOF,) && (eofCloseStart >= (FENCE_OPEN.length
    - 1))) {
    return buildSplit({
      text,
      closeStart: eofCloseStart,
      rawEnd: text.length,
    },);
  }

  return {
    body: text,
    bodyOffset: 0,
  };
}

//endregion Front matter splitting
