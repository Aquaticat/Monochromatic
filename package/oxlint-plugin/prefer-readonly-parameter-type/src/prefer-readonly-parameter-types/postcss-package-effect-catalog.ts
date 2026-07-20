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
 *
 * Re-audited 2026-07-20 for 8.5.19: `cloneNode` moved from recursion to an
 * explicit work stack without changing its property enumeration, source
 * retention, or non-mutation of the receiver; audited member bodies in
 * `lib/node.js` are otherwise byte-identical to 8.5.16.
 */
const NODE_EVIDENCE = 'postcss 8.5.19 commit 9543b22769bef5bcd47600fbca752204c106cda8 shipped lib/node.js sha256 1cc8d56d0c77783fa7fecf702321129936efa3dc504eb4528042a103fe54770d';

/**
 * PostCSS `Container` implementation audit identity.
 *
 * Re-audited 2026-07-20 for 8.5.19: `walk` replaced recursive `each` calls
 * with an explicit stack of live per-walk index slots; it still mutates
 * receiver iterator state, still invokes the callback with receiver
 * children, and `walkAtRules` still applies RegExp filters through `test`,
 * so every recorded effect holds.
 */
const CONTAINER_EVIDENCE = 'postcss 8.5.19 commit 9543b22769bef5bcd47600fbca752204c106cda8 shipped lib/container.js sha256 e2fc6a559238ac8186ef56d13d340b7c62c04ba9551e2edc027e761eb393ddd0';

/**
 * Audited PostCSS effects used by CSS transformation packages.
 */
export const POSTCSS_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: POSTCSS_PROVENANCE,
    auditTier: 'shipped-content',
    ownerType: 'Container_',
    member: 'walkAtRules',
    targets: [{ kind: 'receiver', },],
    opaqueTargets: [{
      kind: 'argument',
      index: 0,
      callArgumentCount: 2,
    },],
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
    evidence: `${CONTAINER_EVIDENCE}; delegates to walk, updates receiver iterator state through per-walk index slots, can change a RegExp selector lastIndex, and invokes selected callback with receiver children; postcss.Container_.walkAtRules`,
  },
  {
    provenance: POSTCSS_PROVENANCE,
    auditTier: 'shipped-content',
    ownerType: 'AtRule_',
    member: 'clone',
    targets: [],
    opaqueTargets: [
      { kind: 'receiver', },
      {
        kind: 'argument',
        index: 0,
      },
    ],
    receiverValuesReachResult: true,
    evidence: `${NODE_EVIDENCE}; cloneNode observes enumerable receiver and override state through constructors, accessors, or proxy traps and retains source identity without mutating the receiver; postcss.AtRule_.clone`,
  },
  {
    provenance: POSTCSS_PROVENANCE,
    auditTier: 'shipped-content',
    ownerType: 'Node_',
    member: 'error',
    targets: [],
    opaqueTargets: [
      { kind: 'receiver', },
      {
        kind: 'argument',
        index: 1,
      },
    ],
    evidence: `${NODE_EVIDENCE}; observes receiver-reachable source and input state and option properties while constructing a CssSyntaxError; postcss.Node_.error`,
  },
  {
    provenance: POSTCSS_PROVENANCE,
    auditTier: 'shipped-content',
    ownerType: 'Node_',
    member: 'remove',
    targets: [{ kind: 'receiver', },],
    evidence: `${NODE_EVIDENCE}; remove updates parent structure and receiver parent state`,
  },
  {
    provenance: POSTCSS_PROVENANCE,
    auditTier: 'shipped-content',
    ownerType: 'Node_',
    member: 'toString',
    targets: [],
    opaqueTargets: [{ kind: 'receiver', },],
    callbacks: [{
      argumentIndex: 0,
      receiverParameterIndexes: [0,],
    },],
    invokedArgumentIndexes: [0,],
    evidence: `${NODE_EVIDENCE}; observes receiver state and invokes a supplied stringifier with the receiver; postcss.Node_.toString`,
  },
  {
    provenance: POSTCSS_PROVENANCE,
    auditTier: 'shipped-content',
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
