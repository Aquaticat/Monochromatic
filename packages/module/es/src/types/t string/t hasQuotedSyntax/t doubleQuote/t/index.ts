import type { $ as hasQuotedSyntax, } from '../../t/index.ts';

export type $ = hasQuotedSyntax & {
  __brand: {
    quotesType: '"';
  };
};
