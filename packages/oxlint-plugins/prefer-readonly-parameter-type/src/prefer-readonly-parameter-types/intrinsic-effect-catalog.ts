/**
 * Symbol-grounded intrinsic mutation effects for bodyless platform and package APIs.
 *
 * @module
 */

import { BROWSER_HOST_EFFECTS, } from './browser-host-effect-catalog.ts';
import { ECMASCRIPT_DATA_VIEW_EFFECTS, } from './ecmascript-data-view-effect-catalog.ts';
import { ECMASCRIPT_EFFECTS, } from './ecmascript-effect-catalog.ts';
import { ECMASCRIPT_TYPED_ARRAY_EFFECTS, } from './ecmascript-typed-array-effect-catalog.ts';
import {
  hostEffectAuthorityAvailable,
  type HostEffectAuthority,
} from './host-effect-authority.ts';
import { NODE_EFFECTS, } from './node-effect-catalog.ts';
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
  | {
    readonly kind: 'node';
    readonly declarationMajor: number;
  }
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
export type IntrinsicEffectTarget = (
  | { readonly kind: 'receiver'; }
  | {
    readonly kind: 'argument';
    readonly index: number;
    readonly propertyNames?: readonly string[];
    readonly freshContainerShieldsContents?: boolean;
  }
  | {
    readonly kind: 'arguments-from';
    readonly startIndex: number;
    readonly propertyNames?: readonly string[];
    readonly freshContainerShieldsContents?: boolean;
  }
) & {
  /**
   * Exact call arity selecting an overloaded target position.
   */
  readonly callArgumentCount?: number;
  /**
   * Semantic type condition selecting overloaded target behavior.
   */
  readonly typeCondition?: IntrinsicTypeCondition;
};

/**
 * Semantic call-argument type conditions for overload-sensitive effects.
 *
 * @example
 * ```ts
 * const condition: IntrinsicTypeCondition = {
 *   kind: 'definitely-owner',
 *   ownerName: 'Uint8Array',
 * };
 * ```
 */
export type IntrinsicTypeCondition =
  | { readonly kind: 'may-be-callable'; }
  | { readonly kind: 'not-definitely-string'; }
  | {
    readonly kind: 'definitely-owner';
    readonly ownerName: string;
  };

/**
 * One call argument required to satisfy semantic type condition.
 *
 * @example
 * ```ts
 * const condition: IntrinsicArgumentTypeCondition = {
 *   argumentIndex: 0,
 *   condition: { kind: 'definitely-owner', ownerName: 'Uint8Array' },
 * };
 * ```
 */
export type IntrinsicArgumentTypeCondition = {
  readonly argumentIndex: number;
  readonly condition: IntrinsicTypeCondition;
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
  /**
   * Exact call arity selecting an overloaded callback position.
   */
  readonly callArgumentCount?: number;
};

/**
 * Callback argument invoked with a variadic suffix of call arguments.
 *
 * @example
 * ```ts
 * const effect: IntrinsicForwardedCallbackEffect = {
 *   callbackArgumentIndex: 0,
 *   sourceArgumentStartIndex: 2,
 * };
 * ```
 */
export type IntrinsicForwardedCallbackEffect = {
  readonly callbackArgumentIndex: number;
  readonly sourceArgumentStartIndex: number;
};

/**
 * Callable properties invoked from one object argument.
 *
 * @example
 * ```ts
 * const effect: IntrinsicArgumentPropertyInvocation = {
 *   argumentIndex: 0,
 *   propertyNames: ['style'],
 * };
 * ```
 */
export type IntrinsicArgumentPropertyInvocation = {
  readonly argumentIndex: number;
  readonly propertyNames: readonly string[];
  /**
   * Semantic property-type condition selecting invocation behavior.
   */
  readonly typeCondition?: IntrinsicTypeCondition;
};

/**
 * Callable argument invoked at one optionally arity-qualified position.
 *
 * @example
 * ```ts
 * const effect: IntrinsicInvokedArgumentEffect = {
 *   argumentIndex: 1,
 *   callArgumentCount: 2,
 * };
 * ```
 */
export type IntrinsicInvokedArgumentEffect = {
  readonly argumentIndex: number;
  readonly callArgumentCount?: number;
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
 *   evidence: 'ECMA-262 Map.prototype.set algorithm',
 *   authority: {
 *     kind: 'standard-algorithm',
 *     standard: 'ECMA-262',
 *     revision: '1355a23e',
 *   },
 * };
 * ```
 */
export type IntrinsicEffectEntry = {
  readonly provenance: IntrinsicProvenance;
  readonly ownerType: string;
  readonly member: string;
  readonly targets: readonly IntrinsicEffectTarget[];
  readonly argumentTypeConditions?: readonly IntrinsicArgumentTypeCondition[];
  readonly callbacks?: readonly IntrinsicCallbackEffect[];
  readonly forwardedCallbacks?: readonly IntrinsicForwardedCallbackEffect[];
  readonly invokedArgumentIndexes?: readonly number[];
  readonly invokedArguments?: readonly IntrinsicInvokedArgumentEffect[];
  readonly invokedArgumentProperties?: readonly IntrinsicArgumentPropertyInvocation[];
  readonly opaqueTargets?: readonly IntrinsicEffectTarget[];
  /**
   * Comparator argument that must be definitely callable to avoid opaque receiver coercion.
   */
  readonly opaqueReceiverUnlessCallableArgumentOrPrimitiveElements?: number;
  readonly requiresPrimitiveReceiverElements?: boolean;
  /**
   * Whether call result retains values reachable from receiver.
   */
  readonly receiverValuesReachResult?: boolean;
  readonly evidence: string;
  readonly authority?: HostEffectAuthority;
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
 * Complete audited intrinsic effect catalog.
 */
export const INTRINSIC_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...ECMASCRIPT_DATA_VIEW_EFFECTS,
  ...ECMASCRIPT_EFFECTS,
  ...ECMASCRIPT_TYPED_ARRAY_EFFECTS,
  ...BROWSER_HOST_EFFECTS,
  ...NODE_EFFECTS,
  ...PACKAGE_EFFECTS,
];

/**
 * Audited effects indexed by owner and member before exact provenance checks.
 */
const INTRINSIC_EFFECTS_BY_OWNER_MEMBER: ReadonlyMap<
  string,
  ReadonlyMap<string, readonly IntrinsicEffectEntry[]>
> = INTRINSIC_EFFECTS.reduce(function indexIntrinsicEffect(
  byOwner: Map<string, Map<string, readonly IntrinsicEffectEntry[]>>,
  entry: IntrinsicEffectEntry,
): Map<string, Map<string, readonly IntrinsicEffectEntry[]>> {
  /**
   * Existing or newly allocated member index for owner.
   */
  const byMember = byOwner.get(entry.ownerType,)
    ?? new Map<string, readonly IntrinsicEffectEntry[]>();
  /**
   * Provenance-qualified entries sharing owner and member.
   */
  const entries = byMember.get(entry.member,)
    ?? [];
  byMember.set(
    entry.member,
    [
      ...entries,
      entry,
    ],
  );
  byOwner.set(
    entry.ownerType,
    byMember,
  );
  return byOwner;
}, new Map<string, Map<string, readonly IntrinsicEffectEntry[]>>(),);

/**
 * Tests exact provenance identity including package and Node declaration majors.
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
}): boolean {
  if (left.kind !== right.kind)
    return false;
  if ((left.kind === 'node') && (right.kind === 'node'))
    return left.declarationMajor === right.declarationMajor;
  if ((left.kind === 'package') && (right.kind === 'package')) {
    return (left.packageName === right.packageName)
      && (left.major === right.major);
  }
  return true;
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
  const matched = INTRINSIC_EFFECTS_BY_OWNER_MEMBER
    .get(query.ownerType,)
    ?.get(query.member,)
    ?.find(function matchesProvenance(entry,): boolean {
      return sameProvenance({
        left: entry.provenance,
        right: query.provenance,
      },);
    },);
  if (matched === undefined)
    return NO_INTRINSIC_EFFECT;
  /**
   * Matched declaration provenance.
   */
  const { provenance, } = matched;
  /**
   * Host authority required outside packages.
   */
  const { authority, } = matched;
  if (provenance.kind === 'package')
    return matched;
  if (authority === undefined)
    return NO_INTRINSIC_EFFECT;
  if (!hostEffectAuthorityAvailable(authority,))
    return NO_INTRINSIC_EFFECT;
  return matched;
}
