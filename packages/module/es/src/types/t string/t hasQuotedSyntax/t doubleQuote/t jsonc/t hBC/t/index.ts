import type { $ as Jsonc, } from '../../t/index.ts';

/**
 * Branded JSONC string type indicating presence of block comments.
 */
export type $ = Jsonc & {
  __brand: {
    hasBlockComments: true;
  };
};
