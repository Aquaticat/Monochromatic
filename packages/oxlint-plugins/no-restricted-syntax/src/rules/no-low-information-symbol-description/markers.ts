import {
  CONTINUOUS_SUFFIX,
  DIGIT_CHARACTERS,
  MIN_NO_VOWEL_WORD_LENGTH,
  MIN_WORD_COUNT,
  PAST_TENSE_SUFFIX,
  SPECIFICITY_MARKER_DOT,
  SPECIFICITY_MARKER_UNDERSCORE,
  VOWEL_CHARACTERS,
} from './constants.ts';

//region Specificity markers

/**
 * Detects any uppercase cased letter, comparing against the lowercased copy so
 * the description is never split into characters.
 *
 * @param description - raw static Symbol description text
 *
 * @returns whether at least one uppercase letter is present
 *
 * @example
 * ```ts
 * hasUppercase({ description: 'OAuth token' }); // true
 * ```
 */
export function hasUppercase({ description, }: { readonly description: string; },): boolean {
  return description !== description.toLowerCase();
}

/**
 * Detects any ASCII digit via membership tests against {@link DIGIT_CHARACTERS}
 * rather than scanning characters.
 *
 * @param description - raw static Symbol description text
 *
 * @returns whether at least one digit is present
 *
 * @example
 * ```ts
 * hasDigit({ description: 'port 5173 used' }); // true
 * ```
 */
export function hasDigit({ description, }: { readonly description: string; },): boolean {
  return DIGIT_CHARACTERS.some(function descriptionIncludesDigit(digit,): boolean {
    return description.includes(digit,);
  },);
}

/**
 * Detects a vowel in a word via membership tests against
 * {@link VOWEL_CHARACTERS} and the lowercased word.
 *
 * @param word - single word to inspect
 *
 * @returns whether word contains a, e, i, o, or u
 *
 * @example
 * ```ts
 * wordHasVowel({ word: 'jsonl' }); // false
 * wordHasVowel({ word: 'token' }); // true
 * ```
 */
function wordHasVowel({ word, }: { readonly word: string; },): boolean {
  /**
   * Lowercased word so each vowel needs only one membership test.
   */
  const lower = word.toLowerCase();
  return VOWEL_CHARACTERS.some(function wordIncludesVowel(vowel,): boolean {
    return lower.includes(vowel,);
  },);
}

/**
 * Detects a consonant-dense technical token: a long word with no vowel,
 * tested via {@link wordHasVowel}.
 *
 * @param words - words in original casing
 *
 * @returns whether any word is long and vowel-free
 *
 * @example
 * ```ts
 * hasLongNoVowelWord({ words: ['log', 'jsonl'] }); // true
 * ```
 */
function hasLongNoVowelWord({ words, }: { readonly words: readonly string[]; },): boolean {
  return words.some(function isLongNoVowel(word,): boolean {
    return (word.length >= MIN_NO_VOWEL_WORD_LENGTH) && (!wordHasVowel({ word, },));
  },);
}

/**
 * Detects a structural specificity marker: uppercase (via {@link hasUppercase}),
 * digit (via {@link hasDigit}), {@link SPECIFICITY_MARKER_DOT},
 * {@link SPECIFICITY_MARKER_UNDERSCORE}, or a long vowel-free token (via
 * {@link hasLongNoVowelWord}). Structural only, never a semantic vocabulary list.
 *
 * @param description - raw static Symbol description text
 *
 * @param words - tokenized words of description
 *
 * @returns whether description carries any structural specificity marker
 *
 * @example
 * ```ts
 * hasSpecificityMarker({
 *   description: 'file log.jsonl exists',
 *   words: ['file', 'log', 'jsonl', 'exists'],
 * });
 * // true (dot, plus a long vowel-free token)
 * ```
 */
export function hasSpecificityMarker(
  {
    description,
    words,
  }: {
    readonly description: string;
    readonly words: readonly string[];
  },
): boolean {
  return hasUppercase({ description, },)
    || hasDigit({ description, },)
    || description.includes(SPECIFICITY_MARKER_DOT,)
    || description.includes(SPECIFICITY_MARKER_UNDERSCORE,)
    || hasLongNoVowelWord({ words, },);
}

//endregion Specificity markers

//region Shape predicates

/**
 * Detects a bare camelCase or PascalCase identifier: no separator, an
 * uppercase letter (via {@link hasUppercase}), and at least
 * {@link MIN_WORD_COUNT} words, as in `runWithContext`. Reads like a code
 * symbol, not a debugging phrase. Separator absence is read from the
 * tokenizer: with no separators, concatenating the words reproduces the
 * description exactly.
 *
 * @param description - raw static Symbol description text
 *
 * @param words - tokenized words of description
 *
 * @returns whether description is a bare camel/Pascal identifier
 *
 * @example
 * ```ts
 * isBareCamelIdentifier({
 *   description: 'runWithContext',
 *   words: ['run', 'With', 'Context'],
 * }); // true
 * ```
 */
export function isBareCamelIdentifier(
  {
    description,
    words,
  }: {
    readonly description: string;
    readonly words: readonly string[];
  },
): boolean {
  return (words.join('',) === description)
    && hasUppercase({ description, },)
    && (words.length >= MIN_WORD_COUNT);
}

/**
 * Tests whether a word ends like a verb ({@link PAST_TENSE_SUFFIX} or
 * {@link CONTINUOUS_SUFFIX}), letting a short phrase read as an event rather
 * than a label.
 *
 * @param word - third word of a short phrase
 *
 * @returns whether word ends in a past-tense or continuous suffix
 *
 * @example
 * ```ts
 * endsVerbLike({ word: 'closed' });  // true
 * endsVerbLike({ word: 'pending' }); // true
 * endsVerbLike({ word: 'value' });   // false
 * ```
 */
export function endsVerbLike({ word, }: { readonly word: string; },): boolean {
  /**
   * Lowercased word for suffix comparison.
   */
  const lower = word.toLowerCase();
  return lower.endsWith(PAST_TENSE_SUFFIX,) || lower.endsWith(CONTINUOUS_SUFFIX,);
}

//endregion Shape predicates
