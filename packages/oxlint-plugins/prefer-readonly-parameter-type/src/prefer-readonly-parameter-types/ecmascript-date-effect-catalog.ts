/**
 * Audited ECMAScript Date observation effects.
 *
 * @module
 */

import {
  ecma262Authority,
  ecma402Authority,
} from './host-effect-authority.ts';
import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Date methods that read internal slots without mutating caller-owned state.
 */
export const ECMASCRIPT_DATE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...([
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
  ] as const).map(function dateObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'ecmascript', },
      ownerType: 'Date',
      member,
      targets: [],
      evidence: 'ECMA-262 commit 1355a23e Date internal-slot observation algorithms',
      authority: ecma262Authority({ algorithm: `Date.prototype.${member}`, },),
    };
  },),
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'Date',
    member: 'toLocaleString',
    targets: [],
    opaqueTargets: [
      {
        kind: 'argument',
        index: 0,
      },
      {
        kind: 'argument',
        index: 1,
      },
    ],
    evidence: 'ECMA-402 commit 5273ed81 Date.toLocaleString reads DateValue and delegates locales and options to CreateDateTimeFormat',
    authority: ecma402Authority({
      algorithm: 'sha256:0b2ffb5786b37094c13c77a2d7ee13e439522fe457a95fe44b4b7ef5fa6ad659',
    },),
  },
];
