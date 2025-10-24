import type { $ as DoubleQuote, } from '../../t/index.ts';

export type $ = DoubleQuote & {
  __brand: {
    jsonc: true;
  };
};

export type FragmentStringJsonc = string & { __brand: { jsonc: 'fragment'; }; };



// TODO: Express every StringJsonc is FragmentStringJsonc
