import type { $ as hasQuotedSyntax, } from '../../t/index.ts';

/**
 * Branded string type indicating backtick-quoted syntax.
 */
export type $ = hasQuotedSyntax & {
  __brand: {
    quotesType: '`';
  };
};
