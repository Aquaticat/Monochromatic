import type { $ as Jsonc, } from '../../t/index.ts';

/** Branded JSONC string type indicating absence of block comments. */
export type $ = Jsonc & {
  __brand: {
    hasBlockComments: false;
  };
};
