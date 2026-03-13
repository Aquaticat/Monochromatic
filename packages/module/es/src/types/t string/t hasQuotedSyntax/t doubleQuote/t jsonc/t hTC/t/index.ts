import type { $ as Jsonc, } from '../../t/index.ts';

/** Branded JSONC string type indicating presence of trailing commas. */
export type $ = Jsonc & {
  __brand: {
    hasTrailingCommas: true;
  };
};
