/**
 * Symbol-grounded intrinsic mutation effects for bodyless platform and package APIs.
 *
 * @module
 */

/**
 * Intrinsic declaration provenance classes.
 *
 * @example
 * ```ts
 * const provenance: IntrinsicProvenance = { kind: 'ecmascript' };
 * ```
 */
export type IntrinsicProvenance =
  | { readonly kind: 'ecmascript'; }
  | { readonly kind: 'dom'; }
  | { readonly kind: 'node'; }
  | {
    readonly kind: 'package';
    readonly packageName: string;
    readonly major: number;
  };

/**
 * One caller-observable mutation target.
 *
 * @example
 * ```ts
 * const receiver: IntrinsicEffectTarget = { kind: 'receiver' };
 * const firstArgument: IntrinsicEffectTarget = { kind: 'argument', index: 0 };
 * ```
 */
export type IntrinsicEffectTarget =
  | { readonly kind: 'receiver'; }
  | {
    readonly kind: 'argument';
    readonly index: number;
  };

/**
 * One audited callable effect keyed by owner symbol and exact declaration provenance.
 *
 * @example
 * ```ts
 * const effect: IntrinsicEffectEntry = {
 *   provenance: { kind: 'ecmascript' },
 *   ownerType: 'Map',
 *   member: 'set',
 *   targets: [{ kind: 'receiver' }],
 *   evidence: 'TypeScript lib.es2015.collection.d.ts',
 * };
 * ```
 */
export type IntrinsicEffectEntry = {
  readonly provenance: IntrinsicProvenance;
  readonly ownerType: string;
  readonly member: string;
  readonly targets: readonly IntrinsicEffectTarget[];
  readonly evidence: string;
};

/**
 * Exact semantic query assembled from resolved receiver and callable symbol.
 *
 * @example
 * ```ts
 * const query: IntrinsicEffectQuery = {
 *   provenance: { kind: 'ecmascript' },
 *   ownerType: 'Set',
 *   member: 'add',
 * };
 * ```
 */
export type IntrinsicEffectQuery = {
  readonly provenance: IntrinsicProvenance;
  readonly ownerType: string;
  readonly member: string;
};

/**
 * Sentinel returned when resolved callable has no audited intrinsic effect.
 */
export const NO_INTRINSIC_EFFECT: unique symbol = Symbol('no IntrinsicEffect entry for resolved callable',);

/**
 * Shared receiver mutation target.
 */
const RECEIVER: IntrinsicEffectTarget = { kind: 'receiver', };

/**
 * Creates receiver-mutating intrinsic entry.
 *
 * @param provenance - Exact platform or package origin.
 *
 * @param ownerType - Declaring receiver type symbol.
 *
 * @param member - Declaring callable member symbol.
 *
 * @param evidence - Audited declaration source.
 *
 * @returns intrinsic receiver effect.
 */
function receiverEffect({
  provenance,
  ownerType,
  member,
  evidence,
}: {
  readonly provenance: IntrinsicProvenance;
  readonly ownerType: string;
  readonly member: string;
  readonly evidence: string;
},): IntrinsicEffectEntry {
  return {
    provenance,
    ownerType,
    member,
    targets: [RECEIVER,],
    evidence,
  };
}

/**
 * ECMAScript receiver effects audited against TypeScript 7 standard library declarations.
 */
const ECMASCRIPT_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'ArrayConstructor',
    member: 'isArray',
    targets: [],
    evidence: 'ECMA-262 commit 1355a23e spec.html Array.isArray and IsArray algorithms',
  },
  {
    provenance: { kind: 'ecmascript', },
    ownerType: 'ObjectConstructor',
    member: 'is',
    targets: [],
    evidence: 'ECMA-262 commit 1355a23e spec.html Object.is and SameValue algorithms',
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
      provenance: { kind: 'ecmascript', },
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
      provenance: { kind: 'ecmascript', },
      ownerType: 'Map',
      member,
      evidence: 'TypeScript 7 lib.es2015.collection.d.ts Map declarations',
    },);
  },),
  receiverEffect({
    provenance: { kind: 'ecmascript', },
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
      provenance: { kind: 'ecmascript', },
      ownerType: 'Set',
      member,
      evidence: 'TypeScript 7 lib.es2015.collection.d.ts Set declarations',
    },);
  },),
  receiverEffect({
    provenance: { kind: 'ecmascript', },
    ownerType: 'WeakMap',
    member: 'set',
    evidence: 'TypeScript 7 lib.es2015.collection.d.ts WeakMap declarations',
  },),
  receiverEffect({
    provenance: { kind: 'ecmascript', },
    ownerType: 'WeakMap',
    member: 'delete',
    evidence: 'TypeScript 7 lib.es2015.collection.d.ts WeakMap declarations',
  },),
  receiverEffect({
    provenance: { kind: 'ecmascript', },
    ownerType: 'WeakSet',
    member: 'add',
    evidence: 'TypeScript 7 lib.es2015.collection.d.ts WeakSet declarations',
  },),
  receiverEffect({
    provenance: { kind: 'ecmascript', },
    ownerType: 'WeakSet',
    member: 'delete',
    evidence: 'TypeScript 7 lib.es2015.collection.d.ts WeakSet declarations',
  },),
];

/**
 * DOM receiver effects audited against TypeScript 7 `lib.dom.d.ts` declarations.
 */
const DOM_EFFECTS: readonly IntrinsicEffectEntry[] = [
  receiverEffect({
    provenance: { kind: 'dom', },
    ownerType: 'AbortController',
    member: 'abort',
    evidence: 'TypeScript 7 lib.dom.d.ts AbortController declaration',
  },),
  ...[
    'addEventListener',
    'dispatchEvent',
    'removeEventListener',
  ].map(function eventTargetEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      provenance: { kind: 'dom', },
      ownerType: 'EventTarget',
      member,
      evidence: 'TypeScript 7 lib.dom.d.ts EventTarget declaration',
    },);
  },),
  ...[
    'appendChild',
    'insertBefore',
    'removeChild',
    'replaceChild',
  ].map(function nodeEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      provenance: { kind: 'dom', },
      ownerType: 'Node',
      member,
      evidence: 'TypeScript 7 lib.dom.d.ts Node declaration',
    },);
  },),
];

/**
 * Node receiver effects audited against current lockfile `@types/node` major 26 declarations.
 */
const NODE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...[
    'addListener',
    'emit',
    'off',
    'on',
    'once',
    'prependListener',
    'prependOnceListener',
    'removeAllListeners',
    'removeListener',
  ].map(function eventEmitterEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      provenance: { kind: 'node', },
      ownerType: 'EventEmitter',
      member,
      evidence: '@types/node 26 events.d.ts EventEmitter declaration',
    },);
  },),
  ...[
    'destroy',
    'end',
    'write',
  ].map(function writableEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      provenance: { kind: 'node', },
      ownerType: 'Writable',
      member,
      evidence: '@types/node 26 stream.d.ts Writable declaration',
    },);
  },),
];

/**
 * Package effects audited by exact current-lock major.
 */
const PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...[
    'clearSourceFileCache',
    'close',
    'updateSnapshot',
  ].map(function typescriptApiEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      provenance: {
        kind: 'package',
        packageName: 'typescript',
        major: 7,
      },
      ownerType: 'API',
      member,
      evidence: 'typescript 7.0.2 dist/api/sync/api.d.ts API declaration',
    },);
  },),
  receiverEffect({
    provenance: {
      kind: 'package',
      packageName: 'typescript',
      major: 7,
    },
    ownerType: 'Snapshot',
    member: 'dispose',
    evidence: 'typescript 7.0.2 dist/api/sync/api.d.ts Snapshot declaration',
  },),
];

/**
 * Complete audited intrinsic effect catalog.
 */
export const INTRINSIC_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...ECMASCRIPT_EFFECTS,
  ...DOM_EFFECTS,
  ...NODE_EFFECTS,
  ...PACKAGE_EFFECTS,
];

/**
 * Tests exact provenance identity including package major.
 *
 * @param left - Catalog provenance.
 *
 * @param right - Resolved query provenance.
 *
 * @returns whether both describe same platform or package major.
 */
function sameProvenance({
  left,
  right,
}: {
  readonly left: IntrinsicProvenance;
  readonly right: IntrinsicProvenance;
},): boolean {
  if (left.kind !== right.kind)
    return false;
  if ((left.kind !== 'package') || (right.kind !== 'package'))
    return true;
  return (left.packageName === right.packageName)
    && (left.major === right.major);
}

/**
 * Resolves exact intrinsic mutation effect without method-name-only matching.
 *
 * @param query - Resolved provenance, owner symbol, and member symbol.
 *
 * @returns matching effect or sentinel when boundary is opaque.
 *
 * @example
 * ```ts
 * intrinsicEffect({
 *   provenance: { kind: 'ecmascript' },
 *   ownerType: 'Set',
 *   member: 'add',
 * });
 * ```
 */
export function intrinsicEffect(
  query: IntrinsicEffectQuery,
): IntrinsicEffectEntry | typeof NO_INTRINSIC_EFFECT {
  /**
   * Exact catalog entry for query when one was audited.
   */
  const matched = INTRINSIC_EFFECTS.find(function matches(entry,): boolean {
    return sameProvenance({
      left: entry.provenance,
      right: query.provenance,
    },)
      && (entry.ownerType === query.ownerType)
      && (entry.member === query.member);
  },);
  return matched ?? NO_INTRINSIC_EFFECT;
}
