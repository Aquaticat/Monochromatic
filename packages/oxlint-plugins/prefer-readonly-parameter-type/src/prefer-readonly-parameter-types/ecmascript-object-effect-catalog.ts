/**
 * Audited ECMAScript Object constructor effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Object constructor operations audited against ECMA-262.
 */
export const ECMASCRIPT_OBJECT_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'ObjectConstructor',
    member: 'is',
    targets: [],
    evidence: 'ECMA-262 commit 1355a23e Object.is and SameValue algorithms',
  },
  ...[
    'entries',
    'getPrototypeOf',
  ].map(function objectHookObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'ecmascript', },
      ownerType: 'ObjectConstructor',
      member,
      targets: [{
        kind: 'argument',
        index: 0,
      },],
      evidence: 'ECMA-262 commit 1355a23e Object operation can invoke caller-owned proxy or accessor hooks',
    };
  },),
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'ObjectConstructor',
    member: 'freeze',
    targets: [{
      kind: 'argument',
      index: 0,
    },],
    evidence: 'ECMA-262 commit 1355a23e Object.freeze changes supplied object property descriptors',
  },
];
