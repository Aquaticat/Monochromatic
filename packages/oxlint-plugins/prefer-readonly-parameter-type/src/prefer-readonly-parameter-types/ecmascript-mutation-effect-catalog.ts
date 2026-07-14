/**
 * Audited ECMAScript receiver mutation effects.
 *
 * @module
 */

import { ecma262Authority, } from './host-effect-authority.ts';
import type {
  IntrinsicEffectEntry,
  IntrinsicEffectTarget,
} from './intrinsic-effect-catalog.ts';

/**
 * Shared receiver mutation target.
 */
const RECEIVER: IntrinsicEffectTarget = { kind: 'receiver', };

/**
 * Creates ECMAScript receiver-mutating entry.
 *
 * @param ownerType - Declaring receiver type symbol.
 *
 * @param member - Declaring callable member symbol.
 *
 * @param evidence - Audited specification algorithm.
 *
 * @returns ECMAScript receiver mutation effect.
 */
function receiverEffect({
  ownerType,
  member,
  evidence,
}: {
  readonly ownerType: string;
  readonly member: string;
  readonly evidence: string;
}): IntrinsicEffectEntry {
  return {
    provenance: { kind: 'ecmascript', },
    ownerType,
    member,
    targets: [RECEIVER,],
    evidence,
    authority: ecma262Authority({ algorithm: `${ownerType}.prototype.${member}`, },),
  };
}

/**
 * ECMAScript methods that mutate receiver internal or property state.
 */
export const ECMASCRIPT_MUTATION_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...[
    'copyWithin',
    'fill',
    'pop',
    'push',
    'reverse',
    'shift',
    'sort',
    'splice',
    'unshift',
  ].map(function arrayEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      ownerType: 'Array',
      member,
      evidence: 'ECMA-262 commit 1355a23e array mutator algorithms',
    },);
  },),
  ...[
    'delete',
    'set',
  ].map(function mapEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      ownerType: 'Map',
      member,
      evidence: 'ECMA-262 commit 1355a23e Map mutation algorithms',
    },);
  },),
  receiverEffect({
    ownerType: 'Map',
    member: 'clear',
    evidence: 'ECMA-262 commit 1355a23e Map clear algorithm',
  },),
  ...[
    'add',
    'clear',
    'delete',
  ].map(function setEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      ownerType: 'Set',
      member,
      evidence: 'ECMA-262 commit 1355a23e Set mutation algorithms',
    },);
  },),
  receiverEffect({
    ownerType: 'WeakMap',
    member: 'set',
    evidence: 'ECMA-262 commit 1355a23e WeakMap set algorithm',
  },),
  receiverEffect({
    ownerType: 'WeakMap',
    member: 'delete',
    evidence: 'ECMA-262 commit 1355a23e WeakMap delete algorithm',
  },),
  receiverEffect({
    ownerType: 'WeakSet',
    member: 'add',
    evidence: 'ECMA-262 commit 1355a23e WeakSet add algorithm',
  },),
  receiverEffect({
    ownerType: 'WeakSet',
    member: 'delete',
    evidence: 'ECMA-262 commit 1355a23e WeakSet delete algorithm',
  },),
];
