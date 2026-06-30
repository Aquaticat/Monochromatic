/**
 * Shell assignment word helpers.
 *
 * Bash treats leading `NAME=value` words as environment assignments for the
 * command that follows. The guardrail also uses assignment-name extraction to
 * recognise credential handoffs in commands that include command substitution.
 *
 * @module
 */

import type { EnvAssignment, } from './types.ts';

//region Sentinels

/**
 * Sentinel returned when token is not shell assignment word.
 */
const NO_SHELL_ASSIGNMENT: unique symbol = Symbol('shell assignment prefix absent before command',);

/**
 * Result from parsing shell assignment word.
 */
type ShellAssignmentParseResult = EnvAssignment | typeof NO_SHELL_ASSIGNMENT;

//endregion Sentinels

//region Public API

/**
 * Parse shell assignment word when whole token is `NAME=value`, validated
 * with {@link isShellIdentifier}.
 *
 * @param word - shell token to inspect
 *
 * @returns parsed assignment when token starts with valid shell identifier
 *
 * @example
 * ```typescript
 * parseShellAssignmentWord('API_KEY=value'); // { name: 'API_KEY', value: 'value' }
 * parseShellAssignmentWord('echo'); // NO_SHELL_ASSIGNMENT
 * ```
 */
function parseShellAssignmentWord(
  word: string,
): ShellAssignmentParseResult {
  /**
   * Equals sign separating shell assignment name from value.
   */
  const equalsIndex = word.indexOf('=',);
  if (equalsIndex <= 0)
    return NO_SHELL_ASSIGNMENT;

  /**
   * Candidate variable name before equals sign.
   */
  const name = word.slice(
    0,
    equalsIndex,
  );
  if (!isShellIdentifier(name,))
    return NO_SHELL_ASSIGNMENT;

  return {
    name,
    value: word.slice(equalsIndex + 1,),
  };
}

/**
 * Extract shell assignment names embedded anywhere in token text.
 *
 * Trusted-helper detection scans rendered command words and assignment words,
 * including fragments that may contain multiple shell statements. This helper
 * recovers assignment names from that text without treating source text as
 * regular expressions, using {@link isShellIdentifierStartChar} and
 * {@link isShellIdentifierChar} to scan and {@link findShellIdentifierEnd} to
 * bound each candidate.
 *
 * @param word - shell token or token fragment to scan
 *
 * @returns assignment names found before equals signs
 *
 * @example
 * ```typescript
 * extractShellAssignmentNames('); API_KEY='); // ['API_KEY']
 * ```
 */
function extractShellAssignmentNames(
  word: string,
): readonly string[] {
  /**
   * Assignment names discovered while scanning token text.
   */
  const names: string[] = [];

  for (let loopIndex = 0; loopIndex < word.length; loopIndex += 1) {
    /**
     * Character where a shell identifier may begin.
     */
    const candidateStart = word.at(loopIndex,) ?? '';
    if (!isShellIdentifierStartChar(candidateStart,))
      continue;

    /**
     * Previous character blocks matches from middle of longer identifiers.
     */
    const previous = loopIndex > 0
      ? word.at(loopIndex - 1,) ?? ''
      : '';
    if (isShellIdentifierChar(previous,))
      continue;

    /**
     * Index immediately after contiguous shell identifier characters.
     */
    const identifierEnd = findShellIdentifierEnd({
      word,
      start: loopIndex,
    },);
    if (word.at(identifierEnd,) !== '=')
      continue;

    names.push(word.slice(
      loopIndex,
      identifierEnd,
    ),);
  }

  return names;
}

//endregion Public API

//region Character helpers

/**
 * Check whether string is valid shell identifier, testing the first
 * character with {@link isShellIdentifierStartChar} and the rest with
 * {@link isShellIdentifierChar}.
 *
 * @param value - identifier candidate
 *
 * @returns whether candidate follows shell variable naming rules
 *
 * @example
 * ```typescript
 * isShellIdentifier('API_KEY'); // true
 * isShellIdentifier('1API_KEY'); // false
 * ```
 */
function isShellIdentifier(
  value: string,
): boolean {
  if (value === '')
    return false;
  if (!isShellIdentifierStartChar(value.at(0,) ?? '',))
    return false;

  for (let loopIndex = 1; loopIndex < value.length; loopIndex += 1) {
    if (!isShellIdentifierChar(value.at(loopIndex,) ?? '',))
      return false;
  }

  return true;
}

/**
 * Find first index after shell identifier characters, tested with
 * {@link isShellIdentifierChar}.
 *
 * @param word - token text being scanned
 *
 * @param start - index where identifier starts
 *
 * @returns index of first non-identifier character
 *
 * @example
 * ```typescript
 * findShellIdentifierEnd({ word: 'API_KEY=value', start: 0 }); // 7
 * ```
 */
function findShellIdentifierEnd(
  {
    word,
    start,
  }: {
    readonly word: string;
    readonly start: number;
  },
): number {
  for (let loopIndex = start + 1; loopIndex < word.length; loopIndex += 1) {
    if (!isShellIdentifierChar(word.at(loopIndex,) ?? '',))
      return loopIndex;
  }

  return word.length;
}

/**
 * Check whether character may start shell identifier.
 *
 * @param char - single-character string
 *
 * @returns whether character is ASCII letter or underscore
 *
 * @example
 * ```typescript
 * isShellIdentifierStartChar('A'); // true
 * isShellIdentifierStartChar('1'); // false
 * ```
 */
function isShellIdentifierStartChar(
  char: string,
): boolean {
  return ((char >= 'A') && (char <= 'Z'))
    || ((char >= 'a') && (char <= 'z'))
    || (char === '_');
}

/**
 * Check whether character may appear after first shell identifier character.
 *
 * @param char - single-character string
 *
 * @returns whether character is ASCII letter, digit, or underscore
 *
 * @example
 * ```typescript
 * isShellIdentifierChar('1'); // true
 * isShellIdentifierChar('-'); // false
 * ```
 */
function isShellIdentifierChar(
  char: string,
): boolean {
  return isShellIdentifierStartChar(char,)
    || ((char >= '0') && (char <= '9'));
}

//endregion Character helpers

export {
  extractShellAssignmentNames,
  NO_SHELL_ASSIGNMENT,
  parseShellAssignmentWord,
};
