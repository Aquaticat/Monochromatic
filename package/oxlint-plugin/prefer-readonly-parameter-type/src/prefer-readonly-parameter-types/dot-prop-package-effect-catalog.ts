/**
 * Audited dot-prop package effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * dot-prop implementation audit identity.
 *
 * Audited 2026-07-20 for 10.1.0: `getProperty` validates the object and
 * path shapes, normalizes the path by string parsing or per-element type
 * checks, and follows chained property reads down the object argument.
 */
const DOT_PROP_EVIDENCE = 'dot-prop 10.1.0 commit 65b25bad588a3213546e3bc448f94b11a9e417e2 shipped index.js sha256 3b0376bd3942b76ddfb6d8acc16968fb834d7a577a67b22ac37814b4ee05b7be';

/**
 * Audited effects for dot-prop path-query calls.
 */
export const DOT_PROP_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: {
      kind: 'package',
      packageName: 'dot-prop',
      major: 10,
    },
    ownerType: 'globalThis',
    member: 'getProperty',
    targets: [],
    opaqueTargets: [
      {
        kind: 'argument',
        index: 0,
        traversalHookOnly: true,
      },
      {
        kind: 'argument',
        index: 1,
        traversalHookOnly: true,
      },
    ],
    auditTier: 'shipped-content',
    evidence: `${DOT_PROP_EVIDENCE}; getProperty follows chained property reads on the object argument and reads path elements, where only accessor or proxy traps are caller-observable; it mutates nothing and invokes no argument values`,
  },
];
