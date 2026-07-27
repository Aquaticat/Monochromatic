import type { Dirent, } from 'node:fs';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';

import {
  clearSemanticEffectFixture,
  visitSemanticEffectFixture,
} from './semantic-effects-helper.ts';

/**
 * Generic object used by TypeScript bridge fixture.
 */
export type SemanticFixtureBox<T> = {
  /**
   * Stored fixture value.
   */
  value: T;
};

/**
 * Recursive readonly projection used without package dependency in fixture.
 */
type ReadonlyDeep<T> = {
  readonly [Key in keyof T]: ReadonlyDeep<T[Key]>;
};

/**
 * Callable capability used to verify projection honesty.
 */
type SemanticMethodCapability = {
  readonly value: string;
  mutate: () => void;
};

/**
 * Reads semantic fixture value.
 *
 * @param box - Fixture box resolved by TypeScript bridge.
 *
 * @returns stored fixture value.
 *
 * @example
 * ```ts
 * readSemanticFixtureBox({ value: 'fixture' });
 * ```
 */
export function readSemanticFixtureBox(box: SemanticFixtureBox<string>,): string {
  return box.value;
}

/**
 * Adds value through ECMAScript collection capability.
 *
 * @param values - Mutable set used for intrinsic provenance fixture.
 */
export function addSemanticFixtureValue(values: Set<string>,): void {
  values.add('fixture',);
}

/**
 * Aborts through DOM capability.
 *
 * @param controller - Abort controller used for intrinsic provenance fixture.
 */
export function abortSemanticFixture(controller: AbortController,): void {
  controller.abort();
}

/**
 * Composes cancellation signals through global constructor variable method.
 *
 * @param signals - Signals observed by composite.
 *
 * @returns Composite cancellation signal.
 */
export function composeAbortSignals(signals: readonly AbortSignal[],): AbortSignal {
  return AbortSignal.any([...signals,],);
}

/**
 * Creates a signal from a primitive timeout delay.
 *
 * @param milliseconds - Delay before abort.
 *
 * @returns Owned timeout signal.
 */
export function timeoutAbortSignal(milliseconds: number,): AbortSignal {
  return AbortSignal.timeout(milliseconds,);
}

/**
 * Accepts mutable structural data for classifier fixture.
 *
 * @param mutableObject - Writable structural data.
 */
export function classifyMutableObject(mutableObject: { value: string; },): void {
  void mutableObject;
}

/**
 * Accepts broad nonprimitive object capability for classifier fixture.
 *
 * @param objectValue - Value whose properties and proxy behavior are not known.
 */
export function classifyBroadObjectCapability(objectValue: object,): void {
  void objectValue;
}

/**
 * Accepts direct callable capability for classifier fixture.
 *
 * @param callableValue - Caller-defined behavior.
 */
export function classifyCallableCapability(callableValue: () => void,): void {
  void callableValue;
}

/**
 * Accepts constructable capability for classifier fixture.
 *
 * @param constructorValue - Caller-defined constructor behavior.
 */
export function classifyConstructorCapability(
  constructorValue: abstract new() => object,
): void {
  void constructorValue;
}

/**
 * Accepts unknown runtime capability for classifier fixture.
 *
 * @param unknownValue - Value whose runtime capabilities are not known.
 */
export function classifyUnknownCapability(unknownValue: unknown,): void {
  void unknownValue;
}

/**
 * Accepts unchecked runtime capability for classifier fixture.
 *
 * @param anyValue - Value whose runtime capabilities bypass type checking.
 */
export function classifyAnyCapability(anyValue: any,): void {
  void anyValue;
}

/**
 * Accepts full TextEncoder readonly projection retaining encodeInto mutation.
 *
 * @param readonlyEncoder - Projection that still writes supplied destinations.
 */
export function classifyReadonlyEncoder(
  readonlyEncoder: Readonly<TextEncoder>,
): void {
  void readonlyEncoder;
}

/**
 * Accepts only audited observational TextEncoder operation.
 *
 * @param encodeOnly - Narrow capability creating fresh bytes.
 */
export function classifyEncodeOnly(
  encodeOnly: Pick<TextEncoder, 'encode'>,
): void {
  void encodeOnly;
}

/**
 * Accepts deeply readonly structural data for classifier fixture.
 *
 * @param readonlyObject - Deeply readonly structural data.
 */
export function classifyReadonlyObject(
  readonlyObject: Readonly<SemanticFixtureBox<string>>,
): void {
  void readonlyObject;
}

/**
 * Accepts projected capability that retains abort operation.
 *
 * @param projectedController - Dishonest readonly capability projection.
 */
export function classifyProjectedController(
  projectedController: ReadonlyDeep<AbortController>,
): void {
  void projectedController;
}

/**
 * Accepts original capability for effect-dependent classification.
 *
 * @param capabilityController - Original cancellation capability.
 */
export function classifyCapabilityController(capabilityController: AbortController,): void {
  void capabilityController;
}

/**
 * Accepts standard readonly collection interface.
 *
 * @param readonlyMap - Observational readonly collection.
 */
export function classifyReadonlyMap(
  readonlyMap: ReadonlyMap<string, Readonly<SemanticFixtureBox<string>>>,
): void {
  void readonlyMap;
}

/**
 * Accepts readonly array with primitive elements.
 *
 * @param readonlyValues - Readonly primitive collection.
 */
export function classifyReadonlyArray(readonlyValues: readonly string[],): void {
  void readonlyValues;
}

/**
 * Accepts readonly array whose elements remain mutable.
 *
 * @param shallowReadonlyValues - Collection with mutable reachable elements.
 */
export function classifyShallowReadonlyArray(
  shallowReadonlyValues: readonly SemanticFixtureBox<string>[],
): void {
  void shallowReadonlyValues;
}

/**
 * Accepts readonly map whose values remain mutable.
 *
 * @param shallowReadonlyMap - Readonly map with mutable reachable values.
 */
export function classifyShallowReadonlyMap(
  shallowReadonlyMap: ReadonlyMap<string, SemanticFixtureBox<string>>,
): void {
  void shallowReadonlyMap;
}

/**
 * Accepts readonly projection retaining unknown method capability.
 *
 * @param projectedMethod - Projection retaining callable effect boundary.
 */
export function classifyProjectedMethod(
  projectedMethod: Readonly<SemanticMethodCapability>,
): void {
  void projectedMethod;
}

/**
 * Accepts original unknown method capability.
 *
 * @param originalMethod - Original callable capability contract.
 */
export function classifyOriginalMethod(originalMethod: SemanticMethodCapability,): void {
  void originalMethod;
}

/**
 * Mutates parameter directly.
 *
 * @param directState - Writable caller state.
 */
export function directSemanticEffect(directState: { value: string; },): void {
  directState.value = 'changed';
}

/**
 * Mutates state packaged into destructured call argument.
 *
 * @param state - Mutable state unpacked from call argument object.
 *
 * @mutates state - Updates packaged caller state.
 */
function mutatePackagedState({
  state,
}: {
  readonly state: { value: string; };
},): void {
  state.value = 'changed';
}

/**
 * Propagates mutation through object-literal call packaging.
 *
 * @param state - Mutable caller state packaged for helper.
 *
 * @mutates state - Forwards state to packaged mutation helper.
 */
export function packagedSemanticEffect(state: { value: string; },): void {
  mutatePackagedState({ state, },);
}

/**
 * Mutates parameter through cross-file helper.
 *
 * @param crossFileValues - Set forwarded to clearing helper.
 */
export function crossFileSemanticEffect(crossFileValues: Set<string>,): void {
  clearSemanticEffectFixture(crossFileValues,);
}

/**
 * Mutates parameter through immediate generic callback invocation.
 *
 * @param callbackState - State forwarded through callback relation.
 */
export function callbackSemanticEffect(callbackState: { value: string; },): void {
  visitSemanticEffectFixture(
    callbackState,
    function mutateVisitedState(visitedState,): void {
      visitedState.value = 'changed';
    },
  );
}

/**
 * Invokes caller callback whose closure effects remain opaque.
 *
 * @param callback - Caller callback allowed to change captured state.
 *
 * @mutates callback - Direct invocation can change state captured by caller callback.
 */
export function directCallbackEffect(callback: () => void,): void {
  callback();
}

/**
 * Consumes caller-owned async iterator state.
 *
 * @param stream - Caller stream consumed by async iteration.
 *
 * @mutates stream - Async iteration invokes iterator methods and advances supplied state.
 */
export async function asyncIteratorEffect(stream: AsyncIterable<unknown>,): Promise<void> {
  for await (const value of stream)
    void value;
}

/**
 * Mutates object passed through ordinary named parameter.
 *
 * @param input - Wrapper containing caller state.
 *
 * @mutates input - Changes nested caller state through ordinary parameter.
 */
function mutateWholeParameter(input: { readonly value: { flag: boolean; }; },): void {
  input.value.flag = true;
}

/**
 * Propagates whole-parameter mutation through fresh object packaging.
 *
 * @param state - Caller state packaged for local helper.
 *
 * @mutates state - `mutateWholeParameter` changes packaged state.
 */
export function wholeParameterContractEffect(state: { flag: boolean; },): void {
  mutateWholeParameter({ value: state, },);
}

/**
 * Mutates receiver-reachable array elements through audited callback relation.
 *
 * @param states - Readonly container whose mutable elements are updated.
 *
 * @mutates states - Updates value on every receiver-reachable element.
 */
export function arrayCallbackSemanticEffect(
  states: readonly { value: string; }[],
): void {
  states.forEach(function updateState(state,): void {
    state.value = 'changed';
  },);
}

/**
 * Mutates elements arriving at the fold callback's second parameter.
 *
 * `reduce` carries its accumulator at parameter 0 and its element at parameter
 * 1, so matching callback parameters by position instead of by type would
 * attribute element flow to the primitive total and discharge this mutation.
 *
 * @param states - Readonly container whose mutable elements are updated.
 *
 * @returns count of visited elements.
 *
 * @mutates states - Updates value on every folded element.
 */
export function reduceElementParameterEffect(
  states: readonly { value: string; }[],
): number {
  return states.reduce(function fold(total, state,): number {
    state.value = 'changed';
    return total + 1;
  }, 0,);
}

/**
 * Mutates receiver-reachable state through the whole-array callback parameter.
 *
 * `forEach` hands the receiver itself to parameter 2, so matching only the
 * element type would let this reach receiver state undetected.
 *
 * @param states - Readonly container reached through its own third parameter.
 *
 * @mutates states - Updates value on the first element.
 */
export function forEachWholeArrayEffect(
  states: readonly { value: string; }[],
): void {
  states.forEach(function reachThroughArray(value, index, all,): void {
    const first = all[0];
    if (first === undefined)
      return;
    first.value = `${value.value}${String(index,)}`;
  },);
}

/**
 * Mutates map values arriving at the read-only map's visit callback.
 *
 * Proves the recognizer covers every default-library read-only view rather than
 * `ReadonlyArray` alone.
 *
 * @param entries - Readonly map whose mutable values are updated.
 *
 * @mutates entries - Updates value on every visited entry.
 */
export function readonlyMapCallbackEffect(
  entries: ReadonlyMap<string, { value: string; }>,
): void {
  entries.forEach(function updateEntry(entry,): void {
    entry.value = 'changed';
  },);
}

/**
 * Mutates its own parameter, for use as an observer passed by reference.
 *
 * @param state - Element mutated.
 *
 * @returns previous value.
 *
 * @mutates state - Overwrites value.
 */
function renderVisitedState(state: { value: string; },): string {
  const previous = state.value;
  state.value = 'rendered';
  return previous;
}

/**
 * Passes an owned observer by reference rather than as a callback literal.
 *
 * A by-reference observer annotates its own parameter, so that type is a
 * distinct instance from the receiver's element type even when the two are
 * structurally identical. Matching positions against the observer's annotations
 * finds nothing here, and discharging on that emptiness loses this mutation.
 *
 * @param states - Readonly container whose mutable elements are updated.
 *
 * @returns previous values.
 *
 * @mutates states - Updates value on every visited element.
 */
export function referencedObserverEffect(
  states: readonly { value: string; }[],
): readonly string[] {
  return states.map(renderVisitedState,);
}

/**
 * Observes a mutable array through a member the paired read-only view declares.
 *
 * `forEach` appears on `ReadonlyArray`, so upstream states it does not
 * restructure the receiver even when the receiver is the mutable `Array`. The
 * observer is owned and reads only a primitive, so nothing propagates.
 *
 * @param states - Mutable container observed without restructuring.
 *
 * @returns count of non-empty values.
 */
export function mutableArrayObservationEffect(
  states: { readonly value: string; }[],
): number {
  const counted = { total: 0, };
  states.forEach(function countState(state,): void {
    counted.total += state.value.length;
  },);
  return counted.total;
}

/**
 * Mutates a caller-owned array through a member absent from the paired view.
 *
 * `push` is declared on `Array` and not on `ReadonlyArray`, which is upstream's
 * own statement that it restructures the receiver.
 *
 * @param states - Mutable container appended to.
 *
 * @mutates states - Appends one element.
 */
export function mutableArrayStructureEffect(
  states: { readonly value: string; }[],
): void {
  states.push({ value: 'appended', },);
}

/**
 * Mutates a caller-owned set through a member absent from the paired view.
 *
 * @param names - Mutable set cleared before reuse.
 *
 * @mutates names - Clears every entry.
 */
export function mutableSetStructureEffect(names: Set<string>,): void {
  names.clear();
}

/**
 * Mutates parameter through aliased generic callback argument.
 *
 * @param callbackState - State forwarded through aliased callback relation.
 */
export function aliasedCallbackSemanticEffect(callbackState: { value: string; },): void {
  const mutateVisitedState = function mutateAliasedVisitedState(visitedState: {
    value: string;
  },): void {
    visitedState.value = 'changed';
  };
  visitSemanticEffectFixture(callbackState, mutateVisitedState,);
}

/**
 * Reads capability without invoking mutator.
 *
 * @param readOnlyController - Capability inspected without mutation.
 */
export function noSemanticEffect(readOnlyController: AbortController,): AbortSignal {
  return readOnlyController.signal;
}

/**
 * Observes parameter through spec-audited non-dispatching intrinsics.
 *
 * @param state - State checked by exact observational intrinsics.
 */
export function observationalIntrinsicEffect(state: readonly unknown[],): boolean {
  return Array.isArray(state,) && Object.is(state, state,);
}

/**
 * Checks array branding through exact TypeScript default-library intrinsic.
 *
 * @param state - Candidate array value.
 *
 * @returns Whether value carries array brand.
 */
export function arrayBrandObservationEffect(state: readonly unknown[],): boolean {
  return Array.isArray(state,);
}

/**
 * Sorts primitive array copy through audited nonmutating intrinsic.
 *
 * @param values - Primitive numbers copied and sorted without receiver mutation.
 *
 * @returns ascending copy of values.
 */
export function primitiveArraySortObservationEffect(
  values: readonly number[],
): readonly number[] {
  return values.toSorted(function ascending(left, right,): number {
    return left - right;
  },);
}

/**
 * Encodes primitive text without changing TextEncoder receiver.
 *
 * @param encoder - Stateless encoder reused across calls.
 *
 * @param text - Primitive text converted to new bytes.
 *
 * @returns newly allocated UTF-8 bytes.
 */
export function textEncoderObservationEffect({
  encoder,
  text,
}: {
  readonly encoder: Readonly<TextEncoder>;
  readonly text: string;
},): Uint8Array {
  return encoder.encode(text,);
}

/**
 * Sorts object elements through an explicitly analyzable comparator.
 *
 * @param values - Object values whose sort callback may expose state.
 *
 * @returns sorted object copy.
 */
export function objectArraySortCallbackEffect(
  values: readonly { readonly value: string; }[],
): readonly { readonly value: string; }[] {
  return values.toSorted(function ascending(left, right,): number {
    return left.value.localeCompare(right.value,);
  },);
}

/**
 * Observes default plain-element sorting because plain data carries no coercion hooks.
 *
 * @param values - Plain object values whose default coercion is statically hook-free.
 *
 * @returns sorted object copy.
 */
export function plainArrayDefaultSortObservationEffect(
  values: { readonly value: string; }[],
): readonly { readonly value: string; }[] {
  return values.toSorted();
}

/**
 * Keeps default hook-capable-element sorting opaque because coercion hooks may run.
 *
 * @param values - Values whose function-typed toString keeps coercion hook-capable.
 *
 * @returns sorted object copy.
 */
export function hookedArrayDefaultSortOpaqueEffect(
  values: {
    readonly value: string;
    readonly toString: () => string;
  }[],
): readonly {
  readonly value: string;
  readonly toString: () => string;
}[] {
  return values.toSorted();
}

/**
 * Keeps explicitly undefined object sorting opaque because default coercion may run.
 *
 * @param values - Object values exposed to default string coercion.
 *
 * @returns sorted object copy.
 */
export function objectArrayUndefinedSortOpaqueEffect(
  values: { readonly value: string; }[],
): readonly { readonly value: string; }[] {
  return values.toSorted(undefined,);
}

/**
 * Observes maybe-undefined comparator sorting because plain elements coerce hook-free.
 *
 * @param values - Plain object values whose default coercion is statically hook-free.
 *
 * @param compare - Comparator that may be absent at runtime.
 *
 * @returns sorted object copy.
 */
export function plainArrayOptionalSortObservationEffect({
  values,
  compare,
}: {
  readonly values: { readonly value: string; }[];
  readonly compare?: (
    left: { readonly value: string; },
    right: { readonly value: string; },
  ) => number;
}): readonly { readonly value: string; }[] {
  return values.toSorted(compare,);
}

/**
 * Observes primitive path through audited Node operation.
 *
 * @param path - Path joined without caller mutation.
 *
 * @returns joined fixture path.
 */
export function pathObservationEffect(path: string,): string {
  return join(path, 'fixture',);
}

/**
 * Observes Date internal slots through audited getters.
 *
 * @param date - Date capability read without caller mutation.
 *
 * @returns local and UTC minute total.
 */
export function dateObservationEffect(date: Date,): number {
  return date.getMinutes() + date.getUTCMinutes();
}

/**
 * Converts URL through audited Node URL operation.
 *
 * @param url - File URL read without caller mutation.
 *
 * @returns platform path for file URL.
 */
export function fileUrlObservationEffect(url: URL,): string {
  return fileURLToPath(url,);
}

/**
 * Reads foreign directory-entry file type through audited Node methods.
 *
 * @param entry - Directory entry inspected without mutation.
 *
 * @returns whether entry represents file or directory.
 */
export function direntObservationEffect(entry: Dirent,): boolean {
  return entry.isFile() || entry.isDirectory();
}

/**
 * Observes primitive values and collection membership through audited intrinsics.
 *
 * @param inputs - Primitive and collection inputs checked without mutation.
 *
 * @returns whether every observational check succeeds.
 */
export function observationalValueEffects(inputs: {
  readonly text: string;
  readonly values: ReadonlySet<string>;
  readonly error: unknown;
},): boolean {
  return inputs.text.trim().startsWith('fixture',)
    && inputs.values.has(inputs.text,)
    && Error.isError(inputs.error,);
}

/**
 * Mutates parameter through local alias.
 *
 * @param aliasState - State assigned to local alias.
 */
export function aliasSemanticEffect(aliasState: { value: string; },): void {
  const localAlias = aliasState;
  localAlias.value = 'changed';
}

/**
 * Mutates parameter through separately assigned local alias.
 *
 * @param assignedState - State assigned after local declaration.
 */
export function assignedAliasSemanticEffect(assignedState: { value: string; },): void {
  let assignedAlias: { value: string; };
  assignedAlias = assignedState;
  assignedAlias.value = 'changed';
}

/**
 * Rebinds parameter without mutating caller referent.
 *
 * @param reboundState - Local binding replaced without reachable write.
 */
export function reboundParameterSemanticEffect(reboundState: { value: string; },): void {
  reboundState = { value: 'local', };
  void reboundState;
}

/**
 * Mutates nested parameter state through destructured alias.
 *
 * @param wrappedState - Wrapper destructured before nested write.
 */
export function destructuredAliasSemanticEffect(
  wrappedState: { nested: { value: string; }; },
): void {
  const { nested, } = wrappedState;
  nested.value = 'changed';
}

/**
 * Mutates nested state through destructured parameter binding.
 *
 * @param anonymous - Wrapper destructured at parameter boundary.
 */
export function destructuredParameterSemanticEffect(
  { nested, }: { nested: { value: string; }; },
): void {
  nested.value = 'changed';
}

/**
 * Passes parameter through uncatalogued external callable.
 *
 * @param opaqueState - State crossing unresolved external effect boundary.
 */
export function opaqueSemanticEffect(opaqueState: { readonly value: string; },): string {
  return JSON.stringify(opaqueState,);
}

/**
 * Documents possible effects from an unresolved serializer.
 *
 * @param uncertainState - Mutable state crossing unresolved serializer.
 *
 * @returns serialized state.
 *
 * @mutates uncertainState - JSON.stringify may invoke caller-owned accessors, proxy traps, or toJSON hooks.
 */
export function documentedUncertainSemanticEffect(
  uncertainState: { value: string; },
): string {
  return JSON.stringify(uncertainState,);
}

/**
 * Propagates documented uncertainty through owned helper call.
 *
 * @param uncertainState - State forwarded to documented uncertain helper.
 *
 * @returns serialized state.
 *
 * @mutates uncertainState - documentedUncertainSemanticEffect delegates possible JSON.stringify hooks.
 */
export function transitiveDocumentedUncertainSemanticEffect(
  uncertainState: { value: string; },
): string {
  return documentedUncertainSemanticEffect(uncertainState,);
}

/**
 * Passes primitive through otherwise opaque callable without mutable state.
 *
 * @param value - Primitive value unavailable for caller-observable mutation.
 *
 * @returns serialized primitive.
 */
export function primitiveOpaqueArgumentEffect(value: string,): string {
  return JSON.stringify(value,);
}

/**
 * Packages primitive inputs without exposing caller-owned mutable state.
 *
 * @param value - Primitive text packaged into local object.
 *
 * @param count - Primitive count packaged into local object.
 *
 * @returns serialized local primitive record.
 */
export function packagedPrimitiveOpaqueArgumentEffect({
  value,
  count,
}: {
  readonly value: string;
  readonly count: number;
},): string {
  return JSON.stringify({ value, count, },);
}

/**
 * Propagates opaque boundary through owned helper call.
 *
 * @param opaqueState - State forwarded to opaque helper.
 */
export function transitiveOpaqueSemanticEffect(
  opaqueState: { readonly value: string; },
): string {
  return opaqueSemanticEffect(opaqueState,);
}

/**
 * Defines but never invokes or exposes nested mutation closure.
 *
 * @param closureState - State captured only by dead local closure.
 */
export function unusedClosureSemanticEffect(closureState: { value: string; },): void {
  function neverCalled(): void {
    closureState.value = 'changed';
  }
  void neverCalled;
}

/**
 * Invokes nested closure that mutates captured parameter.
 *
 * @param closureState - State captured by invoked closure.
 */
export function calledClosureSemanticEffect(closureState: { value: string; },): void {
  function mutateCapturedState(): void {
    closureState.value = 'changed';
  }
  mutateCapturedState();
}

/**
 * Returns deferred closure that mutates captured parameter.
 *
 * @param closureState - State captured by returned closure.
 *
 * @returns deferred mutation closure.
 */
export function returnedClosureSemanticEffect(
  closureState: { value: string; },
): () => void {
  return function mutateReturnedState(): void {
    closureState.value = 'changed';
  };
}

/**
 * Passes deferred closure that mutates captured parameter.
 *
 * @param closureState - State captured by scheduled closure.
 */
export function passedClosureSemanticEffect(closureState: { value: string; },): void {
  queueMicrotask(function mutateScheduledState(): void {
    closureState.value = 'changed';
  },);
}

/**
 * Passes aliased deferred closure that mutates captured parameter.
 *
 * @param closureState - State captured by aliased scheduled closure.
 */
export function aliasedPassedClosureSemanticEffect(
  closureState: { value: string; },
): void {
  const scheduledMutation = function mutateAliasedScheduledState(): void {
    closureState.value = 'changed';
  };
  queueMicrotask(scheduledMutation,);
}

/**
 * Defines unused function expression that captures parameter.
 *
 * @param closureState - State captured only by dead function expression.
 */
export function unusedFunctionExpressionSemanticEffect(
  closureState: { value: string; },
): void {
  const neverCalled = function mutateUnusedState(): void {
    closureState.value = 'changed';
  };
  void neverCalled;
}

/**
 * Returns aliased object containing closure that mutates captured parameter.
 *
 * @param closureState - State captured by escaped object method.
 *
 * @returns container whose method mutates captured state.
 */
export function returnedContainerClosureSemanticEffect(
  closureState: { value: string; },
): { readonly run: () => void; } {
  const handlers = {
    run(): void {
      closureState.value = 'changed';
    },
  };
  return handlers;
}

/**
 * Passes object containing deferred closure that mutates captured parameter.
 *
 * @param closureState - State captured by asynchronously stored method.
 */
export function passedContainerClosureSemanticEffect(
  closureState: { value: string; },
): void {
  void Promise.resolve({
    run(): void {
      closureState.value = 'changed';
    },
  },);
}

/**
 * Defines dead outer closure whose invoked child captures parameter.
 *
 * @param closureState - State captured behind dead closure ancestry.
 */
export function deadParentClosureSemanticEffect(
  closureState: { value: string; },
): void {
  function neverCalledParent(): void {
    function calledOnlyInsideDeadParent(): void {
      closureState.value = 'changed';
    }
    calledOnlyInsideDeadParent();
  }
  void neverCalledParent;
}

/**
 * Stores closure on caller-reachable holder for later invocation.
 *
 * @param holder - Caller holder receiving deferred closure.
 *
 * @param closureState - Separate state captured by stored closure.
 */
export function storedClosureSemanticEffect({
  holder,
  closureState,
}: {
  readonly holder: { callback?: () => void; };
  readonly closureState: { value: string; };
}): void {
  holder.callback = function mutateStoredState(): void {
    closureState.value = 'changed';
    void JSON.stringify(closureState,);
  };
}
