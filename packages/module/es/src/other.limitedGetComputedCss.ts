import {
  type CSSToken,
  isTokenCloseParen,
  isTokenDimension,
  isTokenFunction,
  isTokenIdent,
  isTokenNumber,
  isTokenString,
  isTokenWhitespace,
  tokenize,
} from '@csstools/css-tokenizer';
import {
  notEmptyOrThrow,
  notFalsyOrThrow,
} from './error.throw.ts';
import { logtapeGetLogger } from './logtape.shared.ts';
import { isNumberString } from './string.is.ts';
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

type GroupedToken = CSSToken | ['function-token-group', GroupedToken[]];

const identToValueMap = new Map<string, string | number>([
  ['--a', 0],
  ['--b', "'bString'"],
]);

function appendToAccInStringRepresentation(
  acc: string,
  input: string,
): string {
  if (acc.endsWith("' ") && acc.startsWith("'")) {
    return `${acc.slice(-"' ".length)}${toSingleQuotedString(input).slice(1)}`;
  }
  if (acc === '') {
    return toSingleQuotedString(input);
  }
  throw new Error(`malformed acc ${acc} with input ${input}`);
}

function tokenizeCssValue(cssValue: string): CSSToken[] {
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

function isSimpleCase(tokens: CSSToken[]): boolean {
  return tokens.length === 1;
}

function handleSimpleToken(token: CSSToken): string | number {
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

function groupFunctionTokens(tokens: GroupedToken[]): GroupedToken[] {
  return tokens.reduce<GroupedToken[]>(
    function reducer(acc, token: GroupedToken, _, arr: GroupedToken[]) {
      // Check if we're starting a function group
      if (isTokenFunction(token as CSSToken)) {
        // Create a new function group and process it
        return [...acc, createFunctionGroup(token, arr)];
      }

      // Skip tokens that are part of function groups we've already processed
      if (isTokenAlreadyProcessed(token, acc)) {
        return acc;
      }

      return [...acc, token];
    },
    [],
  );
}

function createFunctionGroup(token: GroupedToken, arr: GroupedToken[]): GroupedToken {
  const functionGroup: GroupedToken[] = [token];
  let depth = 1;
  let i = arr.indexOf(token) + 1;

  // Collect all tokens until matching closing parenthesis
  while (depth > 0) {
    const currentToken = notFalsyOrThrow(arr[i]);
    functionGroup.push(currentToken);

    if (isTokenFunction(currentToken as CSSToken)) {
      depth++;
    }
    if (isTokenCloseParen(currentToken as CSSToken)) {
      depth--;
    }

    i++;
  }

  const reducedFunctionGroupInner = functionGroup
    .slice(1, -1)
    .reduce<GroupedToken[]>(groupFunctionTokens, []);

  return [
    'function-token-group',
    [
      notFalsyOrThrow(functionGroup.at(0)),
      ...reducedFunctionGroupInner,
      notFalsyOrThrow(functionGroup.at(-1)),
    ],
  ];
}

function isTokenAlreadyProcessed(token: GroupedToken, acc: GroupedToken[]): boolean {
  const functionGroups = acc.filter((item) => item[0] === 'function-token-group');
  for (const group of functionGroups) {
    if (group[1].includes(token)) {
      return true;
    }
  }
  return false;
}

function processGroupedTokens(groupedTokens: GroupedToken[]): string | number {
  return groupedTokens.reduce(reduceTokenToString, '');
}

function reduceTokenToString(acc: string, token: GroupedToken): string {
  if (token[0] === 'function-token-group') {
    return handleFunctionTokenGroup(acc, token);
  }

  const cssToken = token;

  if (isTokenWhitespace(cssToken)) {
    return acc === '' ? acc : `${acc} `;
  }

  if (isTokenString(cssToken)) {
    return appendString(acc, cssToken[1]);
  }

  throw new UnrecognizedSingleCssValueError(
    `single cssToken ${JSON.stringify(cssToken)} is not a string or whitespace`,
  );
}

function handleFunctionTokenGroup(acc: string, token: GroupedToken): string {
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
    return handleVarFunction(acc, functionTokenGroup);
  }

  return acc;
}

function handleVarFunction(acc: string, functionTokenGroup: GroupedToken[]): string {
  const args = functionTokenGroup.slice(1, -1);
  if (args.length === 0) {
    throw new Error('var() function requires at least one argument');
  }

  const firstArg = notFalsyOrThrow(args[0]);

  if (firstArg[0] === 'function-token-group') {
    return firstArg[1].reduce(reduceTokenToString, acc);
  }

  if (isTokenString(firstArg)) {
    return appendString(acc, firstArg[1]);
  }

  if (isTokenIdent(firstArg)) {
    return handleVarIdentifier(acc, firstArg, args);
  }

  throw new InCoherentCssValueError(
    `firstArg ${JSON.stringify(firstArg)} is not a string or ident.`,
  );
}

function handleVarIdentifier(acc: string, identToken: CSSToken,
  args: GroupedToken[]): string
{
  const identTokenValue = identToken[4];
  const tokenValue = identToValueMap.get(identToken[4].value);

  if (typeof tokenValue === 'string') {
    return appendString(acc, tokenValue);
  }

  // Fall back to second argument
  const secondArg = args[3]; // Skip comma and whitespace
  if (!secondArg) {
    throw new Error(`No fallback provided for unknown variable ${identToken[4].value}`);
  }

  return handleVarFallback(acc, secondArg);
}

function handleVarFallback(acc: string, fallbackArg: GroupedToken): string {
  if (fallbackArg[0] === 'function-token-group') {
    return fallbackArg[1].reduce(reduceTokenToString, acc);
  }

  if (isTokenString(fallbackArg)) {
    return appendString(acc, fallbackArg[1]);
  }

  if (isTokenIdent(fallbackArg)) {
    const tokenValue = identToValueMap.get(fallbackArg[4].value);
    if (typeof tokenValue === 'string') {
      return appendString(acc, tokenValue);
    }
    throw new UnrecognizedSingleCssValueError(
      `Fallback ${JSON.stringify(fallbackArg)} is undefined or not a string`,
    );
  }

  throw new InCoherentCssValueError(`Fallback is not a valid token type`);
}

function appendString(acc: string, input: string): string {
  if (acc.endsWith("' ") && acc.startsWith("'")) {
    return `${acc.slice(0, -"' ".length)}${toSingleQuotedString(input).slice(1)}`;
  }
  if (acc === '') {
    return toSingleQuotedString(input);
  }
  throw new Error(`malformed acc ${acc} with input ${input}`);
}

export function limitedGetComputedCssBak(cssValue: string): string | number {
  const tokens = tokenize({ css: cssValue }, {
    onParseError: (error: Error) => {
      throw new MalformedCssValueError(error.message);
    },
  })
    .slice(0, // Trim EOF-token
      -1);
  l.warn`${cssValue} -> ${tokens}`;

  notEmptyOrThrow(tokens);

  //region -- Simple, non-iterative cases: number, dimension

  if (tokens.length === 1) {
    const token = notFalsyOrThrow(tokens[0]);
    if (isTokenNumber(token) || isTokenDimension(token)) {
      return token[4].value;
    }
    if (isTokenString(token)) {
      // Found a string token, the entire value should be a string token.
      // Returning the 2nd element of the token to preserve the quotes.
      return token[1];
    }
    if (isTokenIdent(token)) {
      const tokenValue = token[4].value;
      if (tokenValue === 'none') {
        return tokenValue;
      }
      throw new UnrecognizedSingleCssValueError(
        `${cssValue} -> ${JSON.stringify(token)} ident token is not none.`,
      );
    }
    throw new UnrecognizedSingleCssValueError(
      `${cssValue} -> ${JSON.stringify(token)} isn't a number, dimension or string.`,
    );
  }

  //endregion -- Simple

  //region -- put everything between, including function-token and )-token, into a group.
  const groupedTokens = tokens.reduce<GroupedToken[]>(
    function reducer(acc, token: GroupedToken, _, arr: GroupedToken[]) {
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
          if (isTokenFunction(currentToken as CSSToken)) { depth++; }
          if (isTokenCloseParen(currentToken as CSSToken)) { depth--; }

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

      // Skip tokens that are part of function groups we've already processed
      const functionGroups = acc.filter(function isFunctionTokenGroup(item) {
        return item[0] === 'function-token-group';
      });
      for (const group of functionGroups) {
        if (group[1].includes(token)) {
          return acc;
        }
      }

      return [...acc, token];
    },
    [],
  );

  l.warn`${tokens} -> ${groupedTokens}`;

  const stringRepresentation = groupedTokens.reduce(function reducer(
    acc: string,
    token: GroupedToken,
  ): string {
    if (token[0] === 'function-token-group') {
      // Token is a function token group
      const functionTokenGroup = token[1];
      const functionToken = notFalsyOrThrow(functionTokenGroup[0]) as CSSToken;
      if (!isTokenFunction(functionToken)) {
        throw new Error(`expected function token, got ${JSON.stringify(functionToken)}`);
      }
      const functionName = notFalsyOrThrow(functionToken[4]).value;
      if (!['var'].includes(functionName)) {
        throw new Error(`Unsupported function name: ${functionName}`);
      }

      if (functionName === 'var') {
        /* Handle var(--a, 'b') or var(--a, var(--b))
        The individual args are either an ident or a string or a function group.
        * */
        const args = functionTokenGroup.slice(1, -1);
        if (args.length === 0) {
          throw new Error('var() function requires at least one argument');
        }
        // Get the value of first arg.
        const firstArg = notFalsyOrThrow(args[0]);
        if (firstArg[0] === 'function-token-group') {
          l.warn`${firstArg} is a function token group.`;
          // Need to recursively call a function that processes a function token group to a string here.
          return firstArg[1].reduce(reducer, '');
        }
        // For a var function, the first arg cannot be a whitespace.
        /*        if (isTokenWhitespace(firstArg)) {
          if (acc === '') { return acc; }
          return `${acc} `;
        }*/
        if (isTokenString(firstArg)) {
          return appendToAccInStringRepresentation(acc, firstArg[1]);
        }
        if (isTokenIdent(firstArg)) {
          // We shouldn't throw on undefined here because for the firstArg, if it's undefined, we fall back to the 2nd arg.
          const tokenValue = identToValueMap.get(firstArg[4].value);
          if (typeof tokenValue === 'string') {
            return appendToAccInStringRepresentation(acc, tokenValue);
          }
          /* DANGEROUS: Since we're trying to get the string representation of the entire cssValue,
             we have to throw (or fallback) on number.
             For a true general purpose function to get computed value of a cssValue, this might have to be implemented differently.*/

          // Fall back to the 2nd arg. Throws if the 2nd arg also can't be computed.

          // We actually want this to throw if the 2nd arg doesn't exist.
          const secondArg = notFalsyOrThrow(args[
            // Skipping comma-token and whitespace-token
            3
          ]);

          if (secondArg[0] === 'function-token-group') {
            l.warn`${secondArg} is a function token group.`;
            // Need to recursively call a function that processes a function token group to a string here.
            return secondArg[1].reduce(reducer, '');
          }
          if (isTokenString(secondArg)) {
            return appendToAccInStringRepresentation(acc, firstArg[1]);
          }
          if (isTokenIdent(secondArg)) {
            // Always throw on undefined for 2nd arg.
            const tokenValue = identToValueMap.get(secondArg[4].value);
            if (tokenValue === 'string') {
              return appendToAccInStringRepresentation(acc, tokenValue);
            }
            throw new UnrecognizedSingleCssValueError(
              `2nd arg ${JSON.stringify(secondArg)} is undefined or number.`,
            );
          }
        }
        throw new InCoherentCssValueError(
          `firstArg ${JSON.stringify(firstArg)} is not a string or ident.`,
        );
      }
    }
    // TODO: Token is not a function group, might be a string or whitespace (which needs special handling).

    const cssToken = token as CSSToken;
    if (isTokenWhitespace(cssToken)) {
      if (acc === '') {
        return acc;
      }
      return `${acc} `;
    }
    if (isTokenString(cssToken)) {
      return appendToAccInStringRepresentation(acc, cssToken[1]);
    }
    // Single cssToken here cannot be an ident, because we already handled that case in region -- Simple.
    throw new UnrecognizedSingleCssValueError(
      `single cssToken ${
        JSON.stringify(cssToken)
      } is not a string or whitespace in ${cssValue}`,
    );
  }, '');

  return stringRepresentation;

  //endregion

  /* Only processes cssValue with the form /^(?:var\(--\w+(?:, *(?:['"][^'"]*['"]|var\(--\w+\)))?\)|['"][^'"]*['"])(?: +(?:var\(--\w+(?:,\s*(?:['"][^'"]*['"]|var\(--\w+\)))?\)|['"][^'"]*['"]))*$/mgv
   var(--a)

   var(--a, 'b')

   var(--a, var(--b))

   'a' var(--b)

   'c' 'd'

   'e'

   var(--a) 'b'
  * */
  /*  for (const token of tokens) {
    if (isTokenNumber(token) || isTokenDimension(token)) {
      // Found a number or dimension token, the entire value should be a number or dimension token.
      throw new InCoherentCssValueError(
        `Found a number or dimension token ${
          String(token)
        }, the entire value ${cssValue} should be a number or dimension token.`,
      );
    }
    if (token.type === 'comment') {
      continue;
    }
    if (token.type === 'string') {
      return token.value;
    }
    if (token.type === 'number') {
      return Number(token.value);
    }
  }*/

  /*  if (cssValue === 'none') {
    return cssValue;
  }
  if (isNumberString(cssValue)) {
    return Number(cssValue);
  }
  if (/^var\(--\w+\)/v.test(cssValue)) {
    const cssVariableNameWDashes = cssValue.slice(4, -1);
    const cssVariableNameWoDashes = cssValue.slice(6, -1);

    if (cssVariableNameWoDashes === 'a') {
      return 0;
    }
    if (cssVariableNameWDashes === 'b') {
      return 'bString';
    }

    throw new Error(
      'Not implemented in limitedGetComputedCss, a function where base cases only handle the examples.',
    );
  }*/

  // TODO: implement the rest of the CSS parsing logic.
  // throw new Error('Not implemented yet');
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
 */
export function limitedGetComputedCss(cssValue: string): string | number {
  // 1. Tokenize the input
  const tokens = tokenizeCssValue(cssValue);

  // 2. Handle simple cases (single token)
  if (isSimpleCase(tokens)) {
    return handleSimpleToken(tokens[0]);
  }

  // 3. Group function tokens
  const groupedTokens = groupFunctionTokens(tokens);

  // 4. Process grouped tokens to get final value
  return processGroupedTokens(groupedTokens);
}
