import type { DocumentNode, } from './document-node.ts';

//region Block alignment
// Paragraph pairing used to assume that equal node counts mean one-to-one
// correspondence, and `slice-pair.ts` said so outright: "When both sides carry
// the same node count their paragraphs correspond one to one ... never
// drifting." The pinned corpus disproves it. One entry carries 32 blocks on
// each side, yet its translation drops a short lead-in paragraph and folds the
// line into the quotation that follows, so from that point every index-paired
// slice compares a block against its neighbour. Equal totals hid the drift
// because the translation regains a block further down.
//
// Critics then behave exactly as asked: handed two unrelated blocks, they
// report differences between them. Those become confident, well-anchored, and
// entirely false issues, which is how milestone three's graded sample scored
// its single largest false-positive cluster.
//
// This is a monotone alignment that may skip a block on either side instead of
// forcing a partner. Scoring is deliberately language-neutral, since the whole
// point is pairing Chinese against English before any model has read either:
// block kind, shared script-neutral tokens (Latin words, digit runs, component
// names), and a plausible length ratio.

/**
 * Score awarded when both blocks are the same mdast kind. A quotation matches
 * a quotation far more reliably than any textual signal survives translation.
 */
const KIND_MATCH_SCORE = 2;

/**
 * Penalty when kinds differ. Kept mild rather than prohibitive: a translation
 * may legitimately render a lead-in plus quotation as one quotation.
 */
const KIND_MISMATCH_PENALTY = -1;

/**
 * Weight on shared literal tokens. Names, years, and component names survive
 * translation unchanged, so agreement here is strong evidence of partnership.
 */
const TOKEN_OVERLAP_WEIGHT = 3;

/**
 * Weight on a plausible expansion ratio between the two blocks' lengths.
 */
const LENGTH_PLAUSIBILITY_WEIGHT = 1;

/**
 * Cost of leaving a block unpartnered. Set below the swing between a kind
 * match and a kind mismatch, so a single dropped block is cheaper to skip than
 * to force onto a neighbour, which is exactly the drift being fixed.
 */
const GAP_PENALTY = -1.5;

/**
 * Characters a Chinese block typically becomes in English, used only when the
 * pair itself gives no better estimate. Chinese is written without spaces and
 * packs more meaning per character, so an English rendering runs longer; this
 * judges plausibility and never rejects.
 *
 * A FIXED CONSTANT IS WRONG FOR THIS CORPUS, measured 2026-08-20. Entry medians
 * of English characters per Chinese character run from 1.49 to 4.10, because how
 * far a translation expands is a property of the TRANSLATOR, not of the language
 * pair: a plain rendering stays close and a literary one runs long.
 *
 * On `saurikissa`, whose median is 4.10, every CORRECT pair scored as implausible
 * against 1.8, which destroyed the only signal the walk had. Chinese and English
 * prose share no Latin tokens, and block kind is constant when every block is a
 * paragraph, so length was carrying the alignment alone and pointing the wrong
 * way. Six of eleven slices then paired unrelated paragraphs.
 * `doc/audit/the-critics-are-shown-the-wrong-paragraph.md` records the reading.
 */
const FALLBACK_EXPANSION = 1.8;

/**
 * Shortest token worth comparing. Single characters collide constantly across
 * unrelated blocks and would drown the signal.
 */
const MIN_TOKEN_LENGTH = 2;

/**
 * Code point of `0`, the low end of the ASCII digit range.
 */
const DIGIT_ZERO = 48;

/**
 * Code point of `9`, the high end of the ASCII digit range.
 */
const DIGIT_NINE = 57;

/**
 * Code point of `A`, the low end of the uppercase ASCII range.
 */
const UPPER_A = 65;

/**
 * Code point of `Z`, the high end of the uppercase ASCII range.
 */
const UPPER_Z = 90;

/**
 * Code point of `a`, the low end of the lowercase ASCII range.
 */
const LOWER_A = 97;

/**
 * Code point of `z`, the high end of the lowercase ASCII range.
 */
const LOWER_Z = 122;

/**
 * Stand-in code point for a position past the text's end. Zero is never a
 * token unit, so the final flush iteration reads as a boundary.
 */
const NOT_A_TOKEN_UNIT = 0;

/**
 * Whether a character can start or continue a script-neutral token: ASCII
 * letters and digits. Deliberately excludes CJK, whose characters carry
 * meaning individually and would match across unrelated blocks.
 *
 * @param code - UTF-16 code unit to classify
 *
 * @returns Whether the unit belongs to a token
 *
 * @example
 * ```ts
 * isTokenUnit('a'.charCodeAt(0,),);
 * ```
 */
function isTokenUnit(code: number,): boolean {
  /**
   * Whether the unit is an ASCII digit.
   */
  const isDigit = (code >= DIGIT_ZERO) && (code <= DIGIT_NINE);

  /**
   * Whether the unit is an uppercase ASCII letter.
   */
  const isUpper = (code >= UPPER_A) && (code <= UPPER_Z);

  /**
   * Whether the unit is a lowercase ASCII letter.
   */
  const isLower = (code >= LOWER_A) && (code <= LOWER_Z);
  return isDigit || isUpper
    || isLower;
}

/**
 * Extracts the script-neutral tokens of one block by a single linear scan.
 * A scan rather than a pattern: the rule is "runs of ASCII alphanumerics",
 * which an index walk states directly and runs in one pass with no
 * backtracking on adversarial input.
 *
 * @param text - block text to tokenize
 *
 * @returns Lowercased tokens, deduplicated
 *
 * @example
 * ```ts
 * const tokens = tokenize({ text: 'She played THE FINALS in 2023.', },);
 * ```
 */
export function tokenize({ text, }: { readonly text: string; },): ReadonlySet<string> {
  /**
   * Tokens found so far, deduplicated by construction.
   */
  const tokens = new Set<string>();

  /**
   * Start index of the run currently being scanned.
   */
  let runStart = -1;
  for (let index = 0; index <= text.length; index += 1) {
    /**
     * Whether this position continues a token; the extra final iteration
     * flushes a run that ends at the text's end.
     */
    const inToken = (index < text.length)
      && isTokenUnit(text.codePointAt(index,) ?? NOT_A_TOKEN_UNIT,);

    if (inToken && (runStart < 0)) {
      runStart = index;
      continue;
    }
    if ((!inToken) && (runStart >= 0)) {
      /**
       * Completed run.
       */
      const token = text.slice(
        runStart,
        index,
      );
      if (token.length >= MIN_TOKEN_LENGTH)
        tokens.add(token.toLowerCase(),);
      runStart = -1;
    }
  }
  return tokens;
}

/**
 * Shared-token count at which overlap scores half its weight. Small because
 * one agreeing proper noun is already meaningful across languages, while the
 * tenth adds little.
 */
const OVERLAP_HALF_POINT = 2;

/**
 * Overlap between two token sets, measured on the ABSOLUTE number of shared
 * tokens with diminishing returns rather than as a share of either set.
 *
 * Sharing a set-relative measure was tried and is wrong: dividing by the
 * smaller set lets a block carrying a single token score a perfect match
 * against any long block containing that token, so a block with MORE evidence
 * scores worse than one with less. On the corpus that inverted a real pairing,
 * skipping the block that genuinely corresponded. Jaccard fails the opposite
 * way here, since a short original against its longer rendering has a large
 * union and vanishing overlap however well the two correspond.
 *
 * @param source - original block's tokens
 *
 * @param target - translation block's tokens
 *
 * @returns Overlap from zero (nothing shared) toward one, never reaching it
 *
 * @example
 * ```ts
 * const overlap = tokenOverlap({ source, target, },);
 * ```
 */
function tokenOverlap(
  {
    source,
    target,
  }: {
    readonly source: ReadonlySet<string>;
    readonly target: ReadonlySet<string>;
  },
): number {
  /**
   * Tokens both sides carry.
   */
  const shared = [...source,].filter(function inTarget(token,) {
    return target.has(token,);
  },)
    .length;
  return shared / (shared + OVERLAP_HALF_POINT);
}

/**
 * How plausible the two blocks' lengths are as a translation pair, from zero
 * to one. Peaks when the target runs about `expansion` times the source and
 * decays smoothly, so it nudges rather than decides.
 *
 * @param sourceLength - original block's character count
 *
 * @param targetLength - translation block's character count
 *
 * @param expansion - characters this translation produces per source character
 *
 * @returns Plausibility from zero to one
 *
 * @example
 * ```ts
 * const fit = lengthPlausibility({ sourceLength: 10, targetLength: 18, expansion: 1.8, },);
 * ```
 */
function lengthPlausibility(
  {
    sourceLength,
    targetLength,
    expansion,
  }: {
    readonly sourceLength: number;
    readonly targetLength: number;
    readonly expansion: number;
  },
): number {
  if ((sourceLength === 0) || (targetLength === 0))
    return 0;

  /**
   * Observed ratio against the ratio THIS translation tends to produce.
   */
  const ratio = targetLength / (sourceLength * expansion);

  /**
   * Symmetric distance from the ideal, so twice as long and half as long are
   * penalized equally.
   */
  const deviation = ratio >= 1
    ? ratio
    : 1 / ratio;
  return 1 / deviation;
}

/**
 * Estimates how far THIS translation expands, in characters per source
 * character.
 *
 * Measured over the whole block lists rather than per pair, because a single
 * block is exactly the thing whose pairing is in question and cannot be used to
 * judge itself.
 *
 * @param sourceNodes - original blocks
 *
 * @param targetNodes - translation blocks
 *
 * @returns Characters produced per source character, or
 * {@link FALLBACK_EXPANSION} when either side is empty
 *
 * @example
 * ```ts
 * const expansion = estimateExpansion({ sourceNodes, targetNodes, },);
 * ```
 */
export function estimateExpansion(
  {
    sourceNodes,
    targetNodes,
  }: {
    readonly sourceNodes: readonly DocumentNode[];
    readonly targetNodes: readonly DocumentNode[];
  },
): number {
  /**
   * Total characters on the original side.
   */
  const sourceChars = sourceNodes
    .reduce(
      function addChars(
        sum,
        node,
      ): number {
        /**
         * This block's own characters.
         */
        const { text, } = node;
        return sum + text.length;
      },
      0,
    );

  /**
   * Total characters on the translation side.
   */
  const targetChars = targetNodes
    .reduce(
      function addChars(
        sum,
        node,
      ): number {
        /**
         * This block's own characters.
         */
        const { text, } = node;
        return sum + text.length;
      },
      0,
    );
  if ((sourceChars === 0) || (targetChars === 0))
    return FALLBACK_EXPANSION;
  return targetChars / sourceChars;
}

/**
 * Scores one candidate pairing. Higher is a better partnership.
 *
 * @param source - original block
 *
 * @param target - translation block
 *
 * @param expansion - characters this translation produces per source character,
 * defaulting to {@link FALLBACK_EXPANSION} when the caller has no estimate
 *
 * @returns Pairing score, unbounded below and above
 *
 * @example
 * ```ts
 * const score = scorePairing({ source, target, },);
 * ```
 */
export function scorePairing(
  {
    source,
    target,
    expansion = FALLBACK_EXPANSION,
  }: {
    readonly source: DocumentNode;
    readonly target: DocumentNode;
    readonly expansion?: number;
  },
): number {
  /**
   * Structural agreement, the strongest single signal.
   */
  const kindScore = source.kind === target.kind
    ? KIND_MATCH_SCORE
    : KIND_MISMATCH_PENALTY;

  /**
   * Literal agreement across names, years, and component names.
   */
  const overlapScore = TOKEN_OVERLAP_WEIGHT
    * tokenOverlap({
      source: tokenize({ text: source.text, },),
      target: tokenize({ text: target.text, },),
    },);

  /**
   * Length agreement, a gentle tiebreaker.
   */
  const lengthScore = LENGTH_PLAUSIBILITY_WEIGHT
    * lengthPlausibility({
      sourceLength: source.text
        .length,
      targetLength: target.text
        .length,
      expansion,
    },);
  return kindScore + overlapScore
    + lengthScore;
}

//endregion Block alignment
