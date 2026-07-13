/**
 * Audited ECMAScript intrinsic effects.
 *
 * @module
 */

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
 * @param evidence - Audited declaration source.
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
  };
}

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
    ].map(function arrayObservation(member,): IntrinsicEffectEntry {
      return {
        provenance: { kind: 'ecmascript', },
        ownerType,
        member,
        targets: [],
        evidence: 'ECMA-262 commit 1355a23e array observation and copy algorithms',
      };
    },);
    /**
     * Array operations safe when every reachable element is primitive.
     */
    const primitiveElementObservations = [
      'join',
    ].map(function primitiveArrayObservation(member,): IntrinsicEffectEntry {
      return {
        provenance: { kind: 'ecmascript', },
        ownerType,
        member,
        targets: [],
        requiresPrimitiveReceiverElements: true,
        evidence: 'ECMA-262 commit 1355a23e array stringification with primitive elements',
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
        evidence: 'ECMA-262 commit 1355a23e array iteration algorithms with callback effects',
      };
    },);
    return [
      ...observations,
      ...primitiveElementObservations,
      ...callbackObservations,
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
      };
    },);
  },),
  ...[
    'Map',
    'ReadonlyMap',
  ].map(function mapGetObservation(ownerType,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'ecmascript', },
      ownerType,
      member: 'get',
      targets: [],
      evidence: 'ECMA-262 commit 1355a23e map value lookup algorithm',
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
    };
  },),
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'ErrorConstructor',
    member: 'isError',
    targets: [],
    evidence: 'ECMA-262 commit 1355a23e Error.isError algorithm',
  },
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'ArrayConstructor',
    member: 'isArray',
    targets: [],
    evidence: 'ECMA-262 commit 1355a23e Array.isArray and IsArray algorithms',
  },
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'ObjectConstructor',
    member: 'is',
    targets: [],
    evidence: 'ECMA-262 commit 1355a23e Object.is and SameValue algorithms',
  },
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
      evidence: 'TypeScript 7 lib.es5.d.ts Array declarations',
    },);
  },),
  ...[
    'delete',
    'set',
  ].map(function mapEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      ownerType: 'Map',
      member,
      evidence: 'TypeScript 7 lib.es2015.collection.d.ts Map declarations',
    },);
  },),
  receiverEffect({
    ownerType: 'Map',
    member: 'clear',
    evidence: 'TypeScript 7 lib.es2015.collection.d.ts Map declarations',
  },),
  ...[
    'add',
    'clear',
    'delete',
  ].map(function setEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      ownerType: 'Set',
      member,
      evidence: 'TypeScript 7 lib.es2015.collection.d.ts Set declarations',
    },);
  },),
  receiverEffect({
    ownerType: 'WeakMap',
    member: 'set',
    evidence: 'TypeScript 7 lib.es2015.collection.d.ts WeakMap declarations',
  },),
  receiverEffect({
    ownerType: 'WeakMap',
    member: 'delete',
    evidence: 'TypeScript 7 lib.es2015.collection.d.ts WeakMap declarations',
  },),
  receiverEffect({
    ownerType: 'WeakSet',
    member: 'add',
    evidence: 'TypeScript 7 lib.es2015.collection.d.ts WeakSet declarations',
  },),
  receiverEffect({
    ownerType: 'WeakSet',
    member: 'delete',
    evidence: 'TypeScript 7 lib.es2015.collection.d.ts WeakSet declarations',
  },),
];
