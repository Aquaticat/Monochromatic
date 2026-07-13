/**
 * Symbol-grounded intrinsic mutation effects for bodyless platform and package APIs.
 *
 * @module
 */

import { ECMASCRIPT_EFFECTS, } from './ecmascript-effect-catalog.ts';
import { PACKAGE_EFFECTS, } from './package-effect-catalog.ts';

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
    readonly propertyNames?: readonly string[];
  };

/**
 * Callback argument whose selected parameters expose receiver-reachable values.
 *
 * @example
 * ```ts
 * const callback: IntrinsicCallbackEffect = {
 *   argumentIndex: 0,
 *   receiverParameterIndexes: [0, 2],
 * };
 * ```
 */
export type IntrinsicCallbackEffect = {
  readonly argumentIndex: number;
  readonly receiverParameterIndexes: readonly number[];
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
  readonly callbacks?: readonly IntrinsicCallbackEffect[];
  readonly requiresPrimitiveReceiverElements?: boolean;
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
 * DOM receiver effects audited against TypeScript 7 `lib.dom.d.ts` declarations.
 */
const DOM_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: { kind: 'dom', },
    ownerType: 'globalThis',
    member: 'setTimeout',
    targets: [{
      kind: 'argument',
      index: 0,
    },],
    evidence: 'HTML timers schedule supplied handler for deferred invocation without retaining delay input',
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'globalThis',
    member: 'getComputedStyle',
    targets: [],
    evidence: 'CSSOM getComputedStyle returns live computed declaration without invoking caller-owned code',
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'CanvasRenderingContext2D',
    member: 'measureText',
    targets: [],
    evidence: 'HTML Canvas measureText reads context font state and returns new TextMetrics',
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'TextEncoder',
    member: 'encode',
    targets: [],
    evidence: 'WHATWG Encoding Standard commit a985b62a TextEncoder.encode creates a new Uint8Array from primitive input',
  },
  receiverEffect({
    provenance: { kind: 'dom', },
    ownerType: 'AbortController',
    member: 'abort',
    evidence: 'TypeScript 7 lib.dom.d.ts AbortController declaration',
  },),
  {
    provenance: { kind: 'dom', },
    ownerType: 'AbortSignal',
    member: 'any',
    targets: [{
      kind: 'argument',
      index: 0,
    },],
    evidence: 'DOM commit 5796f716 AbortSignal.any stores dependent-signal relations on supplied signals',
  },
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
  {
    provenance: { kind: 'dom', },
    ownerType: 'Node',
    member: 'cloneNode',
    targets: [],
    evidence: 'DOM cloneNode creates a detached copy without changing source node',
  },
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
  ...[
    'preventDefault',
    'stopImmediatePropagation',
    'stopPropagation',
  ].map(function eventEffect(member,): IntrinsicEffectEntry {
    return receiverEffect({
      provenance: { kind: 'dom', },
      ownerType: 'Event',
      member,
      evidence: 'DOM Event cancellation and propagation-state transition methods',
    },);
  },),
  receiverEffect({
    provenance: { kind: 'dom', },
    ownerType: 'ParentNode',
    member: 'replaceChildren',
    evidence: 'DOM ParentNode.replaceChildren replaces receiver child list',
  },),
];

/**
 * Node receiver effects audited against current lockfile `@types/node` major 26 declarations.
 */
const NODE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...[
    'basename',
    'dirname',
    'extname',
    'isAbsolute',
    'join',
    'matchesGlob',
    'normalize',
    'relative',
    'resolve',
    'toNamespacedPath',
  ].map(function pathObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'node', },
      ownerType: 'node:path',
      member,
      targets: [],
      evidence: '@types/node 26 path.d.ts primitive path operations',
    };
  },),
  ...[
    'isBlockDevice',
    'isCharacterDevice',
    'isDirectory',
    'isFIFO',
    'isFile',
    'isSocket',
    'isSymbolicLink',
  ].map(function direntObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'node', },
      ownerType: 'Dirent',
      member,
      targets: [],
      evidence: '@types/node 26 fs.d.ts Dirent file-type observation declarations',
    };
  },),
  {
    provenance: { kind: 'node', },
    ownerType: 'node:url',
    member: 'fileURLToPath',
    targets: [],
    evidence: '@types/node 26 url.d.ts file URL path conversion',
  },
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
  receiverEffect({
    provenance: { kind: 'node', },
    ownerType: 'Socket',
    member: 'write',
    evidence: '@types/node 26 net.d.ts Socket write declaration',
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
