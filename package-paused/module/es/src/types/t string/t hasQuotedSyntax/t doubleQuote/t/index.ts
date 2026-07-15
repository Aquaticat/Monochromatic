import type { $ as hasQuotedSyntax, } from '../../t/index.ts';

/**
 * Branded string type indicating double-quoted syntax.
 */
export type $ = hasQuotedSyntax & {
  __brand: {
    quotesType: '"';
  };
};
