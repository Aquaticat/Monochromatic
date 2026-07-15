/**
 * Audited ECMAScript DataView effects.
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
 * Source-audited DataView integer reads.
 */
export const ECMASCRIPT_DATA_VIEW_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...[
    'getUint16',
    'getUint32',
  ].map(function dataViewObservation(member,): IntrinsicEffectEntry {
  return {
    provenance: { kind: 'ecmascript', },
    ownerType: 'DataView',
    member,
    targets: [],
    evidence: `ECMA-262 DataView.prototype.${member} reads viewed buffer bytes`,
    authority: ecma262Authority({
      algorithm: `DataView.prototype.${member}`,
    },),
  };
},),
  ...[
    'setUint16',
    'setUint32',
  ].map(function dataViewMutation(member,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'ecmascript', },
      ownerType: 'DataView',
      member,
      targets: [RECEIVER,],
      evidence: `ECMA-262 DataView.prototype.${member} writes viewed buffer bytes`,
      authority: ecma262Authority({
        algorithm: `DataView.prototype.${member}`,
      },),
    };
  },),
];
