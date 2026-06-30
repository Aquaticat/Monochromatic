import {
  BECAUSE_CONNECTIVE,
  MIN_DISTINCT_WORD_COUNT,
  MIN_NAMESPACED_TAIL_WORD_COUNT,
  MIN_WORD_COUNT,
  NEGATION_PREFIX_NO,
  NEGATION_PREFIX_NOT,
  SHORT_PHRASE_WORD_COUNT,
} from './constants.ts';
import {
  endsVerbLike,
  hasSpecificityMarker,
  isBareCamelIdentifier,
} from './markers.ts';
import {
  allAlphabeticWordsUppercase,
  repeatedMeaningfulWord,
  repeatsSamePhraseAcrossBecause,
} from './repetition.ts';
import {
  lowerWords,
  namespaceParts,
  splitDescriptionWords,
} from './tokenize.ts';
import type { SymbolDescriptionVerdict, } from './types.ts';

/**
 * Classifies a static Symbol description, returning the first matching failure
 * branch in the calibrated order, or a pass. Tokenizes via
 * {@link splitDescriptionWords} and {@link lowerWords}, reads namespace shape
 * via {@link namespaceParts}, and checks structural markers and repetition
 * via {@link hasSpecificityMarker}, {@link repeatsSamePhraseAcrossBecause},
 * {@link repeatedMeaningfulWord}, {@link allAlphabeticWordsUppercase},
 * {@link isBareCamelIdentifier}, and {@link endsVerbLike}. Ported from the
 * persisted benchmark classifier, not the threshold baseline.
 *
 * @param description - raw static Symbol description text
 *
 * @returns pass verdict, or fail verdict with the branch message id
 *
 * @example
 * ```ts
 * classifySymbolDescription({ description: 'github token expired' }); // { status: 'pass' }
 * classifySymbolDescription({ description: 'meow' });
 * // { status: 'fail', messageId: 'tooFewWords' }
 * ```
 */
export function classifySymbolDescription(
  { description, }: { readonly description: string; },
): SymbolDescriptionVerdict {
  /**
   * Words in source order with original casing.
   */
  const words = splitDescriptionWords({ description, },);
  /**
   * Lowercased words for case-insensitive comparison.
   */
  const lowered = lowerWords({ words, },);
  /**
   * Count of distinct lowercased words.
   */
  const distinctCount = new Set(lowered,).size;
  /**
   * Namespace structure of the description.
   */
  const namespace = namespaceParts({ description, },);
  /**
   * Whether any structural specificity marker is present.
   */
  const marker = hasSpecificityMarker({
    description,
    words,
  },);
  /**
   * Whether a meaningful word repeats, using the narrow `because` form when
   * the connective is present.
   */
  const repeated = lowered.includes(BECAUSE_CONNECTIVE,)
    ? repeatsSamePhraseAcrossBecause({
      words,
      namespaceWords: namespace.namespaceWords,
    },)
    : repeatedMeaningfulWord({
      words,
      namespaceWords: namespace.namespaceWords,
    },);
  if ((words.length < MIN_WORD_COUNT) || (distinctCount < MIN_DISTINCT_WORD_COUNT))
    return {
      status: 'fail',
      messageId: 'tooFewWords',
    };
  if (allAlphabeticWordsUppercase({ words, },))
    return {
      status: 'fail',
      messageId: 'allUppercase',
    };
  if (isBareCamelIdentifier({
    description,
    words,
  },))
    return {
      status: 'fail',
      messageId: 'bareCamelIdentifier',
    };
  if (repeated)
    return {
      status: 'fail',
      messageId: 'repeatedMeaningfulWord',
    };
  if (namespace.isNamespaced && (namespace.tailWords
    .length
    < MIN_NAMESPACED_TAIL_WORD_COUNT))
    return {
      status: 'fail',
      messageId: 'shortNamespacedTail',
    };
  if ((!namespace.isNamespaced) && (lowered[0] === NEGATION_PREFIX_NO)
    && (!marker))
    return {
      status: 'fail',
      messageId: 'startsWithNoWithoutMarker',
    };
  if ((!namespace.isNamespaced) && (lowered[0] === NEGATION_PREFIX_NOT)
    && (!marker))
    return {
      status: 'fail',
      messageId: 'startsWithNotWithoutMarker',
    };
  if ((!namespace.isNamespaced) && (words.length === SHORT_PHRASE_WORD_COUNT)
    && (!marker)) {
    /**
     * Third word of a 3-word phrase, gated for verb-like endings.
     */
    const thirdWord = words.at(2,);
    if ((thirdWord !== undefined) && (!endsVerbLike({ word: thirdWord, },)))
      return {
        status: 'fail',
        messageId: 'shortPhraseLacksSpecificityMarker',
      };
  }
  return { status: 'pass', };
}
