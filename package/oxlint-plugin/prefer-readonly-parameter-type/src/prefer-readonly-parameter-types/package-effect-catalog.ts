/**
 * Exact package-owned intrinsic effects.
 *
 * @module
 */

import { DOT_PROP_PACKAGE_EFFECTS, } from './dot-prop-package-effect-catalog.ts';
import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';
import { LEZER_PACKAGE_EFFECTS, } from './lezer-package-effect-catalog.ts';
import { NANO_SPAWN_PACKAGE_EFFECTS, } from './nano-spawn-package-effect-catalog.ts';
import { receiverEffect, } from './package-receiver-effect.ts';
import { PI_PACKAGE_EFFECTS, } from './pi-package-effect-catalog.ts';
import { POSTCSS_PACKAGE_EFFECTS, } from './postcss-package-effect-catalog.ts';
import { TURSO_PACKAGE_EFFECTS, } from './turso-package-effect-catalog.ts';
import { TYPESCRIPT_PACKAGE_EFFECTS, } from './typescript-package-effect-catalog.ts';

/**
 * Package effects audited by exact current-lock major.
 *
 * Optique entries were removed 2026-07-20: no repository code calls the
 * audited `parseSync`/`runParserSync` members (live consumers call
 * `runSync` from `@optique/run`, whose shipped implementation reaches
 * `runParser`/`runWith`/`runWithSync` instead), and the repository is
 * migrating off Optique entirely.
 */
export const PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...DOT_PROP_PACKAGE_EFFECTS,
  ...LEZER_PACKAGE_EFFECTS,
  ...NANO_SPAWN_PACKAGE_EFFECTS,
  ...PI_PACKAGE_EFFECTS,
  ...POSTCSS_PACKAGE_EFFECTS,
  ...TURSO_PACKAGE_EFFECTS,
  ...TYPESCRIPT_PACKAGE_EFFECTS,
  receiverEffect({
    provenance: {
      kind: 'package',
      packageName: '@oxlint/plugins',
      major: 1,
    },
    ownerType: 'Context',
    member: 'report',
    auditTier: 'api-contract',
    evidence: '@oxlint/plugins Context report diagnostic emission',
  },),
  ...[
    'add',
    'ignores',
    'test',
  ].map(function ignoreMatcherMutation(member,): IntrinsicEffectEntry {
    return receiverEffect({
      provenance: {
        kind: 'package',
        packageName: 'ignore',
        major: 7,
      },
      ownerType: 'Ignore',
      member,
      auditTier: 'api-contract',
      evidence: 'ignore matcher implementation updates rules or result caches',
    },);
  },),
  ...[
    'getAllComments',
    'getCommentsBefore',
    'getCommentsInside',
    'getDeclaredVariables',
    'getFirstToken',
    'getIndexFromLoc',
    'getLastToken',
    'getLocFromIndex',
    'getScope',
    'getText',
    'getTokenAfter',
    'getTokenBefore',
    'getTokensBetween',
    'insertTextAfter',
    'insertTextAfterRange',
    'insertTextBefore',
    'insertTextBeforeRange',
    'replaceText',
    'replaceTextRange',
  ].map(function oxlintObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@oxlint/plugins',
        major: 1,
      },
      ownerType: '__type',
      member,
      targets: [],
      auditTier: 'api-contract',
      evidence: '@oxlint/plugins index.d.ts source and fixer descriptor operations',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: 'toml-eslint-parser',
      major: 1,
    },
    ownerType: 'globalThis',
    member: 'getStaticTOMLValue',
    targets: [{
      kind: 'argument',
      index: 0,
    },],
    auditTier: 'api-contract',
    evidence: 'toml-eslint-parser source reads parser AST fields and can invoke caller-owned hooks',
  },
];
