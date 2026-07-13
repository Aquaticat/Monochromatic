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
 * Accepts mutable structural data for classifier fixture.
 *
 * @param mutableObject - Writable structural data.
 */
export function classifyMutableObject(mutableObject: { value: string; },): void {
  void mutableObject;
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
 * Keeps object-element sorting conservative until callback presence is specialized.
 *
 * @param values - Object values whose sort callback may expose state.
 *
 * @returns sorted object copy.
 */
export function objectArraySortOpaqueEffect(
  values: readonly { readonly value: string; }[],
): readonly { readonly value: string; }[] {
  return values.toSorted(function ascending(left, right,): number {
    return left.value.localeCompare(right.value,);
  },);
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
