import {
  type CSSToken,
  isTokenCloseParen,
  isTokenDimension,
  isTokenFunction,
  isTokenIdent,
  isTokenNumber,
  isTokenString,
  isTokenWhitespace,
  type TokenIdent,
  tokenize,
} from '@csstools/css-tokenizer';
import {
  notEmptyOrThrow,
  notFalsyOrThrow,
} from './error.throw.ts';
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

export type GroupedToken = CSSToken | ['function-token-group', GroupedToken[]];

export function lGCC_tokenizeCssValue(cssValue: string): CSSToken[] {
  const tokens = tokenize({ css: cssValue }, {
    onParseError: (error: Error) => {
      throw new MalformedCssValueError(error.message);
    },
  })
    .slice(0, -1); // Trim EOF token

  l.warn`${cssValue} -> ${tokens}`;
  notEmptyOrThrow(tokens);
  return tokens;
}

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
      `${JSON.stringify(token)} ident token is not none.`,
    );
  }
  throw new UnrecognizedSingleCssValueError(
    `${JSON.stringify(token)} isn't a number, dimension or string.`,
  );
}

export function lGCC_isFunctionTokenGroup(
  item: GroupedToken,
): item is ['function-token-group', GroupedToken[]] {
  return item[0] === 'function-token-group';
}

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
    // If item is a function group, this code immediately returns the result of checking within that item. If tokenToFind is not in this specific item (but might be in a subsequent item in the groupContents array), the function will incorrectly return false without checking the rest of the groupContents.
  }
  return false;
}

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

  l.warn`lGCC_groupFunctionTokens ${tokens} -> ${result}`;

  return result;
}

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
    `single cssToken ${JSON.stringify(cssToken)} is not a string or whitespace`,
  );
}

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
    `firstArg ${JSON.stringify(firstArg)} is not a string or ident.`,
  );
}

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

  // Fall back to second argument
  const secondArg = args[3]; // Skip comma and whitespace
  if (!secondArg) {
    throw new Error(`No fallback provided for unknown variable ${identTokenValue}`);
  }

  return lGCC_handleVarFallback(acc, secondArg);
}

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

  throw new InCoherentCssValueError(`Fallback is not a valid token type`);
}

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
 * @remarks
 * Assumes we're parsing the most simplified representation of a CSS value, by the browser's getComputedValue algorithm.
 *
 * For example, it will not parse `calc(1px + 2px)`, but it will parse `1px` and `2px`.
 * This is a non-exhaustive list of the cases that are not handled: ['calc', 'rgb', 'rgba', 'hsl', 'hsla', 'url', 'color', 'linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient'].
 * `var` is handled, however, because the browser's getComputedValue algorithm does not handle it in `content` values.
 *
 * Throws on malformed CSS values.
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
