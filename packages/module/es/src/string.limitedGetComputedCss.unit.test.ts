// @ts-nocheck -- Too many type errors in this file due to @csstools/css-tokenizer, so we disable type checking for now.
import {
  type CSSToken,
  isTokenEOF,
  type TokenCloseParen,
  type TokenComma,
  type TokenDimension,
  type TokenFunction,
  type TokenIdent,
  type TokenNumber,
  type TokenString,
  type TokenWhitespace,
} from '@csstools/css-tokenizer';
import {
  type GroupedToken,
  lGCC_appendString,
  lGCC_groupFunctionTokens,
  lGCC_handleFunctionTokenGroup,
  lGCC_handleSimpleToken,
  lGCC_handleVarFallback,
  lGCC_handleVarFunction,
  lGCC_handleVarIdentifier,
  lGCC_reduceTokenToString,
  lGCC_tokenizeCssValue,
  limitedGetComputedCss,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(limitedGetComputedCss, () => {
  test('handles "none" value', () => {
    expect(limitedGetComputedCss('none')).toBe('none');
  });

  test('converts number strings to numbers', () => {
    expect(limitedGetComputedCss('42')).toBe(42);
    expect(limitedGetComputedCss('3.14')).toBe(3.14);
    expect(limitedGetComputedCss('-10')).toBe(-10);
  });

  test('converts numeric strings to numbers', () => {
    expect(limitedGetComputedCss('42px')).toBe(42);
    expect(limitedGetComputedCss('3.14px')).toBe(3.14);
    expect(limitedGetComputedCss('-10px')).toBe(-10);
  });

  test('processes simple CSS variables', () => {
    expect(() => {
      limitedGetComputedCss('var(--a)');
    })
      .toThrow();
    expect(limitedGetComputedCss('var(--b)')).toBe("'bString'");
  });

  test('handles nested CSS variables with fallbacks', () => {
    expect(() => {
      limitedGetComputedCss('var(--a, var(--b))');
    })
      .toThrow(); // --a resolves to 0, which isn't a string, which means we can't handle it due to CSS `content` property rules. However, we can handle --b. However, we still throw on this. We follow browsers' implementation, who considers the entire CSS `content` property invalid if any variable resolves to a number at first.
    // For examples of how browsers handle this, see: https://codepen.io/aquaticat/pen/dPPzEBX
    expect(limitedGetComputedCss('var(--unknown, var(--b))')).toBe("'bString'"); // Fallback to --b
  });

  test('handles string combinations', () => {
    expect(() => {
      limitedGetComputedCss("var(--a) 'c'");
    })
      .toThrow();
    expect(limitedGetComputedCss("'e' 'f'")).toBe("'ef'");
    expect(limitedGetComputedCss("'g' var(--b)")).toBe("'gbString'");
  });

  test('handles complex combinations', () => {
    expect(() => {
      limitedGetComputedCss("var(--a, 'c') 'd'");
    })
      .toThrow();
    expect(limitedGetComputedCss('var(--unknown, var(--b, var(--c)))')).toBe("'bString'");
  });

  test('handles quoted strings correctly', () => {
    expect(limitedGetComputedCss("'test'")).toBe("'test'");
    expect(limitedGetComputedCss('"double quotes"')).toBe('"double quotes"');
  });
});

describe(lGCC_tokenizeCssValue, () => {
  test('tokenizes a dimension value', () => {
    const tokens = lGCC_tokenizeCssValue('10px');
    expect(tokens).toEqual([
      ['dimension-token', '10px', 0, 3, { value: 10, unit: 'px', type: 'integer' }],
    ]);
  });

  test('tokenizes a string value', () => {
    const tokens = lGCC_tokenizeCssValue("'hello'");
    expect(tokens).toEqual([
      ['string-token', "'hello'", 0, 6, { value: 'hello' }],
    ]);
  });

  test('tokenizes an ident value', () => {
    const tokens = lGCC_tokenizeCssValue('none');
    expect(tokens).toEqual([
      ['ident-token', 'none', 0, 3, { value: 'none' }],
    ]);
  });

  test('tokenizes a CSS variable', () => {
    const tokens = lGCC_tokenizeCssValue('var(--foo)');
    expect(tokens).toEqual([
      ['function-token', 'var(', 0, 3, { value: 'var' }],
      ['ident-token', '--foo', 4, 8, { value: '--foo' }],
      [')-token', ')', 9, 9, undefined],
    ]);
  });

  // We don't really care about how it handles invalid input.
  /*  test('throws MalformedCssValueError for invalid CSS', {
    skip: true,
  }, () => {
    expect(() => lGCC_tokenizeCssValue('10px trailing')).toThrow();
  });*/

  test('throws error for empty string input', () => {
    expect(() => lGCC_tokenizeCssValue('')).toThrow('[] is empty');
  });

  test('trims EOF token', () => {
    const tokens = lGCC_tokenizeCssValue('auto');
    expect(tokens.some(isTokenEOF)).toBe(false);
    expect(tokens).toEqual([['ident-token', 'auto', 0, 3, { value: 'auto' }]]);
  });
});

describe(lGCC_handleSimpleToken, () => {
  test('handles number token', () => {
    const token: TokenNumber = ['number-token', '42', 0, 1, {
      value: 42,
      type: 'integer',
    }];
    expect(lGCC_handleSimpleToken(token)).toBe(42);
  });

  test('handles dimension token', () => {
    const token: TokenDimension = ['dimension-token', '10px', 0, 3, {
      value: 10,
      unit: 'px',
      type: 'integer',
    }];
    expect(lGCC_handleSimpleToken(token)).toBe(10);
  });

  test('handles string token', () => {
    const token: TokenString = ['string-token', "'hello'", 0, 6, { value: 'hello' }];
    expect(lGCC_handleSimpleToken(token)).toBe("'hello'");
  });

  test('handles "none" ident token', () => {
    const token: TokenIdent = ['ident-token', 'none', 0, 3, { value: 'none' }];
    expect(lGCC_handleSimpleToken(token)).toBe('none');
  });

  test('throws for unrecognized ident token', () => {
    const token: TokenIdent = ['ident-token', 'auto', 0, 3, { value: 'auto' }];
    expect(() => lGCC_handleSimpleToken(token)).toThrow('ident token is not none');
  });

  test('throws for unsupported token type', () => {
    const token: CSSToken = ['comment-token', '/* comment */', 0, 12, {
      value: ' comment ',
    }];
    expect(() => lGCC_handleSimpleToken(token)).toThrow(
      "isn't a number, dimension or string",
    );
  });
});

describe(lGCC_groupFunctionTokens, () => {
  test('handles empty array', () => {
    expect(lGCC_groupFunctionTokens([])).toEqual([]);
  });

  test('handles no function tokens', () => {
    const tokens: CSSToken[] = [
      ['string-token', "'hello'", 0, 6, { value: 'hello' }],
      ['whitespace-token', ' ', 6, 6, undefined],
      ['string-token', "'world'", 7, 13, { value: 'world' }],
    ];
    expect(lGCC_groupFunctionTokens(tokens)).toEqual(tokens);
  });

  test('groups a single function', () => {
    const tokens: CSSToken[] = [
      ['function-token', 'var(', 0, 3, { value: 'var' }],
      ['ident-token', '--a', 4, 6, { value: '--a' }],
      [')-token', ')', 7, 7, undefined],
    ];
    const expected: GroupedToken[] = [
      ['function-token-group', [
        ['function-token', 'var(', 0, 3, { value: 'var' }],
        ['ident-token', '--a', 4, 6, { value: '--a' }],
        [')-token', ')', 7, 7, undefined],
      ]],
    ];
    expect(lGCC_groupFunctionTokens(tokens)).toEqual(expected);
  });

  test('groups nested functions', () => {
    const tokens: CSSToken[] = [
      ['function-token', 'var(', 0, 3, { value: 'var' }],
      ['ident-token', '--a', 4, 6, { value: '--a' }],
      ['comma-token', ',', 7, 7, undefined],
      ['whitespace-token', ' ', 8, 8, undefined],
      ['function-token', 'var(', 9, 12, { value: 'var' }],
      ['ident-token', '--b', 13, 15, { value: '--b' }],
      [')-token', ')', 16, 16, undefined],
      [')-token', ')', 17, 17, undefined],
    ];
    const expected: GroupedToken[] = [
      ['function-token-group', [
        ['function-token', 'var(', 0, 3, { value: 'var' }],
        ['ident-token', '--a', 4, 6, { value: '--a' }],
        ['comma-token', ',', 7, 7, undefined],
        ['whitespace-token', ' ', 8, 8, undefined],
        ['function-token-group', [
          ['function-token', 'var(', 9, 12, { value: 'var' }],
          ['ident-token', '--b', 13, 15, { value: '--b' }],
          [')-token', ')', 16, 16, undefined],
        ]],
        [')-token', ')', 17, 17, undefined],
      ]],
    ];
    expect(lGCC_groupFunctionTokens(tokens)).toEqual(expected);
  });

  test('groups multiple top-level functions with other tokens', () => {
    const tokens: CSSToken[] = [
      ['function-token', 'var(', 0, 3, { value: 'var' }],
      ['ident-token', '--a', 4, 6, { value: '--a' }],
      [')-token', ')', 7, 7, undefined],
      ['whitespace-token', ' ', 8, 8, undefined],
      ['string-token', "'text'", 9, 14, { value: 'text' }],
      ['whitespace-token', ' ', 15, 15, undefined],
      ['function-token', 'var(', 16, 19, { value: 'var' }],
      ['ident-token', '--b', 20, 22, { value: '--b' }],
      [')-token', ')', 23, 23, undefined],
    ];
    const expected: GroupedToken[] = [
      ['function-token-group', [
        ['function-token', 'var(', 0, 3, { value: 'var' }],
        ['ident-token', '--a', 4, 6, { value: '--a' }],
        [')-token', ')', 7, 7, undefined],
      ]],
      ['whitespace-token', ' ', 8, 8, undefined],
      ['string-token', "'text'", 9, 14, { value: 'text' }],
      ['whitespace-token', ' ', 15, 15, undefined],
      ['function-token-group', [
        ['function-token', 'var(', 16, 19, { value: 'var' }],
        ['ident-token', '--b', 20, 22, { value: '--b' }],
        [')-token', ')', 23, 23, undefined],
      ]],
    ];
    expect(lGCC_groupFunctionTokens(tokens)).toEqual(expected);
  });
});

describe(lGCC_reduceTokenToString, () => {
  const stringToken: TokenString = ['string-token', "'hello'", 0, 6, { value: 'hello' }];
  const whitespaceToken: TokenWhitespace = ['whitespace-token', ' ', 0, 0, undefined];
  const varFuncToken: TokenFunction = ['function-token', 'var(', 0, 3, { value: 'var' }];
  const identBToken: TokenIdent = ['ident-token', '--b', 1, 3, { value: '--b' }];
  const closeParenToken: TokenCloseParen = [')-token', ')', 4, 4, undefined];

  test('handles string token', () => {
    expect(lGCC_reduceTokenToString('', stringToken)).toBe("'hello'");
  });

  test('handles whitespace token after non-empty acc', () => {
    expect(lGCC_reduceTokenToString("'a'", whitespaceToken)).toBe("'a' ");
  });

  test('handles whitespace token with empty acc', () => {
    expect(lGCC_reduceTokenToString('', whitespaceToken)).toBe('');
  });

  test('handles function token group (var(--b))', () => {
    const funcGroup: GroupedToken = ['function-token-group', [
      varFuncToken,
      identBToken,
      closeParenToken,
    ]];
    expect(lGCC_reduceTokenToString('', funcGroup)).toBe("'bString'");
  });

  test('throws for unrecognized single token type', () => {
    const identToken: TokenIdent = ['ident-token', 'unrecognized', 0, 11, {
      value: 'unrecognized',
    }];
    expect(() => lGCC_reduceTokenToString('', identToken)).toThrow('single cssToken');
  });
});

describe(lGCC_handleFunctionTokenGroup, () => {
  const varFuncToken: TokenFunction = ['function-token', 'var(', 0, 3, { value: 'var' }];
  const identAToken: TokenIdent = ['ident-token', '--a', 1, 3, { value: '--a' }];
  const identBToken: TokenIdent = ['ident-token', '--b', 1, 3, { value: '--b' }];
  const closeParenToken: TokenCloseParen = [')-token', ')', 4, 4, undefined];

  test('handles var() function', () => {
    const funcGroupA: GroupedToken = ['function-token-group', [
      varFuncToken,
      identAToken,
      closeParenToken,
    ]];
    expect(() => {
      lGCC_handleFunctionTokenGroup('', funcGroupA);
    })
      .toThrow();
    const funcGroupB: GroupedToken = ['function-token-group', [
      varFuncToken,
      identBToken,
      closeParenToken,
    ]];
    expect(lGCC_handleFunctionTokenGroup('', funcGroupB)).toBe("'bString'");
  });

  test('throws for unsupported function name', () => {
    const unsupportedFuncToken: TokenFunction = ['function-token', 'calc(', 0, 4, {
      value: 'calc',
    }];
    const funcGroup: GroupedToken = ['function-token-group', [
      unsupportedFuncToken,
      identAToken,
      closeParenToken,
    ]];
    expect(() => lGCC_handleFunctionTokenGroup('', funcGroup)).toThrow();
  });

  test('throws if first token in group is not a function token', () => {
    const funcGroup: GroupedToken = ['function-token-group', [
      identAToken,
      closeParenToken,
    ]];
    expect(() => lGCC_handleFunctionTokenGroup('', funcGroup)).toThrow();
  });
});

describe(lGCC_handleVarFunction, () => {
  const varFuncToken: TokenFunction = ['function-token', 'var(', 0, 3, { value: 'var' }];
  const identAToken: TokenIdent = ['ident-token', '--a', 0, 2, { value: '--a' }];
  const identBToken: TokenIdent = ['ident-token', '--b', 0, 2, { value: '--b' }];
  const unknownIdentToken: TokenIdent = ['ident-token', '--unknown', 0, 8, {
    value: '--unknown',
  }];
  const stringFallbackToken: TokenString = ['string-token', "'fallback'", 0, 9, {
    value: 'fallback',
  }];
  const commaToken: TokenComma = ['comma-token', ',', 0, 0, undefined];
  const whitespaceToken: TokenWhitespace = ['whitespace-token', ' ', 0, 0, undefined];
  const closeParenToken: TokenCloseParen = [')-token', ')', 0, 0, undefined];

  test('handles var(--b) resolving to string', () => {
    const tokens: GroupedToken[] = [varFuncToken, identBToken, closeParenToken];
    expect(lGCC_handleVarFunction('', tokens)).toBe("'bString'");
  });

  test('handles var(--unknown, "fallback")', () => {
    const tokens: GroupedToken[] = [
      varFuncToken,
      unknownIdentToken,
      commaToken,
      whitespaceToken,
      stringFallbackToken,
      closeParenToken,
    ];
    expect(lGCC_handleVarFunction('', tokens)).toBe("'fallback'");
  });

  test('handles var(--unknown, var(--b))', () => {
    const nestedVarFuncToken: TokenFunction = ['function-token', 'var(', 0, 3, {
      value: 'var',
    }];
    const nestedFuncGroup: GroupedToken = ['function-token-group', [
      nestedVarFuncToken,
      identBToken,
      closeParenToken,
    ]];
    const tokens: GroupedToken[] = [
      varFuncToken,
      unknownIdentToken,
      commaToken,
      whitespaceToken,
      nestedFuncGroup,
      closeParenToken,
    ];
    expect(lGCC_handleVarFunction('', tokens)).toBe("'bString'");
  });

  test('throws if var() has no arguments', () => {
    const tokens: GroupedToken[] = [varFuncToken, closeParenToken];
    expect(() => lGCC_handleVarFunction('', tokens)).toThrow(
      'var() function requires at least one argument',
    );
  });

  test('throws for unrecognized first argument type (e.g. number-token)', () => {
    const numberToken: TokenNumber = ['number-token', '123', 0, 2, {
      value: 123,
      type: 'integer',
    }];
    const tokens: GroupedToken[] = [varFuncToken, numberToken, closeParenToken];
    expect(() => lGCC_handleVarFunction('', tokens)).toThrow();
  });

  test('handles var(--a) resolving to number, which appendString will reject in string context', () => {
    const tokens: GroupedToken[] = [varFuncToken, identAToken, closeParenToken];
    expect(() => lGCC_handleVarFunction('', tokens)).toThrow();
  });
});

describe(lGCC_handleVarIdentifier, () => {
  const identAToken: TokenIdent = ['ident-token', '--a', 0, 2, { value: '--a' }];
  const identBToken: TokenIdent = ['ident-token', '--b', 0, 2, { value: '--b' }];
  const unknownIdentToken: TokenIdent = ['ident-token', '--unknown', 0, 8, {
    value: '--unknown',
  }];
  const stringFallbackToken: TokenString = ['string-token', "'fallback'", 0, 9, {
    value: 'fallback',
  }];
  const commaToken: TokenComma = ['comma-token', ',', 0, 0, undefined];
  const whitespaceToken: TokenWhitespace = ['whitespace-token', ' ', 0, 0, undefined];

  test('resolves ident from map (e.g. --b to "bString")', () => {
    expect(lGCC_handleVarIdentifier('', identBToken, [])).toBe("'bString'");
  });

  test('falls back for unknown ident (e.g. --unknown, "fallback")', () => {
    const args: GroupedToken[] = [
      unknownIdentToken,
      commaToken,
      whitespaceToken,
      stringFallbackToken,
    ];
    expect(lGCC_handleVarIdentifier('', unknownIdentToken, args)).toBe("'fallback'");
  });

  test('throws if no fallback for unknown variable', () => {
    const args: GroupedToken[] = [unknownIdentToken];
    expect(() => lGCC_handleVarIdentifier('', unknownIdentToken, args)).toThrow();
  });

  test('handles ident resolving to number (e.g. --a to 0), which appendString will reject', () => {
    expect(() => lGCC_handleVarIdentifier('', identAToken, [])).toThrow();
  });
});

describe(lGCC_handleVarFallback, () => {
  const stringFallbackToken: TokenString = ['string-token', "'myString'", 0, 9, {
    value: 'myString',
  }];
  const identBToken: TokenIdent = ['ident-token', '--b', 0, 2, { value: '--b' }];
  const unknownIdentToken: TokenIdent = ['ident-token', '--unknownVar', 0, 11, {
    value: '--unknownVar',
  }];
  const varFuncToken: TokenFunction = ['function-token', 'var(', 0, 3, { value: 'var' }];
  const closeParenToken: TokenCloseParen = [')-token', ')', 0, 0, undefined];

  test('handles string fallback', () => {
    expect(lGCC_handleVarFallback('', stringFallbackToken)).toBe("'myString'");
  });

  test('handles ident fallback resolving from map', () => {
    expect(lGCC_handleVarFallback('', identBToken)).toBe("'bString'");
  });

  test('handles function group fallback (var(--b))', () => {
    const funcGroupFallback: GroupedToken = ['function-token-group', [
      varFuncToken,
      identBToken,
      closeParenToken,
    ]];
    expect(lGCC_handleVarFallback('', funcGroupFallback)).toBe("'bString'");
  });

  test('throws for unrecognized ident fallback', () => {
    expect(() => lGCC_handleVarFallback('', unknownIdentToken)).toThrow();
  });

  test('throws for invalid fallback token type (e.g. number)', () => {
    const numberToken: TokenNumber = ['number-token', '123', 0, 2, {
      value: 123,
      type: 'integer',
    }];
    expect(() => lGCC_handleVarFallback('', numberToken)).toThrow();
  });
});

describe(lGCC_appendString, () => {
  test('appends to empty accumulator', () => {
    expect(lGCC_appendString('', "'quoted'")).toBe("'quoted'");
  });

  test("appends to existing single-quoted string with trailing space (e.g. 'a' + ' ' + 'b' -> 'a b')", () => {
    expect(lGCC_appendString("'first' ", "'third'")).toBe("'firstthird'");
  });

  test('throws for malformed accumulator (not empty and not ending with "\' ")', () => {
    expect(() => lGCC_appendString("'malformed", 'test')).toThrow();
    expect(() => lGCC_appendString('unquoted', 'test')).toThrow();
  });

  test('throws if acc ends with "\' " but does not start with "\'"', () => {
    expect(() => lGCC_appendString("notQuoted' ", 'test')).toThrow();
  });
});
