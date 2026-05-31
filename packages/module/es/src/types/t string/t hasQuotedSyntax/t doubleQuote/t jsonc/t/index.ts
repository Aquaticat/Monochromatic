import type { $ as DoubleQuote, } from '../../t/index.ts';

/**
 * Branded string type for JSONC (JSON with comments) content in double-quoted syntax.
 */
export type $ = DoubleQuote & {
  __brand: {
    jsonc: true;
  };
};

/**
 * Branded string type for JSONC fragments (partial JSONC content).
 */
export type FragmentStringJsonc = string & { __brand: { jsonc: 'fragment'; }; };

// TODO: Express every StringJsonc is FragmentStringJsonc
