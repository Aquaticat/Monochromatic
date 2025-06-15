import {
  type CSSToken,
  isToken,
  isTokenCloseParen,
  isTokenComma,
  isTokenDimension,
  isTokenFunction,
  isTokenIdent,
  isTokenNumber,
  isTokenString,
  isTokenWhitespace,
  isTokenWhiteSpaceOrComment,
  type TokenIdent,
  tokenize,
} from '@csstools/css-tokenizer';
import {
  notEmptyOrThrow,
  notFalsyOrThrow,
} from './error.throw.ts';
import { trimIterableWith } from './iterable.trim.ts';
import { logtapeGetLogger } from './logtape.shared.ts';
import { toSingleQuotedString } from './string.singleQuoted.ts';

const l = logtapeGetLogger(['m', 'limitedGetComputedCss']);

class InCoherentCssValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InCoherentCssValueError';
  }
}

// oxlint-disable-next-line max-classes-per-file
class UnrecognizedSingleCssValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnrecognizedSingleCssValueError';
  }
}

class MalformedCssValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedCssValueError';
  }
}

const identToValueMap = new Map<string, string | number>([
  ['--a', 0],
  ['--b', "'bString'"],
]);

/**
 * Represents either a CSS token or a grouped function token with nested tokens.
 * Function tokens are grouped with their contents to maintain proper nesting structure
 * during CSS parsing and evaluation.
 */
export type GroupedToken = CSSToken | ['function-token-group', GroupedToken[]];

/**
 * Tokenizes CSS value string into array of CSS tokens using CSS tokenizer.
 * Removes the EOF token from the end and validates that tokens were produced.
 * Throws MalformedCssValueError if parsing fails.
 *
 * @param cssValue - CSS value string to tokenize
 * @returns Array of CSS tokens representing the parsed value
 * @throws {MalformedCssValueError} When CSS parsing encounters syntax errors
 * @example
 * ```ts
 * const tokens = lGCC_tokenizeCssValue("var(--color)");
 * // Returns array of tokens representing the var function call
 *
 * const simpleTokens = lGCC_tokenizeCssValue("'hello world'");
 * // Returns array with string token
 * ```
 */
export function lGCC_tokenizeCssValue(cssValue: string): CSSToken[] {
  const tokens = tokenize({ css: cssValue }, {
    onParseError: (error: Error) => {
      throw new MalformedCssValueError(error.message);
    },
  })
    .slice(0, -1); // Trim EOF token

  l.info`${cssValue} -> ${tokens}`;
  notEmptyOrThrow(tokens);
  return tokens;
}

/**
 * Handles simple CSS tokens by removeing their values.
 * Supports number, dimension, string, and specific identifier tokens.
 * For identifier tokens, only 'none' is recognized as valid.
 *
 * @param token - CSS token to remove value from
 * @returns Extracted value as string or number
 * @throws {UnrecognizedSingleCssValueError} When token type isn't supported or identifier isn't 'none'
 * @example
 * ```ts
 * const numberToken = createNumberToken(42);
 * lGCC_handleSimpleToken(numberToken); // 42
 *
 * const stringToken = createStringToken("hello");
 * lGCC_handleSimpleToken(stringToken); // "hello"
 *
 * const noneToken = createIdentToken("none");
 * lGCC_handleSimpleToken(noneToken); // "none"
 * ```
 */
export function lGCC_handleSimpleToken(token: CSSToken): string | number {
  if (isTokenNumber(token) || isTokenDimension(token)) {
    return token[4].value;
  }
  if (isTokenString(token)) {
    return token[1];
  }
  if (isTokenIdent(token)) {
    const tokenValue = token[4].value;
    if (tokenValue === 'none') {
      return tokenValue;
    }
    throw new UnrecognizedSingleCssValueError(
      `${JSON.stringify(token)} ident token isn't none.`,
    );
  }
  throw new UnrecognizedSingleCssValueError(
    `${JSON.stringify(token)} isn't a number, dimension or string.`,
  );
}

/**
 * Type guard that checks if a grouped token represents a function token group.
 * Function token groups are tuples with 'function-token-group' as first element
 * and array of nested tokens as second element.
 *
 * @param item - Grouped token to check
 * @returns True if item is a function token group, false otherwise
 * @example
 * ```ts
 * const functionGroup: GroupedToken = ['function-token-group', [varToken, identToken]];
 * lGCC_isFunctionTokenGroup(functionGroup); // true
 *
 * const regularToken: GroupedToken = someToken;
 * lGCC_isFunctionTokenGroup(regularToken); // false
 * ```
 */
export function lGCC_isFunctionTokenGroup(
  item: GroupedToken,
): item is ['function-token-group', GroupedToken[]] {
  return item[0] === 'function-token-group';
}

/**
 * Recursively checks if a specific token is contained within a group of tokens.
 * Performs deep search through function token groups to find nested tokens.
 * Uses reference equality for direct token comparison.
 *
 * @param tokenToFind - Token to search for within group contents
 * @param groupContents - Array of grouped tokens to search through
 * @returns True if token is found anywhere in the group hierarchy, false otherwise
 * @example
 * ```ts
 * const targetToken = someToken;
 * const group = [token1, ['function-token-group', [targetToken, token2]], token3];
 * lGCC_isTokenDeeplyContained(targetToken, group); // true
 *
 * const notInGroup = otherToken;
 * lGCC_isTokenDeeplyContained(notInGroup, group); // false
 * ```
 */
export function lGCC_isTokenDeeplyContained(tokenToFind: GroupedToken,
  groupContents: GroupedToken[]): boolean
{
  for (const item of groupContents) {
    if (item === tokenToFind) { // Direct reference check for the token itself
      return true;
    }
    // If the item is a function group, recurse into its contents
    // item[1] is GroupedToken[]
    if (
      lGCC_isFunctionTokenGroup(item) && lGCC_isTokenDeeplyContained(tokenToFind, item[1])
    ) { return true; }
    // Here, doing `if(lGCC_isFunctionTokenGroup(item)) {return lGCC_isTokenDeeplyContained(tokenToFind, item[1]);}` cause some test failures because it prematurely exits the loop.
    // If item is a function group, this code immediately returns the result of checking within that item. If tokenToFind isn't in this specific item (but might be in a subsequent item in the groupContents array), the function will incorrectly return false without checking the rest of the groupContents.
  }
  return false;
}

/**
 * Groups CSS function tokens with their contents into hierarchical structures.
 * Processes tokens to identify function boundaries and creates nested groupings
 * for proper CSS function parsing. Handles nested functions recursively.
 *
 * @param tokens - Array of grouped tokens to process into function structures
 * @returns Array of grouped tokens with functions properly nested
 * @example
 * ```ts
 * const tokens = [identToken, functionToken, argToken, closeParenToken];
 * const grouped = lGCC_groupFunctionTokens(tokens);
 * // Returns tokens with function calls grouped with their arguments
 * ```
 */
export function lGCC_groupFunctionTokens(tokens: GroupedToken[]): GroupedToken[] {
  const result = tokens.reduce<GroupedToken[]>(
    function reducer(acc, token: GroupedToken, _, arr: GroupedToken[]) {
      // Skip tokens that are part of function groups we've already processed
      if (lGCC_isTokenDeeplyContained(token, acc)) {
        return acc;
      }

      // Check if we're starting a function group
      if (isTokenFunction(token as CSSToken)) {
        // Create a new function group
        const functionGroup: GroupedToken[] = [token];
        let depth = 1; // Track nesting level
        let i = arr.indexOf(token) + 1;

        // Collect all tokens until matching closing parenthesis
        while (depth > 0) {
          const currentToken = notFalsyOrThrow(arr[i]);
          functionGroup.push(currentToken);

          // Adjust depth based on parentheses
          if (isTokenFunction(currentToken as CSSToken)) {
            depth++;
          }
          if (isTokenCloseParen(currentToken as CSSToken)) {
            depth--;
          }

          i++;
        }

        const reducedFunctionGroupInner: GroupedToken[] = functionGroup
          .slice(1, -1)
          .reduce<
            GroupedToken[]
          >(reducer, []);

        // Add the complete function group to our result
        return [...acc, [
          'function-token-group',
          [
            notFalsyOrThrow(functionGroup.at(0)),
            ...reducedFunctionGroupInner,
            notFalsyOrThrow(functionGroup.at(-1)),
          ],
        ]];
      }
      return [...acc, token];
    },
    [],
  );

  l.info`lGCC_groupFunctionTokens ${tokens} -> ${result}`;

  return result;
}

/**
 * Reduces a grouped token to its string representation by processing different token types.
 * Handles function token groups by delegating to specialized handlers and processes
 * simple tokens like whitespace and strings directly.
 *
 * @param acc - Accumulated string result from previous reductions
 * @param token - Grouped token to process and convert to string
 * @returns Updated accumulated string with token's string representation
 * @throws {UnrecognizedSingleCssValueError} When token type isn't supported
 * @example
 * ```ts
 * const result = lGCC_reduceTokenToString("", stringToken);
 * // Returns string representation of the token
 * ```
 */
export function lGCC_reduceTokenToString(acc: string, token: GroupedToken): string {
  if (token[0] === 'function-token-group') {
    return lGCC_handleFunctionTokenGroup(acc, token);
  }

  const cssToken = token;

  if (isTokenWhitespace(cssToken)) {
    return acc === '' ? acc : `${acc} `;
  }

  if (isTokenString(cssToken)) {
    return lGCC_appendString(acc, cssToken[1]);
  }

  throw new UnrecognizedSingleCssValueError(
    `single cssToken ${JSON.stringify(cssToken)} isn't a string or whitespace`,
  );
}

/**
 * Handles processing of CSS function token groups by delegating to specific function handlers.
 * Currently supports var() functions and validates function names before processing.
 * Throws errors for unsupported function types.
 *
 * @param acc - Accumulated string result from previous processing
 * @param token - Function token group to process
 * @returns Updated accumulated string after processing function
 * @throws {Error} When function token is invalid or function name is unsupported
 * @example
 * ```ts
 * const result = lGCC_handleFunctionTokenGroup("", varFunctionGroup);
 * // Returns processed var() function result
 * ```
 */
export function lGCC_handleFunctionTokenGroup(acc: string, token: GroupedToken): string {
  const functionTokenGroup = token[1] as GroupedToken[];
  const functionToken = notFalsyOrThrow(functionTokenGroup[0]) as CSSToken;

  if (!isTokenFunction(functionToken)) {
    throw new Error(`expected function token, got ${JSON.stringify(functionToken)}`);
  }

  const functionName = notFalsyOrThrow(functionToken[4]).value;
  if (!['var'].includes(functionName)) {
    throw new Error(`Unsupported function name: ${functionName}`);
  }

  if (functionName === 'var') {
    return lGCC_handleVarFunction(acc, functionTokenGroup);
  }

  return acc;
}

/**
 * Handles CSS var() function processing by resolving variable references and fallbacks.
 * Processes var() function arguments to resolve CSS custom properties with fallback support.
 * Validates argument structure and delegates to appropriate handlers.
 *
 * @param acc - Accumulated string result from previous processing
 * @param functionTokenGroup - Array of tokens representing var() function contents
 * @returns Updated accumulated string with resolved var() function value
 * @throws {Error} When var() function has no arguments
 * @throws {InCoherentCssValueError} When first argument isn't string or identifier
 * @example
 * ```ts
 * const result = lGCC_handleVarFunction("", [varToken, identToken, closeParenToken]);
 * // Returns resolved CSS variable value
 * ```
 */
export function lGCC_handleVarFunction(acc: string,
  functionTokenGroup: GroupedToken[]): string
{
  const args = functionTokenGroup.slice(1, -1);
  if (args.length === 0) {
    throw new Error('var() function requires at least one argument');
  }

  const firstArg = notFalsyOrThrow(args[0]);

  if (lGCC_isFunctionTokenGroup(firstArg)) {
    return lGCC_reduceTokenToString(acc, firstArg);
  }

  if (isTokenString(firstArg)) {
    return lGCC_appendString(acc, firstArg[1]);
  }

  if (isTokenIdent(firstArg)) {
    return lGCC_handleVarIdentifier(acc, firstArg, args);
  }

  throw new InCoherentCssValueError(
    `firstArg ${JSON.stringify(firstArg)} isn't a string or ident.`,
  );
}

/**
 * Checks if token isn't whitespace or comment, filtering out non-meaningful CSS tokens.
 * Used to identify tokens that contribute to actual CSS value content during parsing.
 * Function token groups are always considered meaningful.
 *
 * @param potentiallyGroupedToken - CSS token or grouped token to check
 * @returns True if token is meaningful (not whitespace or comment), false otherwise
 * @example
 * ```ts
 * const isValid = lGCC_isNotWhitespaceOrComment(['function-token-group', tokens]);
 * // Returns true for function groups
 *
 * const isValid2 = lGCC_isNotWhitespaceOrComment(identToken);
 * // Returns true for meaningful tokens
 * ```
 */
export function lGCC_isNotWhitespaceOrComment(potentiallyGroupedToken: any): boolean {
  // checking isFunctionTokenGroup is necessary, because other than narrowing the type of potentiallyGroupedToken down, isToken also asserts it's a regular token, which means we'd erroneously remove function token groups if this check isn't here.
  return lGCC_isFunctionTokenGroup(potentiallyGroupedToken)
    || isToken(potentiallyGroupedToken)
      && !isTokenWhiteSpaceOrComment(potentiallyGroupedToken);
}

/**
 * Resolves CSS variable identifier to its computed value using predefined variable mappings.
 * Handles fallback processing when variable is undefined. Validates browser compatibility
 * for numeric values in content property context.
 *
 * @param acc - Accumulated string result from previous processing
 * @param identToken - CSS identifier token representing variable name
 * @param args - Array of tokens representing var() function arguments
 * @returns Updated accumulated string with resolved variable value or fallback
 * @throws {Error} When numeric variables are used in content property context
 * @throws {Error} When fallback structure is malformed
 * @example
 * ```ts
 * const result = lGCC_handleVarIdentifier("", identToken, [identToken, commaToken, fallbackToken]);
 * // Returns resolved variable value or processes fallback
 * ```
 */
export function lGCC_handleVarIdentifier(acc: string, identToken: TokenIdent,
  args: GroupedToken[]): string
{
  const identTokenValue = (identToken[4] as { value: string; }).value;
  const tokenValue = identToValueMap.get(identTokenValue);

  if (typeof tokenValue === 'string') {
    return lGCC_appendString(acc, tokenValue);
  }

  if (typeof tokenValue === 'number') {
    throw new Error(
      `Browsers do not handle numbers in var function if it's in content property, even if a fallback that resolves to string is provided. Browsers, when encountering a var function in which the first argument is an ident that resolves to a number, treat the entire var function as a number, which isn't valid in content property. Ident ${identTokenValue} resolves to number ${tokenValue}.`,
    );
  }

  // tokenValue is undefined, fall back to second argument
  // Skip whitespace and comments before the comma, find the comma, skip whitespace and comments after the comma.
  // We're not validating if the structure is correct.
  // args[0] is the first arg.
  // FIXME: . w:test:    × lGCC_handleVarFunction > handles var(--unknown, var(--b)) 1ms
  //  . w:test:      → No fallback provided for unknown variable --unknown or function structure malformed. Please note this function only supports parsing var(--a) or var(--b, --c) functions.
  const [, ...otherArgs] = args;
  const trimmedOtherArgs = trimIterableWith(lGCC_isNotWhitespaceOrComment, otherArgs);
  const [needToBeCommaToken, ...afterCommaTokens] = trimmedOtherArgs;
  if (!(isToken(needToBeCommaToken) && isTokenComma(needToBeCommaToken))) {
    throw new Error(
      `needToBeCommaToken: ${JSON.stringify(needToBeCommaToken)} isn't a comma token.`,
    );
  }
  const trimmedAfterCommaTokens = trimIterableWith(lGCC_isNotWhitespaceOrComment,
    afterCommaTokens);
  if (trimmedAfterCommaTokens.length !== 1) {
    throw new Error(
      `trimmedAfterCommaTokens: ${
        JSON.stringify(trimmedAfterCommaTokens)
      } isn't of length one. Trimmed from ${JSON.stringify(afterCommaTokens)}`,
    );
  }
  const secondArg = notFalsyOrThrow(trimmedAfterCommaTokens[0]);
  return lGCC_handleVarFallback(acc, secondArg);
}

/**
 * Processes CSS var() function fallback values when primary variable resolution fails.
 * Recursively processes fallback tokens to resolve nested CSS values and functions.
 * Supports function groups, string tokens, and identifier tokens with predefined mappings.
 *
 * @param acc - Accumulated string result from previous processing
 * @param fallbackArg - Single grouped token representing fallback value
 * @returns Updated accumulated string with processed fallback value
 * @throws {UnrecognizedSingleCssValueError} When fallback identifier is undefined or not string
 * @throws {InCoherentCssValueError} When fallback token type is invalid
 * @example
 * ```ts
 * const result = lGCC_handleVarFallback("", stringToken);
 * // Returns processed fallback string value
 *
 * const result2 = lGCC_handleVarFallback("", functionGroup);
 * // Returns processed nested function result
 * ```
 */
export function lGCC_handleVarFallback(acc: string, fallbackArg: GroupedToken): string {
  if (lGCC_isFunctionTokenGroup(fallbackArg)) {
    return lGCC_handleFunctionTokenGroup(acc, fallbackArg);
  }

  if (isTokenString(fallbackArg)) {
    return lGCC_appendString(acc, fallbackArg[1]);
  }

  if (isTokenIdent(fallbackArg)) {
    const tokenValue = identToValueMap.get(fallbackArg[4].value);
    if (typeof tokenValue === 'string') {
      return lGCC_appendString(acc, tokenValue);
    }
    throw new UnrecognizedSingleCssValueError(
      `Fallback ${JSON.stringify(fallbackArg)} is undefined or not a string`,
    );
  }

  throw new InCoherentCssValueError(`Fallback isn't a valid token type`);
}

/**
 * Appends string input to accumulated result with proper quote handling and concatenation.
 * Handles special cases for quote merging when accumulator ends with quoted string.
 * Ensures proper string formatting for CSS content property values.
 *
 * @param acc - Accumulated string result from previous processing
 * @param input - String value to append to accumulator
 * @returns Updated accumulated string with properly formatted concatenation
 * @throws {Error} When accumulator format is malformed for string concatenation
 * @example
 * ```ts
 * const result = lGCC_appendString("", "hello");
 * // Returns "'hello'"
 *
 * const result2 = lGCC_appendString("'start' ", "end");
 * // Returns "'startend'"
 * ```
 */
export function lGCC_appendString(acc: string, input: string): string {
  if (acc.endsWith("' ") && acc.startsWith("'")) {
    return `${acc.slice(0, -"' ".length)}${toSingleQuotedString(input).slice(1)}`;
  }
  if (acc === '') {
    return toSingleQuotedString(input);
  }
  throw new Error(`malformed acc ${acc} with input ${input}`);
}

/**
 * Main function that processes CSS values with limited computed style resolution.
 * Tokenizes CSS input, groups function tokens, and resolves CSS variables using predefined mappings.
 * Designed specifically for CSS content property values with browser compatibility considerations.
 *
 * @param cssValue - CSS value string to process and resolve
 * @returns Processed CSS value with resolved variables and proper formatting
 * @throws {Error} When CSS tokenization fails or produces invalid token structure
 * @throws {UnrecognizedSingleCssValueError} When CSS variables or fallbacks are undefined
 * @throws {InCoherentCssValueError} When CSS value structure is malformed
 * @example
 * ```ts
 * const result = limitedGetComputedCss("var(--my-var, 'fallback')");
 * // Returns resolved CSS value based on predefined variable mappings
 *
 * const result2 = limitedGetComputedCss("'static string'");
 * // Returns "'static string'" (no processing needed)
 * ```
 * @remarks
 * Assumes we're parsing the most simplified representation of a CSS value, by the browser's getComputedValue algorithm.
 *
 * For example, it won't parse `calc(1px + 2px)`, but it will parse `1px` and `2px`.
 * This is a non-exhaustive list of the cases that aren't handled: ['calc', 'rgb', 'rgba', 'hsl', 'hsla', 'url', 'color', 'linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient'].
 * `var` is handled, however, because the browser's getComputedValue algorithm doesn't handle it in `content` values.
 *
 * Throws or gives incorrect results on malformed CSS values.
 * For examples of how browsers handle var resolution, fallback, erroring, and more in the content property, see: https://codepen.io/aquaticat/pen/dPPzEBX
 */
export function limitedGetComputedCss(cssValue: string): string | number {
  // 1. Tokenize the input
  const tokens = lGCC_tokenizeCssValue(cssValue);

  // 2. Handle simple cases (single token)
  if (tokens.length === 1) {
    return lGCC_handleSimpleToken(tokens[0] as CSSToken);
  }

  // 3. Group function tokens
  const groupedTokens = lGCC_groupFunctionTokens(tokens);

  // 4. Process grouped tokens to get final value
  return groupedTokens.reduce(lGCC_reduceTokenToString, '');
}
