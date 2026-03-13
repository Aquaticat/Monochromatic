import type { $ as Jsonc, } from '../../t/index.ts';

/** Branded JSONC string type indicating absence of trailing commas. */
export type $ = Jsonc & {
  __brand: {
    hasTrailingCommas: false;
  };
};
