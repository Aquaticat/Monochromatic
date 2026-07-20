/**
 * Audited Lezer syntax-tree observation effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Shared `@lezer/common` implementation audit identity.
 *
 * `Tree.iterate` audited 2026-07-20 at the same version: it reads
 * `enter`, `leave`, `from`, `to`, and `mode` from its spec argument,
 * walks the receiver through a fresh cursor, and invokes the `enter`
 * and `leave` spec properties with cursor state; it mutates neither
 * the receiver tree nor the spec.
 */
const LEZER_COMMON_EVIDENCE = '@lezer/common 1.5.2 commit de5f96276a2954c249de1475e8b03f79c20d9ce4 src/tree.ts sha256 640581681d557a446609e2c8e40fd19d2ce3f0ff9ccb99ca743db1a344934d77 shipped dist/index.js sha256 dab441db7948aae93b8a210d30a0481125bcb8943b129a8c5ebec1354a029e8d';

/**
 * Source-audited Lezer tree observation effects.
 */
export const LEZER_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...[
    'getChild',
    'getChildren',
  ].map(function syntaxNodeNavigation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@lezer/common',
        major: 1,
      },
      ownerType: 'SyntaxNode',
      member,
      targets: [],
      receiverValuesReachResult: true,
      auditTier: 'shipped-content',
      evidence: LEZER_COMMON_EVIDENCE,
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: '@lezer/common',
      major: 1,
    },
    ownerType: 'Tree',
    member: 'iterate',
    targets: [],
    opaqueTargets: [{
      kind: 'argument',
      index: 0,
      traversalHookOnly: true,
    },],
    invokedArgumentProperties: [{
      argumentIndex: 0,
      propertyNames: [
        'enter',
        'leave',
      ],
    },],
    auditTier: 'shipped-content',
    evidence: `${LEZER_COMMON_EVIDENCE}; iterate reads spec traversal bounds, walks the receiver through a fresh cursor, and invokes the enter and leave spec properties with cursor state; it mutates neither receiver nor spec`,
  },
];
