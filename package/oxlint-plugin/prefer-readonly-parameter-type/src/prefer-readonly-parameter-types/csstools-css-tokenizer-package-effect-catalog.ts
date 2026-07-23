/**
 * Audited `@csstools/css-tokenizer` package effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Exact `@csstools/css-tokenizer` package provenance.
 */
const CSS_TOKENIZER_PROVENANCE = {
  kind: 'package',
  packageName: '@csstools/css-tokenizer',
  major: 4,
} as const;

/**
 * `@csstools/css-tokenizer` implementation audit identity.
 *
 * Audited 2026-07-22 for 4.0.0: every `isToken*` guard is the one-line pure
 * predicate `(e) => !!e && e[0] === TokenType.X`, a truthiness check plus a
 * read of the token tuple's type discriminant; no guard writes, retains, or
 * invokes anything.
 */
const CSS_TOKENIZER_EVIDENCE = '@csstools/css-tokenizer 4.0.0 shipped dist/index.mjs sha256 b38417b79d3007aef6be6d5987760afa7a325eb00a1996aaa08f1c59d845db01';

/**
 * Token-type guard members audited as pure discriminant reads.
 */
const GUARD_MEMBERS = [
  'isToken',
  'isTokenAtKeyword',
  'isTokenBadString',
  'isTokenBadURL',
  'isTokenCDC',
  'isTokenCDO',
  'isTokenCloseCurly',
  'isTokenCloseParen',
  'isTokenCloseSquare',
  'isTokenColon',
  'isTokenComma',
  'isTokenComment',
  'isTokenDelim',
  'isTokenDimension',
  'isTokenEOF',
  'isTokenFunction',
  'isTokenHash',
  'isTokenIdent',
  'isTokenNumber',
  'isTokenNumeric',
  'isTokenOpenCurly',
  'isTokenOpenParen',
  'isTokenOpenSquare',
  'isTokenPercentage',
  'isTokenSemicolon',
  'isTokenString',
  'isTokenUnicodeRange',
  'isTokenURL',
  'isTokenWhitespace',
  'isTokenWhiteSpaceOrComment',
] as const;

/**
 * Audited `@csstools/css-tokenizer` effects used by CSS parsing packages.
 */
export const CSS_TOKENIZER_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = GUARD_MEMBERS
  .map(
    /**
     * Builds one pure-guard entry.
     *
     * @param member - Guard export name.
     *
     * @returns Effect entry recording that the guard changes nothing.
     */
    function guardEntry(member,): IntrinsicEffectEntry {
      return {
        provenance: CSS_TOKENIZER_PROVENANCE,
        auditTier: 'shipped-content',
        ownerType: 'globalThis',
        member,
        targets: [],
        evidence: `${CSS_TOKENIZER_EVIDENCE}; ${member} is a pure token-type discriminant read`,
      };
    },
  );
