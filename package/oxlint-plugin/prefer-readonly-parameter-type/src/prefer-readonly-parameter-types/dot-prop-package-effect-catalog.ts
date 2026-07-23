/**
 * Audited dot-prop package effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * dot-prop implementation audit identity.
 *
 * Re-audited 2026-07-22 for 10.2.0: `getProperty`, `normalizePath`, and
 * `isObject` are byte-identical to the 10.1.0 audit; the rewritten
 * `parsePath` scans the immutable path string linearly with local state
 * only and calls only primitive-string helpers, so the audited member
 * still mutates nothing and invokes no argument values. The 10.2.0
 * changes to `setProperty`, `hasProperty`, `stringifyPath`, and
 * `deepKeys` fall outside the audited member.
 */
const DOT_PROP_EVIDENCE = 'dot-prop 10.2.0 commit d5d11c71a70bfb643a45d22821ed6d284240fce5 shipped index.js sha256 b4c6d5b46b25510e1a05472a76abdb113b2a120cad2f05b226f5449786a0ddb7';

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
