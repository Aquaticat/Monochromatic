import type { $ as hasQuotedSyntax, } from '../../t/index.ts';

/**
 * Branded string type indicating single-quoted syntax.
 */
export type $ = hasQuotedSyntax & {
  __brand: {
    quotesType: "'";
  };
};
