//region Thresholds and grammar hooks -- kept visible for future review

/**
 * Minimum word count below which a description carries too little signal.
 */
export const MIN_WORD_COUNT = 3;

/**
 * Minimum distinct lowercased word count; padding a phrase with repeats does
 * not buy past this floor.
 */
export const MIN_DISTINCT_WORD_COUNT = 3;

/**
 * Minimum tail word count after a namespace prefix; a namespace does not
 * rescue a generic short tail.
 */
export const MIN_NAMESPACED_TAIL_WORD_COUNT = 3;

/**
 * Exact word count at which the short-phrase specificity gate applies.
 */
export const SHORT_PHRASE_WORD_COUNT = 3;

/**
 * Minimum length for a consonant-dense (no-vowel) word to count as a technical
 * specificity marker, such as `jsonl` or `lockb`.
 */
export const MIN_NO_VOWEL_WORD_LENGTH = 4;

/**
 * Word length at or below which a word is too small to count as meaningful for
 * repetition checks, such as `of`, `is`, `no`.
 */
export const MAX_INSIGNIFICANT_WORD_LENGTH = 2;

/**
 * Cause-and-effect connective receiving narrow same-phrase-both-sides handling.
 */
export const BECAUSE_CONNECTIVE = 'because';

/**
 * Negation lead word `no`, gated on a specificity marker when it opens a
 * non-namespaced description.
 */
export const NEGATION_PREFIX_NO = 'no';

/**
 * Negation lead word `not`, gated like {@link NEGATION_PREFIX_NO}.
 */
export const NEGATION_PREFIX_NOT = 'not';

/**
 * Past-tense verb suffix that lets a short phrase read as an event, such as
 * `closed` or `denied`.
 */
export const PAST_TENSE_SUFFIX = 'ed';

/**
 * Continuous verb suffix that lets a short phrase read as an event, such as
 * `pending` or `missing`.
 */
export const CONTINUOUS_SUFFIX = 'ing';

/**
 * Dot counts as a structural specificity marker, such as `log.jsonl`.
 */
export const SPECIFICITY_MARKER_DOT = '.';

/**
 * Underscore counts as a structural specificity marker, such as `NO_REFS`.
 */
export const SPECIFICITY_MARKER_UNDERSCORE = '_';

/**
 * Namespace delimiters, tried in order; `/` before `:`.
 */
export const NAMESPACE_DELIMITERS = [
  '/',
  ':',
] as const;

/**
 * ASCII digit characters, tested with `includes` so the description is never
 * spread, `Array.from`-ed, or iterated character by character.
 */
export const DIGIT_CHARACTERS = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
] as const;

/**
 * Vowel characters, tested with `includes` against a lowercased word rather
 * than iterating its characters.
 */
export const VOWEL_CHARACTERS = [
  'a',
  'e',
  'i',
  'o',
  'u',
] as const;

//endregion Thresholds and grammar hooks
