import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

//region Constants -- thresholds and grammar hooks kept visible for future review

/**
 * Minimum word count below which a description carries too little signal.
 */
const MIN_WORD_COUNT = 3;

/**
 * Minimum distinct lowercased word count; padding a phrase with repeats does
 * not buy past this floor.
 */
const MIN_DISTINCT_WORD_COUNT = 3;

/**
 * Minimum tail word count after a namespace prefix; a namespace does not
 * rescue a generic short tail.
 */
const MIN_NAMESPACED_TAIL_WORD_COUNT = 3;

/**
 * Exact word count at which the short-phrase specificity gate applies.
 */
const SHORT_PHRASE_WORD_COUNT = 3;

/**
 * Minimum length for a consonant-dense (no-vowel) word to count as a technical
 * specificity marker, such as `jsonl` or `lockb`.
 */
const MIN_NO_VOWEL_WORD_LENGTH = 4;

/**
 * Word length at or below which a word is too small to count as meaningful for
 * repetition checks, such as `of`, `is`, `no`.
 */
const MAX_INSIGNIFICANT_WORD_LENGTH = 2;

/**
 * Cause-and-effect connective receiving narrow same-phrase-both-sides handling.
 */
const BECAUSE_CONNECTIVE = 'because';

/**
 * Negation lead word `no`, gated on a specificity marker when it opens a
 * non-namespaced description.
 */
const NEGATION_PREFIX_NO = 'no';

/**
 * Negation lead word `not`, gated like {@link NEGATION_PREFIX_NO}.
 */
const NEGATION_PREFIX_NOT = 'not';

/**
 * Past-tense verb suffix that lets a short phrase read as an event, such as
 * `closed` or `denied`.
 */
const PAST_TENSE_SUFFIX = 'ed';

/**
 * Continuous verb suffix that lets a short phrase read as an event, such as
 * `pending` or `missing`.
 */
const CONTINUOUS_SUFFIX = 'ing';

/**
 * Dot counts as a structural specificity marker, such as `log.jsonl`.
 */
const SPECIFICITY_MARKER_DOT = '.';

/**
 * Underscore counts as a structural specificity marker, such as `NO_REFS`.
 */
const SPECIFICITY_MARKER_UNDERSCORE = '_';

/**
 * Namespace delimiters, tried in order; `/` before `:`.
 */
const NAMESPACE_DELIMITERS = [
  '/',
  ':',
] as const;

/**
 * Genuine sentinel for {@link staticDescription} when no static string
 * description is present (absent, dynamic, or non-string). A unique `Symbol`,
 * never `null`, so the return type carries no nullish union.
 */
const NO_STATIC_DESCRIPTION = Symbol('static Symbol description absent or dynamic',);

//endregion Constants

//region Character classification -- linear scan, no regex

/**
 * Structural class of a single character: digit, cased-letter upper or lower,
 * or separator (everything else, including punctuation and whitespace).
 */
type CharKind = 'digit' | 'upper' | 'lower' | 'separator';

/**
 * Classifies one character by structural kind.
 *
 * @param char - single character to classify; empty input reads as separator
 *
 * @returns digit, upper, lower, or separator
 *
 * @example
 * ```ts
 * charKind({ char: 'A' }); // 'upper'
 * charKind({ char: '7' }); // 'digit'
 * charKind({ char: '-' }); // 'separator'
 * ```
 */
function charKind({ char, }: { readonly char: string; },): CharKind {
  if ((char >= '0') && (char <= '9'))
    return 'digit';
  if (char.toLowerCase() !== char.toUpperCase())
    return (char === char.toUpperCase()) ? 'upper' : 'lower';
  return 'separator';
}

/**
 * Classifies the character at an index, treating out-of-range positions as
 * separators so boundary lookahead and lookbehind never read undefined.
 *
 * @param chars - code-point array of full description text
 * @param index - position to classify; out-of-range reads as separator
 *
 * @returns kind of character at index, or separator when out of range
 *
 * @example
 * ```ts
 * charKindAt({ chars: ['a', 'B'], index: 1 }); // 'upper'
 * charKindAt({ chars: ['a'], index: 5 });      // 'separator'
 * ```
 */
function charKindAt(
  { chars, index, }: { readonly chars: readonly string[]; readonly index: number; },
): CharKind {
  if ((index < 0) || (index >= chars.length))
    return 'separator';
  return charKind({ char: chars[index] ?? '', },);
}

/**
 * Detects a word boundary at an index: a lower-or-digit to upper transition, or
 * an acronym run ending where an uppercase letter is followed by lowercase.
 *
 * @param chars - code-point array of full description text
 * @param index - position tested as the first character of a new word
 *
 * @returns whether index begins a new word inside a run of non-separators
 *
 * @example
 * ```ts
 * // 'runWith' splits before 'W'
 * isWordBoundary({ chars: [...'runWith'], index: 3 }); // true
 * ```
 */
function isWordBoundary(
  { chars, index, }: { readonly chars: readonly string[]; readonly index: number; },
): boolean {
  const prevKind = charKindAt({ chars, index: index - 1, },);
  const kind = charKindAt({ chars, index, },);
  const nextKind = charKindAt({ chars, index: index + 1, },);
  const lowerOrDigitToUpper = ((prevKind === 'lower') || (prevKind === 'digit'))
    && (kind === 'upper');
  const acronymToWord = (prevKind === 'upper') && (kind === 'upper') && (nextKind === 'lower');
  return lowerOrDigitToUpper || acronymToWord;
}

//endregion Character classification

//region Tokenization

/**
 * Splits a description into words by separators, lower-or-digit to upper
 * boundaries, and acronym-run boundaries. Casing is preserved for structural
 * checks; callers lowercase separately for comparisons.
 *
 * @param description - raw static Symbol description text
 *
 * @returns words in source order with original casing
 *
 * @example
 * ```ts
 * splitDescriptionWords({ description: 'runWithContext' }); // ['run', 'With', 'Context']
 * splitDescriptionWords({ description: 'HTTP 304 not modified' });
 * // ['HTTP', '304', 'not', 'modified']
 * ```
 */
function splitDescriptionWords({ description, }: { readonly description: string; },): readonly string[] {
  const chars = [...description,];
  const words: string[] = [];
  let current = '';
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index] ?? '';
    if (charKindAt({ chars, index, },) === 'separator') {
      if (current.length > 0) {
        words.push(current,);
        current = '';
      }
      continue;
    }
    if ((current.length > 0) && isWordBoundary({ chars, index, },)) {
      words.push(current,);
      current = '';
    }
    current += char;
  }
  if (current.length > 0)
    words.push(current,);
  return words;
}

/**
 * Lowercases every word for case-insensitive comparison.
 *
 * @param words - words in original casing
 *
 * @returns lowercased copies in the same order
 *
 * @example
 * ```ts
 * lowerWords({ words: ['HTTP', 'Error'] }); // ['http', 'error']
 * ```
 */
function lowerWords({ words, }: { readonly words: readonly string[]; },): readonly string[] {
  return words.map(function lower(word,): string {
    return word.toLowerCase();
  },);
}

//endregion Tokenization

//region Namespace

/**
 * Result of namespace analysis: whether a leading `prefix/` or `prefix:` exists,
 * its words, and the remaining tail words.
 */
type NamespaceParts = {
  /** Whether a space-free namespace prefix preceded a `/` or `:` delimiter. */
  readonly isNamespaced: boolean;
  /** Words of the namespace prefix; empty when not namespaced. */
  readonly namespaceWords: readonly string[];
  /** Words after the delimiter, or the whole description when not namespaced. */
  readonly tailWords: readonly string[];
};

/**
 * Analyses namespace structure. A `/` or `:` makes a namespace only when the
 * prefix before it has no spaces, so `penpot:skip` is namespaced while
 * `File absent: eaten by cat` stays prose.
 *
 * @param description - raw static Symbol description text
 *
 * @returns namespace flag, prefix words, and tail words
 *
 * @example
 * ```ts
 * namespaceParts({ description: 'penpot:skip' });
 * // { isNamespaced: true, namespaceWords: ['penpot'], tailWords: ['skip'] }
 * namespaceParts({ description: 'File absent: eaten by cat' }).isNamespaced; // false
 * ```
 */
function namespaceParts({ description, }: { readonly description: string; },): NamespaceParts {
  for (const delimiter of NAMESPACE_DELIMITERS) {
    const index = description.indexOf(delimiter,);
    if (index === -1)
      continue;
    const prefix = description.slice(0, index,);
    if (prefix.length === 0)
      continue;
    if (prefix.includes(' ',))
      continue;
    return {
      isNamespaced: true,
      namespaceWords: splitDescriptionWords({ description: prefix, },),
      tailWords: splitDescriptionWords({ description: description.slice(index + 1,), },),
    };
  }
  return {
    isNamespaced: false,
    namespaceWords: [],
    tailWords: splitDescriptionWords({ description, },),
  };
}

//endregion Namespace

//region Specificity markers

/**
 * Detects any uppercase cased letter.
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
function hasUppercase({ description, }: { readonly description: string; },): boolean {
  return [...description,].some(function isUpper(char,): boolean {
    return (char.toLowerCase() !== char.toUpperCase()) && (char === char.toUpperCase());
  },);
}

/**
 * Detects any ASCII digit.
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
function hasDigit({ description, }: { readonly description: string; },): boolean {
  return [...description,].some(function isDigit(char,): boolean {
    return (char >= '0') && (char <= '9');
  },);
}

/**
 * Detects a vowel in a word; absence in a long word marks a technical token.
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
  return [...word.toLowerCase(),].some(function isVowel(char,): boolean {
    return (char === 'a') || (char === 'e') || (char === 'i') || (char === 'o') || (char === 'u');
  },);
}

/**
 * Detects a consonant-dense technical token: a long word with no vowel.
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
    return (word.length >= MIN_NO_VOWEL_WORD_LENGTH) && !wordHasVowel({ word, },);
  },);
}

/**
 * Detects a structural specificity marker: uppercase, digit, dot, underscore, or
 * a long vowel-free token. Structural only, never a semantic vocabulary list.
 *
 * @param description - raw static Symbol description text
 * @param words - tokenized words of description
 *
 * @returns whether description carries any structural specificity marker
 *
 * @example
 * ```ts
 * hasSpecificityMarker({ description: 'file log.jsonl exists', words: ['file', 'log', 'jsonl', 'exists'] });
 * // true (dot, plus a long vowel-free token)
 * ```
 */
function hasSpecificityMarker(
  { description, words, }: { readonly description: string; readonly words: readonly string[]; },
): boolean {
  return hasUppercase({ description, },)
    || hasDigit({ description, },)
    || description.includes(SPECIFICITY_MARKER_DOT,)
    || description.includes(SPECIFICITY_MARKER_UNDERSCORE,)
    || hasLongNoVowelWord({ words, },);
}

//endregion Specificity markers

//region Casing and repetition

/**
 * Tests whether a word contains at least one cased letter.
 *
 * @param word - single word to inspect
 *
 * @returns whether word has a cased letter
 *
 * @example
 * ```ts
 * wordHasLetter({ word: '304' });   // false
 * wordHasLetter({ word: 'HTTP' });  // true
 * ```
 */
function wordHasLetter({ word, }: { readonly word: string; },): boolean {
  return [...word,].some(function isLetter(char,): boolean {
    return char.toLowerCase() !== char.toUpperCase();
  },);
}

/**
 * Tests whether every cased letter in a word is uppercase; non-letters ignored.
 *
 * @param word - single word to inspect
 *
 * @returns whether all cased letters are uppercase
 *
 * @example
 * ```ts
 * wordLettersAllUppercase({ word: 'HTTP304' }); // true
 * wordLettersAllUppercase({ word: 'Http' });    // false
 * ```
 */
function wordLettersAllUppercase({ word, }: { readonly word: string; },): boolean {
  return [...word,].every(function letterIsUpper(char,): boolean {
    if (char.toLowerCase() === char.toUpperCase())
      return true;
    return char === char.toUpperCase();
  },);
}

/**
 * Tests whether every word that contains letters is fully uppercase, with at
 * least one lettered word present. Catches constant-style `NO_REFS`,
 * `VALUE IS MISSING`.
 *
 * @param words - words in original casing
 *
 * @returns whether all alphabetic words are uppercase
 *
 * @example
 * ```ts
 * allAlphabeticWordsUppercase({ words: ['STATE', 'IS', 'UNKNOWN'] }); // true
 * allAlphabeticWordsUppercase({ words: ['HTTP', '304', 'modified'] }); // false
 * ```
 */
function allAlphabeticWordsUppercase({ words, }: { readonly words: readonly string[]; },): boolean {
  const letteredWords = words.filter(function pickLettered(word,): boolean {
    return wordHasLetter({ word, },);
  },);
  if (letteredWords.length === 0)
    return false;
  return letteredWords.every(function allUpper(word,): boolean {
    return wordLettersAllUppercase({ word, },);
  },);
}

/**
 * Reduces words to meaningful ones for repetition checks: drops words of length
 * 2 or less and words repeated from the namespace prefix.
 *
 * @param words - tokenized words of description
 * @param namespaceWords - words of the namespace prefix
 *
 * @returns lowercased meaningful words in source order
 *
 * @example
 * ```ts
 * meaningfulWords({ words: ['tsdoc', 'no', 'tag'], namespaceWords: ['tsdoc'] }); // ['tag']
 * ```
 */
function meaningfulWords(
  {
    words,
    namespaceWords,
  }: { readonly words: readonly string[]; readonly namespaceWords: readonly string[]; },
): readonly string[] {
  const namespaceSet = new Set(lowerWords({ words: namespaceWords, },),);
  return lowerWords({ words, },).filter(function isMeaningful(word,): boolean {
    if (word.length <= MAX_INSIGNIFICANT_WORD_LENGTH)
      return false;
    if (namespaceSet.has(word,))
      return false;
    return true;
  },);
}

/**
 * Detects a repeated meaningful word; repetition adds no debugging information.
 *
 * @param words - tokenized words of description
 * @param namespaceWords - words of the namespace prefix
 *
 * @returns whether any meaningful word repeats
 *
 * @example
 * ```ts
 * repeatedMeaningfulWord({ words: ['file', 'file', 'exists'], namespaceWords: [] }); // true
 * ```
 */
function repeatedMeaningfulWord(
  {
    words,
    namespaceWords,
  }: { readonly words: readonly string[]; readonly namespaceWords: readonly string[]; },
): boolean {
  const meaningful = meaningfulWords({ words, namespaceWords, },);
  return meaningful.length !== new Set(meaningful,).size;
}

/**
 * Detects the narrow `because` failure: the same meaningful phrase appears on
 * both sides, as in `file absent because file absent`. Presence of `because`
 * alone never exempts a description.
 *
 * @param words - tokenized words of description
 * @param namespaceWords - words of the namespace prefix
 *
 * @returns whether both sides of `because` repeat the same phrase
 *
 * @example
 * ```ts
 * repeatsSamePhraseAcrossBecause({
 *   words: ['file', 'absent', 'because', 'file', 'absent'],
 *   namespaceWords: [],
 * }); // true
 * ```
 */
function repeatsSamePhraseAcrossBecause(
  {
    words,
    namespaceWords,
  }: { readonly words: readonly string[]; readonly namespaceWords: readonly string[]; },
): boolean {
  const lowered = lowerWords({ words, },);
  const becauseIndex = lowered.indexOf(BECAUSE_CONNECTIVE,);
  if (becauseIndex === -1)
    return false;
  const leftWords = meaningfulWords({ words: words.slice(0, becauseIndex,), namespaceWords, },);
  const rightWords = meaningfulWords({ words: words.slice(becauseIndex + 1,), namespaceWords, },);
  if (leftWords.length !== rightWords.length)
    return false;
  return leftWords.every(function sameWord(word, index,): boolean {
    return word === rightWords[index];
  },);
}

//endregion Casing and repetition

//region Shape predicates

/**
 * Detects any separator character.
 *
 * @param description - raw static Symbol description text
 *
 * @returns whether description contains a separator
 *
 * @example
 * ```ts
 * hasSeparator({ description: 'no-value' });       // true
 * hasSeparator({ description: 'runWithContext' }); // false
 * ```
 */
function hasSeparator({ description, }: { readonly description: string; },): boolean {
  return [...description,].some(function isSeparator(char,): boolean {
    return charKind({ char, },) === 'separator';
  },);
}

/**
 * Detects a bare camelCase or PascalCase identifier: no separator, an uppercase
 * letter, and enough words, as in `runWithContext`. Reads like a code symbol,
 * not a debugging phrase.
 *
 * @param description - raw static Symbol description text
 * @param words - tokenized words of description
 *
 * @returns whether description is a bare camel/Pascal identifier
 *
 * @example
 * ```ts
 * isBareCamelIdentifier({ description: 'runWithContext', words: ['run', 'With', 'Context'] }); // true
 * ```
 */
function isBareCamelIdentifier(
  { description, words, }: { readonly description: string; readonly words: readonly string[]; },
): boolean {
  return !hasSeparator({ description, },)
    && hasUppercase({ description, },)
    && (words.length >= MIN_WORD_COUNT);
}

/**
 * Tests whether a word ends like a verb (past tense or continuous), letting a
 * short phrase read as an event rather than a label.
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
function endsVerbLike({ word, }: { readonly word: string; },): boolean {
  const lower = word.toLowerCase();
  return lower.endsWith(PAST_TENSE_SUFFIX,) || lower.endsWith(CONTINUOUS_SUFFIX,);
}

//endregion Shape predicates

//region Classifier

/**
 * Message id for each failure branch; the visitor reports the matching one.
 */
type FailureMessageId =
  | 'tooFewWords'
  | 'allUppercase'
  | 'bareCamelIdentifier'
  | 'repeatedMeaningfulWord'
  | 'shortNamespacedTail'
  | 'startsWithNoWithoutMarker'
  | 'startsWithNotWithoutMarker'
  | 'shortPhraseLacksSpecificityMarker';

/**
 * Verdict for a static description: a pass, or a fail carrying its message id.
 */
type SymbolDescriptionVerdict =
  | { readonly status: 'pass'; }
  | { readonly status: 'fail'; readonly messageId: FailureMessageId; };

/**
 * Classifies a static Symbol description, returning the first matching failure
 * branch in the calibrated order, or a pass. Ported from the persisted
 * benchmark classifier, not the threshold baseline.
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
function classifySymbolDescription(
  { description, }: { readonly description: string; },
): SymbolDescriptionVerdict {
  const words = splitDescriptionWords({ description, },);
  const lowered = lowerWords({ words, },);
  const distinctCount = new Set(lowered,).size;
  const namespace = namespaceParts({ description, },);
  const { namespaceWords, } = namespace;
  const marker = hasSpecificityMarker({ description, words, },);
  const repeated = lowered.includes(BECAUSE_CONNECTIVE,)
    ? repeatsSamePhraseAcrossBecause({ words, namespaceWords, },)
    : repeatedMeaningfulWord({ words, namespaceWords, },);
  if ((words.length < MIN_WORD_COUNT) || (distinctCount < MIN_DISTINCT_WORD_COUNT))
    return { status: 'fail', messageId: 'tooFewWords', };
  if (allAlphabeticWordsUppercase({ words, },))
    return { status: 'fail', messageId: 'allUppercase', };
  if (isBareCamelIdentifier({ description, words, },))
    return { status: 'fail', messageId: 'bareCamelIdentifier', };
  if (repeated)
    return { status: 'fail', messageId: 'repeatedMeaningfulWord', };
  if (namespace.isNamespaced && (namespace.tailWords.length < MIN_NAMESPACED_TAIL_WORD_COUNT))
    return { status: 'fail', messageId: 'shortNamespacedTail', };
  if (!namespace.isNamespaced && (lowered[0] === NEGATION_PREFIX_NO) && !marker)
    return { status: 'fail', messageId: 'startsWithNoWithoutMarker', };
  if (!namespace.isNamespaced && (lowered[0] === NEGATION_PREFIX_NOT) && !marker)
    return { status: 'fail', messageId: 'startsWithNotWithoutMarker', };
  if (!namespace.isNamespaced && (words.length === SHORT_PHRASE_WORD_COUNT) && !marker) {
    const thirdWord = words[2];
    if ((thirdWord !== undefined) && !endsVerbLike({ word: thirdWord, },))
      return { status: 'fail', messageId: 'shortPhraseLacksSpecificityMarker', };
  }
  return { status: 'pass', };
}

//endregion Classifier

//region AST helpers

/**
 * Checks whether a call is `Symbol(...)` via the global identifier.
 *
 * @param node - call expression to inspect
 *
 * @returns whether callee is the bare `Symbol` identifier
 *
 * @example
 * ```ts
 * isSymbolCall({ node }); // true for Symbol('id')
 * ```
 */
function isSymbolCall({ node, }: { readonly node: ESTree.CallExpression; },): boolean {
  const { callee, } = node;
  return (callee.type === 'Identifier') && (callee.name === 'Symbol');
}

/**
 * Checks whether a call is `Symbol.for(...)` via a static member access.
 *
 * @param node - call expression to inspect
 *
 * @returns whether callee is the static `Symbol.for` member
 *
 * @example
 * ```ts
 * isSymbolForCall({ node }); // true for Symbol.for('id')
 * ```
 */
function isSymbolForCall({ node, }: { readonly node: ESTree.CallExpression; },): boolean {
  const { callee, } = node;
  if (callee.type !== 'MemberExpression')
    return false;
  if (callee.computed)
    return false;
  const {
    object,
    property,
  } = callee;
  if ((object.type !== 'Identifier') || (object.name !== 'Symbol'))
    return false;
  return (property.type === 'Identifier') && (property.name === 'for');
}

/**
 * Extracts a static string description from a Symbol call's first argument:
 * a string literal, or a zero-expression template literal. Absent, dynamic, and
 * non-string descriptions yield {@link NO_STATIC_DESCRIPTION}.
 *
 * @param node - Symbol or Symbol.for call expression
 *
 * @returns static description text, or sentinel when none is statically known
 *
 * @example
 * ```ts
 * staticDescription({ node }); // 'id' for Symbol('id') and Symbol(`id`)
 * ```
 */
function staticDescription(
  { node, }: { readonly node: ESTree.CallExpression; },
): string | typeof NO_STATIC_DESCRIPTION {
  const [firstArgument,] = node.arguments;
  if (firstArgument === undefined)
    return NO_STATIC_DESCRIPTION;
  if ((firstArgument.type === 'Literal') && ((typeof firstArgument.value) === 'string'))
    return firstArgument.value;
  if (
    (firstArgument.type === 'TemplateLiteral')
    && (firstArgument.expressions.length === 0)
    && (firstArgument.quasis.length === 1)
  ) {
    const [onlyQuasi,] = firstArgument.quasis;
    if (onlyQuasi === undefined)
      return NO_STATIC_DESCRIPTION;
    const { cooked, } = onlyQuasi.value;
    if (cooked === null)
      return NO_STATIC_DESCRIPTION;
    return cooked;
  }
  return NO_STATIC_DESCRIPTION;
}

//endregion AST helpers

/**
 * Requires static Symbol descriptions to carry enough debugging information.
 *
 * Sentinel Symbols stand in for nullish unions, so their descriptions are the
 * only debugging identity at a crash site. Descriptions that read like generic
 * code identifiers, generic absence labels, or repeated low-information phrases
 * report; descriptions with enough contextual detail pass even when short.
 *
 * Only static `Symbol('...')`, `Symbol.for('...')`, and zero-expression
 * template-literal descriptions are checked. Absent, dynamic, and non-string
 * descriptions are skipped because type information is unavailable in an oxlint
 * JS plugin. No-argument `Symbol()` is never reported.
 *
 * The classifier is structural: word counts, casing, namespace shape, repetition,
 * and a small set of grammar hooks (`no`, `not`, `because`, `ed`, `ing`). It uses
 * no Shannon entropy, no global compression, and no broad vocabulary lists.
 *
 * @example
 * ```ts
 * // Bad
 * const A = Symbol('meow');
 * const B = Symbol('not-found');
 * const C = Symbol('runWithContext');
 *
 * // Good
 * const D = Symbol('github token expired');
 * const E = Symbol('penpot/figma-input-has-no-counterpart');
 * const F = Symbol('average divisor is zero');
 * ```
 */
export const noLowInformationSymbolDescription: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require static Symbol descriptions to carry enough debugging information; reject generic identifiers, absence labels, and repeated low-information phrases.',
      recommended: true,
    },
    messages: {
      tooFewWords:
        'Symbol description has fewer than 3 distinct words, so it carries little debugging signal. Name what is absent and why, for example "config file missing on disk".',
      allUppercase:
        'Symbol description is entirely uppercase words, which reads like a constant name. Use a descriptive lowercase phrase, for example "github token expired".',
      bareCamelIdentifier:
        'Symbol description is a bare camelCase or PascalCase identifier with no separators, which reads like a function name. Describe the condition as a phrase, for example "run completed without a context".',
      repeatedMeaningfulWord:
        'Symbol description repeats a meaningful word, which adds no information. Replace the repetition with concrete detail about the condition.',
      shortNamespacedTail:
        'Symbol description has a namespace prefix but a tail shorter than 3 words. A namespace does not rescue a generic tail; expand it, for example "penpot/figma-input-has-no-counterpart".',
      startsWithNoWithoutMarker:
        'Symbol description starts with "no" but has no specificity marker (uppercase, digit, dot, underscore, or a consonant-dense token). Name the specific thing that is absent, for example "no upstream branch for HEAD".',
      startsWithNotWithoutMarker:
        'Symbol description starts with "not" but has no specificity marker. Name the specific condition, for example "not inside a Git worktree".',
      shortPhraseLacksSpecificityMarker:
        'Symbol description is a 3-word phrase with no specificity marker and no past-tense or continuous verb. Add a concrete technical token or describe the action, for example "average divisor is zero".',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Reports a Symbol or Symbol.for call whose static description fails the
     * classifier. Calls without a static string description are skipped.
     *
     * @param node - call expression visited by oxlint
     */
    function checkCallExpression(node: ESTree.CallExpression,): void {
      if (!isSymbolCall({ node, },) && !isSymbolForCall({ node, },))
        return;
      const description = staticDescription({ node, },);
      if ((typeof description) !== 'string')
        return;
      const verdict = classifySymbolDescription({ description, },);
      if (verdict.status === 'pass')
        return;
      context.report({
        node,
        messageId: verdict.messageId,
      },);
    }

    return {
      CallExpression: checkCallExpression,
    };
  },
};
