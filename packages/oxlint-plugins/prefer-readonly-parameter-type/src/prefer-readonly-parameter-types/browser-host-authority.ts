/**
 * Browser standards source authority identities.
 *
 * @module
 */

import type {
  HostEffectAuthority,
  StandardEffectAuthority,
} from './host-effect-authority.ts';

/**
 * One pinned browser standard authoring source.
 */
export type BrowserStandardSource = {
  readonly standard: string;
  readonly revision: string;
  readonly sourceDigest: string;
};

/**
 * Audited standards revisions for browser-host algorithms.
 */
export const WEB_SOURCES: Readonly<Record<
  'cssom' | 'cssomView' | 'dom' | 'encoding' | 'fetch' | 'fileApi' | 'html',
  BrowserStandardSource
>> = {
  cssom: {
    standard: 'CSSOM',
    revision: '0222af95924db44c8e10d993b614596cd6f35cbb',
    sourceDigest: '5a0b6a2f116ad450c22a202241c997c4a64d9c13bb9e011c5a0bcc4345f89668',
  },
  cssomView: {
    standard: 'CSSOM View',
    revision: '0222af95924db44c8e10d993b614596cd6f35cbb',
    sourceDigest: '462ce76726254774db4d7ebb35b620bab95af445872af234391a0342ac043c19',
  },
  dom: {
    standard: 'DOM',
    revision: '5796f716c857f0a563d11d32e0ca6b49232191be',
    sourceDigest: 'f977c54983bdd54104e3860d5ef62f973ec9907ea8226858f5270fea502ebe52',
  },
  encoding: {
    standard: 'Encoding',
    revision: 'a985b62a9b45c17da3e17a9f0a0b4e30c34c4a8a',
    sourceDigest: '90bd4f43b965186afd34661d5ad0f45d35f9a178da895dcc9f08f610cc031c55',
  },
  fetch: {
    standard: 'Fetch',
    revision: '586cd2a44c2a865b37c166dc0740f3fb8bb220d6',
    sourceDigest: '2099e5170175b36f61ab3234849c429702552d3587d50b87149269336977eb98',
  },
  fileApi: {
    standard: 'File API',
    revision: 'cd1d1da9a5375af0622af4b36e76c6e6bd9d130b',
    sourceDigest: '64953b2ad6f187e21ad316d4a5f40b050023b75f4ff4d7e18ccf763558eb99ab',
  },
  html: {
    standard: 'HTML',
    revision: '255188e5a85208fd825650b8e5f9dc17505abc53',
    sourceDigest: 'be8381b4792c5180baa78ec6a6846ea714b7420d90754e2ee53c69af2c888e3a',
  },
};

/**
 * Creates exact browser standard authority.
 *
 * @param source - Pinned standard authoring source.
 *
 * @param algorithm - Exact operation or method steps audited in source.
 *
 * @returns standards authority accepted by host gate.
 *
 * @example
 * ```ts
 * webAuthority({ source: WEB_SOURCES.dom, algorithm: 'AbortSignal/any(signals)' });
 * ```
 */
export function webAuthority({
  source,
  algorithm,
}: {
  readonly source: BrowserStandardSource;
  readonly algorithm: string;
}): StandardEffectAuthority {
  return {
    kind: 'standard-algorithm',
    ...source,
    algorithm,
  } satisfies HostEffectAuthority;
}
