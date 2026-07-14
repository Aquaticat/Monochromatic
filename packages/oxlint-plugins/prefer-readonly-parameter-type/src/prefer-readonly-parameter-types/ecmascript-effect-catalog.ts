/**
 * Audited ECMAScript intrinsic effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';
import { ECMASCRIPT_DATE_EFFECTS, } from './ecmascript-date-effect-catalog.ts';
import { ECMASCRIPT_MUTATION_EFFECTS, } from './ecmascript-mutation-effect-catalog.ts';
import { ECMASCRIPT_OBJECT_EFFECTS, } from './ecmascript-object-effect-catalog.ts';
import { ecma262Authority, } from './host-effect-authority.ts';

/**
 * Array callback parameter receiving original array.
 */
const ARRAY_CALLBACK_ARRAY_PARAMETER_INDEX = 3;

/**
 * ECMAScript effects audited against ECMA-262 and TypeScript 7 libraries.
 */
export const ECMASCRIPT_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...[
    'at',
    'charAt',
    'charCodeAt',
    'codePointAt',
    'concat',
    'endsWith',
    'includes',
    'indexOf',
    'lastIndexOf',
    'normalize',
    'padEnd',
    'padStart',
    'repeat',
    'slice',
    'startsWith',
    'substring',
    'toLowerCase',
    'toString',
    'toUpperCase',
    'trim',
    'trimEnd',
    'trimStart',
    'valueOf',
  ].map(function stringObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'ecmascript', },
      ownerType: 'String',
      member,
      targets: [],
      evidence: 'ECMA-262 commit 1355a23e string algorithms with primitive-only inputs and outputs',
      authority: ecma262Authority({ algorithm: `String.prototype.${member}`, },),
    };
  },),
  ...[
    'Array',
    'ReadonlyArray',
  ].flatMap(function arrayOwner(ownerType,): readonly IntrinsicEffectEntry[] {
    /**
     * Array operations without callbacks or caller-visible mutation.
     */
    const observations = [
      'at',
      'entries',
      'includes',
      'indexOf',
      'keys',
      'lastIndexOf',
      'slice',
      'values',
      'with',
    ].map(function arrayObservation(member,): IntrinsicEffectEntry {
      return {
        provenance: { kind: 'ecmascript', },
        ownerType,
        member,
        targets: [],
        ...((member === 'slice') || (member === 'with'))
          ? { receiverValuesReachResult: true, }
          : {},
        evidence: 'ECMA-262 commit 1355a23e array observation and copy algorithms',
        authority: ecma262Authority({ algorithm: `Array.prototype.${member}`, },),
      };
    },);
    /**
     * Array operations safe when every reachable element is primitive.
     */
    const primitiveElementObservations = [
      'join',
      'toSorted',
    ].map(function primitiveArrayObservation(member,): IntrinsicEffectEntry {
      return {
        provenance: { kind: 'ecmascript', },
        ownerType,
        member,
        targets: [],
        requiresPrimitiveReceiverElements: true,
        evidence: 'ECMA-262 commit 1355a23e array operations with primitive-only coercion and callback inputs',
        authority: ecma262Authority({ algorithm: `Array.prototype.${member}`, },),
      };
    },);
    /**
     * Array operations whose callbacks receive receiver-reachable values.
     */
    const callbackObservations = [
      'every',
      'filter',
      'find',
      'findIndex',
      'findLast',
      'findLastIndex',
      'flatMap',
      'forEach',
      'map',
      'some',
    ].map(function arrayCallbackObservation(member,): IntrinsicEffectEntry {
      return {
        provenance: { kind: 'ecmascript', },
        ownerType,
        member,
        targets: [],
        callbacks: [{
          argumentIndex: 0,
          receiverParameterIndexes: [
            0,
            2,
          ],
        },],
        ...((member === 'filter')
          || (member === 'find')
          || (member === 'findLast'))
          ? { receiverValuesReachResult: true, }
          : {},
        evidence: 'ECMA-262 commit 1355a23e array iteration algorithms with callback effects',
        authority: ecma262Authority({ algorithm: `Array.prototype.${member}`, },),
      };
    },);
    /**
     * Array reduction whose callback receives current receiver value and array.
     */
    const reduceObservation: IntrinsicEffectEntry = {
      provenance: { kind: 'ecmascript', },
      ownerType,
      member: 'reduce',
      targets: [],
      callbacks: [{
        argumentIndex: 0,
        receiverParameterIndexes: [
          1,
          ARRAY_CALLBACK_ARRAY_PARAMETER_INDEX,
        ],
      },],
      evidence: 'ECMA-262 commit 1355a23e Array.prototype.reduce callback relation',
      authority: ecma262Authority({ algorithm: 'Array.prototype.reduce', },),
    };
    return [
      ...observations,
      ...primitiveElementObservations,
      ...callbackObservations,
      reduceObservation,
    ];
  },),
  ...[
    'Map',
    'ReadonlyMap',
    'Set',
    'ReadonlySet',
    'WeakMap',
    'WeakSet',
  ].map(function collectionObservation(ownerType,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'ecmascript', },
      ownerType,
      member: 'has',
      targets: [],
      evidence: 'ECMA-262 commit 1355a23e collection identity-membership algorithms',
      authority: ecma262Authority({ algorithm: `${ownerType.replace(
        'Readonly',
        '',
      )}.prototype.has`, },),
    };
  },),
  ...[
    'Map',
    'ReadonlyMap',
    'Set',
    'ReadonlySet',
  ].flatMap(function collectionIteratorObservations(ownerType,): readonly IntrinsicEffectEntry[] {
    return [
      'entries',
      'keys',
      'values',
    ].map(function collectionIteratorObservation(member,): IntrinsicEffectEntry {
      return {
        provenance: { kind: 'ecmascript', },
        ownerType,
        member,
        targets: [],
        evidence: 'ECMA-262 commit 1355a23e collection iterator operations',
        authority: ecma262Authority({ algorithm: `${ownerType.replace(
          'Readonly',
          '',
        )}.prototype.${member}`, },),
      };
    },);
  },),
  ...[
    'Map',
    'ReadonlyMap',
    'WeakMap',
  ].map(function mapGetObservation(ownerType,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'ecmascript', },
      ownerType,
      member: 'get',
      targets: [],
      evidence: 'ECMA-262 commit 1355a23e map value lookup algorithm',
      authority: ecma262Authority({ algorithm: `${ownerType.replace(
        'Readonly',
        '',
      )}.prototype.get`, },),
    };
  },),
  ...[
    'Map',
    'ReadonlyMap',
    'Set',
    'ReadonlySet',
  ].map(function collectionCallbackObservation(ownerType,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'ecmascript', },
      ownerType,
      member: 'forEach',
      targets: [],
      callbacks: [{
        argumentIndex: 0,
        receiverParameterIndexes: [
          0,
          1,
          2,
        ],
      },],
      evidence: 'ECMA-262 commit 1355a23e collection iteration algorithms with callback effects',
      authority: ecma262Authority({ algorithm: `${ownerType.replace(
        'Readonly',
        '',
      )}.prototype.forEach`, },),
    };
  },),
  ...ECMASCRIPT_DATE_EFFECTS,
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'ErrorConstructor',
    member: 'isError',
    targets: [],
    evidence: 'ECMA-262 commit 1355a23e Error.isError algorithm',
    authority: ecma262Authority({ algorithm: 'Error.isError', },),
  },
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'ArrayConstructor',
    member: 'isArray',
    targets: [],
    evidence: 'ECMA-262 commit 1355a23e Array.isArray and IsArray algorithms',
    authority: ecma262Authority({ algorithm: 'Array.isArray', },),
  },
  ...ECMASCRIPT_OBJECT_EFFECTS,
  ...ECMASCRIPT_MUTATION_EFFECTS,
];
