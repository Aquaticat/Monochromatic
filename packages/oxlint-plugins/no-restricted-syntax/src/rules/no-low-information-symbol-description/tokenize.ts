import { NAMESPACE_DELIMITERS, } from './constants.ts';
import type {
  CharKind,
  NamespaceParts,
} from './types.ts';

//region Character classification -- index scan, no regex, no string spread

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
export function charKind({ char, }: { readonly char: string; },): CharKind {
  if ((char >= '0') && (char <= '9'))
    return 'digit';
  if (char.toLowerCase() !== char.toUpperCase())
    return (char === char.toUpperCase()) ? 'upper' : 'lower';
  return 'separator';
}

/**
 * Classifies the character at an index via {@link charKind}, treating
 * out-of-range positions as separators so boundary lookahead and lookbehind
 * never read undefined.
 *
 * @param text - full description text
 *
 * @param index - position to classify; out-of-range reads as separator
 *
 * @returns kind of character at index, or separator when out of range
 *
 * @example
 * ```ts
 * charKindAt({ text: 'aB', index: 1 }); // 'upper'
 * charKindAt({ text: 'a', index: 5 });  // 'separator'
 * ```
 */
function charKindAt(
  {
    text,
    index,
  }: {
    readonly text: string;
    readonly index: number;
  },
): CharKind {
  if ((index < 0) || (index >= text.length))
    return 'separator';
  return charKind({ char: text.charAt(index,), },);
}

/**
 * Detects a word boundary at an index, sampling neighbours via
 * {@link charKindAt}: a lower-or-digit to upper transition, or an acronym
 * run ending where an uppercase letter is followed by lowercase.
 *
 * @param text - full description text
 *
 * @param index - position tested as first character of a new word
 *
 * @returns whether index begins a new word inside a run of non-separators
 *
 * @example
 * ```ts
 * // 'runWith' splits before 'W'
 * isWordBoundary({ text: 'runWith', index: 3 }); // true
 * ```
 */
function isWordBoundary(
  {
    text,
    index,
  }: {
    readonly text: string;
    readonly index: number;
  },
): boolean {
  /**
   * Kind of character preceding the candidate boundary.
   */
  const prevKind = charKindAt({
    text,
    index: index - 1,
  },);
  /**
   * Kind of character at the candidate boundary.
   */
  const kind = charKindAt({
    text,
    index,
  },);
  /**
   * Kind of character following the candidate boundary.
   */
  const nextKind = charKindAt({
    text,
    index: index + 1,
  },);
  /**
   * Whether a lower or digit run gives way to an uppercase letter, as in `runWith`.
   */
  const lowerOrDigitToUpper = ((prevKind === 'lower') || (prevKind === 'digit'))
    && (kind === 'upper');
  /**
   * Whether an uppercase acronym run ends one letter before a lowercase tail, as in `HTTPServer`.
   */
  const acronymToWord = (prevKind === 'upper') && (kind === 'upper')
    && (nextKind === 'lower');
  return lowerOrDigitToUpper || acronymToWord;
}

//endregion Character classification

//region Tokenization

/**
 * Splits a description into words by separators (via {@link charKindAt}),
 * lower-or-digit to upper boundaries, and acronym-run boundaries (via
 * {@link isWordBoundary}). Casing is preserved for structural checks;
 * callers lowercase separately for comparisons.
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
export function splitDescriptionWords(
  { description, }: { readonly description: string; },
): readonly string[] {
  /**
   * Collected words in source order.
   */
  const words: string[] = [];
  /**
   * Characters of the word currently being assembled.
   */
  let current = '';
  for (let index = 0; index < description.length; index += 1) {
    /**
     * Character at the cursor.
     */
    const char = description.charAt(index,);
    if (charKindAt({
      text: description,
      index,
    },) === 'separator') {
      if (current.length > 0) {
        words.push(current,);
        current = '';
      }
      continue;
    }
    if ((current.length > 0) && isWordBoundary({
      text: description,
      index,
    },)) {
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
 * @returns lowercased copies in same order
 *
 * @example
 * ```ts
 * lowerWords({ words: ['HTTP', 'Error'] }); // ['http', 'error']
 * ```
 */
export function lowerWords(
  { words, }: { readonly words: readonly string[]; },
): readonly string[] {
  return words.map(function lower(word,): string {
    return word.toLowerCase();
  },);
}

//endregion Tokenization

//region Namespace

/**
 * Analyses namespace structure, trying each of {@link NAMESPACE_DELIMITERS}
 * in order and tokenizing prefix and tail via {@link splitDescriptionWords}.
 * A `/` or `:` makes a namespace only when the prefix before it has no
 * spaces, so `penpot:skip` is namespaced while `File absent: eaten by cat`
 * stays prose.
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
export function namespaceParts(
  { description, }: { readonly description: string; },
): NamespaceParts {
  for (const delimiter of NAMESPACE_DELIMITERS) {
    /**
     * Position of first delimiter occurrence, or -1 when absent.
     */
    const index = description.indexOf(delimiter,);
    if (index === (-1))
      continue;
    /**
     * Text before delimiter, candidate namespace prefix.
     */
    const prefix = description.slice(
      0,
      index,
    );
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
