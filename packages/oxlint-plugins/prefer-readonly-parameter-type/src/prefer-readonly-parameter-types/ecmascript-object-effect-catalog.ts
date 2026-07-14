/**
 * Audited ECMAScript Object constructor effects.
 *
 * @module
 */

import { ecma262Authority, } from './host-effect-authority.ts';
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
    authority: ecma262Authority({ algorithm: 'Object.is', },),
  },
  ...[
    'entries',
    'getPrototypeOf',
    'hasOwn',
    'keys',
    'values',
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
      authority: ecma262Authority({ algorithm: `Object.${member}`, },),
    };
  },),
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'ObjectConstructor',
    member: 'freeze',
    targets: [{
      kind: 'argument',
      index: 0,
      freshContainerShieldsContents: true,
    },],
    evidence: 'ECMA-262 commit 1355a23e Object.freeze changes supplied object property descriptors',
    authority: ecma262Authority({ algorithm: 'Object.freeze', },),
  },
];
