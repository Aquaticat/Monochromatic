/**
 * Audited ECMAScript Date observation effects.
 *
 * @module
 */

import { ecma262Authority, } from './host-effect-authority.ts';
import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Date methods that read internal slots without mutating caller-owned state.
 */
export const ECMASCRIPT_DATE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  'getDate',
  'getDay',
  'getFullYear',
  'getHours',
  'getMilliseconds',
  'getMinutes',
  'getMonth',
  'getSeconds',
  'getTime',
  'getTimezoneOffset',
  'getUTCDate',
  'getUTCDay',
  'getUTCFullYear',
  'getUTCHours',
  'getUTCMilliseconds',
  'getUTCMinutes',
  'getUTCMonth',
  'getUTCSeconds',
  'toISOString',
].map(function dateObservation(member,): IntrinsicEffectEntry {
  return {
    provenance: { kind: 'ecmascript', },
    ownerType: 'Date',
    member,
    targets: [],
    evidence: 'ECMA-262 commit 1355a23e Date internal-slot observation algorithms',
    authority: ecma262Authority({ algorithm: `Date.prototype.${member}`, },),
  };
},);
