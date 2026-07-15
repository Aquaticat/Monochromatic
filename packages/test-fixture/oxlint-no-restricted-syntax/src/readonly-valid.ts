import {
  spawn,
  type SpawnOptions,
} from 'node:child_process';

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  opaqueExternalMutation,
  opaqueExternalValues,
} from './readonly-external.fixture.js';

/**
 * Reads honestly readonly data.
 *
 * @param state - Immutable caller state.
 */
export function readReadonlyState(state: { readonly value: string; },): string {
  return state.value;
}

/**
 * Ignores broad object capability without pretending `Readonly<object>` constrains it.
 *
 * @param value - Broad capability with unknown properties or traps.
 */
export function ignoreBroadObjectCapability(value: object,): void {
  void value;
}

/**
 * Retains direct callable type when callback is not invoked.
 *
 * @param callback - Caller-defined behavior left untouched.
 */
export function ignoreCallableCapability(callback: () => void,): void {
  void callback;
}

/**
 * Retains direct constructable type when constructor is not invoked.
 *
 * @param constructorValue - Caller-defined constructor left untouched.
 */
export function ignoreConstructableCapability(
  constructorValue: abstract new() => object,
): void {
  void constructorValue;
}

/**
 * Clears caller-owned set intentionally.
 *
 * @param values - Mutable caller collection.
 *
 * @mutates values - Clears caller-owned values before reuse.
 */
export function clearReadonlyFixture(values: Set<string>,): void {
  values.clear();
}

/**
 * Clears caller-owned set through effect proven by local implementation.
 *
 * @param values - Mutable caller collection.
 */
export function clearWithoutMutationContract(values: Set<string>,): void {
  values.clear();
}

/**
 * Invokes callback through effect proven by local implementation.
 *
 * @param callback - Caller callback capability.
 */
export function invokeWithoutMutationContract(callback: () => void,): void {
  callback();
}

/**
 * Launches a process after Node copies a readonly argument list.
 *
 * @param args - Primitive command arguments observed by process launch.
 */
export function launchReadonlyArguments(args: readonly string[],): void {
  void spawn(
    'printf',
    args,
    { stdio: 'ignore', },
  );
}

/**
 * Launches a process through two-argument options overload.
 *
 * @param options - Caller-owned launch options exposed to native process creation.
 *
 * @mutates options - Node 26.5.0 child_process.spawn may observe option getters, environment state, signals, and stdio capabilities.
 */
export function launchReadonlyOptions(options: SpawnOptions,): void {
  void spawn(
    'printf',
    options,
  );
}

/**
 * Copies typed-array bytes while exposing audited conversion-property hooks.
 *
 * @param bytes - Caller byte view copied into owned Buffer storage.
 *
 * @returns owned Buffer copy.
 */
export function copyBufferBytes(bytes: Uint8Array,): Buffer {
  return Buffer.from(bytes,);
}

/**
 * Reads capability without invoking mutation.
 *
 * @param controller - Cancellation capability inspected without transition.
 */
export function readControllerSignal(controller: AbortController,): AbortSignal {
  return controller.signal;
}

/** Mutable foreign child shape imposed by parser-like upstream API. */
type ForeignFixtureChild = {
  value: string;
};

/** Mutable foreign tree shape imposed by parser-like upstream API. */
type ForeignFixtureTree = {
  children: ForeignFixtureChild[];
};

/**
 * Reads child reached only through marked ownership boundary.
 *
 * @param child - Child carrying propagated foreign provenance.
 *
 * @returns child value.
 */
function readForeignFixtureChild(child: ForeignFixtureChild,): string {
  return child.value;
}

/**
 * Reads foreign descendants through property access, destructuring, elements,
 * callbacks, and an owned helper call without repeating marker.
 *
 * @param tree - Root handle supplied by foreign parser-like API.
 *
 * @returns joined child values.
 */
export function readForeignFixtureTree(
  tree: ForeignBorrowed<ForeignFixtureTree>,
): string {
  const { children, } = tree;
  return children
    .map(function readChild(child,) {
      return readForeignFixtureChild(child,);
    },)
    .join(',',);
}

/**
 * Filters foreign descendants through one shallow copy without repeating marker.
 *
 * @param tree - Root handle supplied by foreign parser-like API.
 *
 * @returns children carrying non-empty values.
 */
export function filterForeignFixtureTree(
  tree: ForeignBorrowed<ForeignFixtureTree>,
): readonly ForeignFixtureChild[] {
  return tree.children
    .slice()
    .filter(function retainNonEmptyChild(child,) {
      return child.value.length > 0;
    },);
}

/**
 * Filters aliased foreign descendants after audited shallow copy.
 *
 * @param tree - Root handle supplied by foreign parser-like API.
 *
 * @returns children carrying non-empty values.
 */
export function filterAliasedForeignFixtureTree(
  tree: ForeignBorrowed<ForeignFixtureTree>,
): readonly ForeignFixtureChild[] {
  /**
   * Shallow copy retaining foreign descendant provenance.
   */
  const copied = tree.children.slice();
  return copied.filter(function retainAliasedNonEmptyChild(child,) {
    return child.value.length > 0;
  },);
}

/**
 * Sorts and filters foreign descendants while preserving ownership.
 *
 * @param tree - Root handle supplied by foreign parser-like API.
 *
 * @returns sorted children carrying non-empty values.
 */
export function sortForeignFixtureTree(
  tree: ForeignBorrowed<ForeignFixtureTree>,
): readonly ForeignFixtureChild[] {
  return tree.children
    .toSorted(function byValueLength(left, right,) {
      return left.value.length - right.value.length;
    },)
    .filter(function retainSortedNonEmptyChild(child,) {
      return child.value.length > 0;
    },);
}

/**
 * Reads first foreign descendant reached through synchronous iteration.
 *
 * @param tree - Root handle supplied by foreign parser-like API.
 *
 * @returns first child value or empty string.
 */
export function readForeignFixtureForOf(
  tree: ForeignBorrowed<ForeignFixtureTree>,
): string {
  for (const child of tree.children)
    return readForeignFixtureChild(child,);
  return '';
}

/**
 * Invokes caller callback capability.
 *
 * @param callback - Operation selected by caller.
 *
 * @returns callback result.
 *
 * @mutates callback - Invoking callback can change captured or otherwise reachable state.
 */
function invokeFixtureCallback(callback: () => string,): string {
  return callback();
}

/**
 * Passes pure local callback without treating captured readonly state as mutated.
 *
 * @param state - Readonly state captured for observation.
 *
 * @returns captured value.
 */
export function invokePureFixtureCallback(
  state: { readonly value: string; },
): string {
  return invokeFixtureCallback(function readValue() {
    return state.value;
  },);
}

/**
 * Passes throwing local callback without claiming mutation.
 *
 * @returns unreachable callback result.
 *
 * @throws Error unconditionally from local callback.
 */
export function invokeThrowingFixtureCallback(): string {
  return invokeFixtureCallback(function throwValue() {
    throw new Error('fixture',);
  },);
}

/** Unique type-only brand for primitive String conversion coverage. */
declare const STRING_PRIMITIVE_BRAND: unique symbol;

/** Primitive string retaining type-only domain identity. */
type BrandedPrimitiveString = string & {
  readonly [STRING_PRIMITIVE_BRAND]: true;
};

/**
 * Converts only primitive input without caller-owned coercion hooks.
 *
 * @param value - Primitive value converted directly by ECMAScript.
 *
 * @returns text representation.
 */
export function primitiveStringConversion(
  value: string | number | symbol,
): string {
  return String(value,);
}

/**
 * Converts type-branded primitive without treating brand as runtime object state.
 *
 * @param value - Branded primitive string.
 *
 * @returns underlying primitive text.
 */
export function brandedPrimitiveStringConversion(
  value: BrandedPrimitiveString,
): string {
  return String(value,);
}

/**
 * Deliberately runs caller-owned global String coercion hooks.
 *
 * @param value - Unknown value whose conversion behavior is intentionally allowed.
 *
 * @returns caller-defined String conversion result.
 *
 * @mutates value - String may invoke getters, proxy traps, Symbol.toPrimitive, toString, or valueOf on this input.
 */
export function deliberateStringObjectCoercion(value: unknown,): string {
  return String(value,);
}

/**
 * Bodyless owned mutation contract.
 */
export type ReadonlyFixtureMutator = {
  /**
   * Changes supplied state.
   *
   * @param state - Mutable state supplied by caller.
   *
   * @mutates state - Changes state according to implementation contract.
   */
  (state: { value: string; },): void;
};

/**
 * Documents uncatalogued external effect at local adapter boundary.
 *
 * @param state - State forwarded to external mutation boundary.
 *
 * @mutates state - Delegates caller state to opaqueExternalMutation.
 */
export function readonlyExternalAdapter(state: { value: string; },): void {
  opaqueExternalMutation(state,);
}

/**
 * Sends a fresh array of primitive elements through an unknown boundary.
 *
 * The fresh container and primitive elements retain no caller-owned state.
 *
 * @param values - Primitive values copied into owned container.
 */
export function copiedPrimitiveArray(values: readonly string[],): void {
  opaqueExternalValues([...values,],);
}

/**
 * Propagates verified local adapter effect to caller contract.
 *
 * @param state - State forwarded through verified adapter.
 *
 * @mutates state - Delegates caller state to readonlyExternalAdapter.
 */
export function callReadonlyExternalAdapter(state: { value: string; },): void {
  readonlyExternalAdapter(state,);
}

/**
 * Declares mutating overload contract.
 *
 * @param values - Set cleared by implementation.
 *
 * @mutates values - Clears supplied set in overload contract.
 */
export function clearReadonlyOverload(values: Set<string>,): void;

/**
 * Implements mutating overload contract.
 *
 * @param values - Set cleared by implementation.
 *
 * @mutates values - Clears supplied set in implementation.
 */
export function clearReadonlyOverload(values: Set<string>,): void {
  values.clear();
}
