/**
 * Audited PostCSS package effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Exact PostCSS package provenance.
 */
const POSTCSS_PROVENANCE = {
  kind: 'package',
  packageName: 'postcss',
  major: 8,
} as const;

/**
 * PostCSS `Node` implementation audit identity.
 */
const NODE_EVIDENCE = 'postcss 8.5.16 commit 92ccc93ff15bd193491d67fad9763e62d489dfad lib/node.js sha256 52c8d992e881f0d40d3dc4610039d3cc19b1dfdf0fc32aef8923b5537d161eae';

/**
 * PostCSS `Container` implementation audit identity.
 */
const CONTAINER_EVIDENCE = 'postcss 8.5.16 commit 92ccc93ff15bd193491d67fad9763e62d489dfad lib/container.js sha256 0f8aaa013a910e142be706c3d6f54a3ce04751a08df3f17ed3a61bb91f863c39';

/**
 * Audited PostCSS effects used by CSS transformation packages.
 */
export const POSTCSS_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: POSTCSS_PROVENANCE,
    ownerType: 'Container_',
    member: 'walkAtRules',
    targets: [
      { kind: 'receiver', },
      {
        kind: 'argument',
        index: 0,
        callArgumentCount: 2,
      },
    ],
    callbacks: [
      {
        argumentIndex: 0,
        receiverParameterIndexes: [0,],
        callArgumentCount: 1,
      },
      {
        argumentIndex: 1,
        receiverParameterIndexes: [0,],
        callArgumentCount: 2,
      },
    ],
    invokedArguments: [
      {
        argumentIndex: 0,
        callArgumentCount: 1,
      },
      {
        argumentIndex: 1,
        callArgumentCount: 2,
      },
    ],
    evidence: `${CONTAINER_EVIDENCE}; walkAtRules delegates to walk and each, updates iterator state, and invokes selected callback with receiver children`,
  },
  {
    provenance: POSTCSS_PROVENANCE,
    ownerType: 'AtRule_',
    member: 'clone',
    targets: [],
    opaqueTargets: [
      { kind: 'receiver', },
      { kind: 'argument', index: 0, },
    ],
    receiverValuesReachResult: true,
    evidence: `${NODE_EVIDENCE}; cloneNode observes enumerable receiver and override state through constructors, accessors, or proxy traps and retains source identity without mutating the receiver`,
  },
  {
    provenance: POSTCSS_PROVENANCE,
    ownerType: 'Node_',
    member: 'error',
    targets: [],
    opaqueTargets: [
      { kind: 'receiver', },
      { kind: 'argument', index: 1, },
    ],
    evidence: `${NODE_EVIDENCE}; error observes receiver-reachable source and input state and option properties while constructing a CssSyntaxError`,
  },
  {
    provenance: POSTCSS_PROVENANCE,
    ownerType: 'Node_',
    member: 'remove',
    targets: [{ kind: 'receiver', },],
    evidence: `${NODE_EVIDENCE}; remove updates parent structure and receiver parent state`,
  },
  {
    provenance: POSTCSS_PROVENANCE,
    ownerType: 'Node_',
    member: 'toString',
    targets: [],
    opaqueTargets: [{ kind: 'receiver', },],
    callbacks: [{
      argumentIndex: 0,
      receiverParameterIndexes: [0,],
    },],
    invokedArgumentIndexes: [0,],
    evidence: `${NODE_EVIDENCE}; toString observes receiver state and invokes a supplied stringifier with the receiver`,
  },
  {
    provenance: POSTCSS_PROVENANCE,
    ownerType: 'Node_',
    member: 'replaceWith',
    targets: [
      { kind: 'receiver', },
      {
        kind: 'arguments-from',
        startIndex: 0,
      },
    ],
    evidence: `${NODE_EVIDENCE}; replaceWith updates receiver parent structure and adopts supplied nodes through insertBefore or insertAfter`,
  },
];
