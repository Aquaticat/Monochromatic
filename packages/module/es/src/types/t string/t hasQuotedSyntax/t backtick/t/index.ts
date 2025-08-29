import type { $ as hasQuotedSyntax, } from '../../type/index.ts';

export type $ = hasQuotedSyntax & {
  __brand: {
    quotesType: '`';
  };
};
