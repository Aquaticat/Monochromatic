/**
 * Audited ECMAScript TypedArray observation effects.
 *
 * @module
 */

import { ecma262Authority, } from './host-effect-authority.ts';
import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Concrete TypeScript declaration owners inheriting `%TypedArray%` algorithms.
 */
const TYPED_ARRAY_OWNERS = [
  'BigInt64Array',
  'BigUint64Array',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Uint16Array',
  'Uint32Array',
] as const;

/**
 * TypedArray methods that only inspect receiver values.
 */
const TYPED_ARRAY_OBSERVATIONS = [
  'at',
  'includes',
  'indexOf',
  'subarray',
] as const;

/**
 * TypedArray methods that inspect values through caller callbacks.
 */
const TYPED_ARRAY_CALLBACK_OBSERVATIONS = [
  'every',
  'findLastIndex',
] as const;

/**
 * Source-audited TypedArray effects accepted by semantic analysis.
 */
export const ECMASCRIPT_TYPED_ARRAY_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...TYPED_ARRAY_OWNERS.flatMap(function typedArrayOwner(ownerType,) {
    return TYPED_ARRAY_OBSERVATIONS.map(function typedArrayObservation(member,): IntrinsicEffectEntry {
      return {
        provenance: { kind: 'ecmascript', },
        ownerType,
        member,
        targets: [],
        ...(member === 'subarray' ? { receiverValuesReachResult: true, } : {}),
        evidence: `ECMA-262 %TypedArray%.prototype.${member}`,
        authority: ecma262Authority({
          algorithm: `%TypedArray%.prototype.${member}`,
        },),
      };
    },);
  },),
  ...TYPED_ARRAY_OWNERS.flatMap(function typedArrayCallbackOwner(ownerType,) {
    return TYPED_ARRAY_CALLBACK_OBSERVATIONS.map(
      function typedArrayCallbackObservation(member,): IntrinsicEffectEntry {
        return {
          provenance: { kind: 'ecmascript', },
          ownerType,
          member,
          targets: [],
          opaqueTargets: [{
            kind: 'argument',
            index: 1,
          },],
          callbacks: [{
            argumentIndex: 0,
            receiverParameterIndexes: [
              0,
              2,
            ],
          },],
          evidence: `ECMA-262 %TypedArray%.prototype.${member}`,
          authority: ecma262Authority({
            algorithm: `%TypedArray%.prototype.${member}`,
          },),
        };
      },
    );
  },),
];
