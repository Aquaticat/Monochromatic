import type { $ as Jsonc, } from '../../t/index.ts';

/** Branded JSONC string type indicating presence of inline comments. */
export type $ = Jsonc & {
  __brand: {
    hasInlineComments: true;
  };
};
