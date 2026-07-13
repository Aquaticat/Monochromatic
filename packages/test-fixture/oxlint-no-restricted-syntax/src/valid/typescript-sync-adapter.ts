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
 * Reads capability without invoking mutator.
 *
 * @param readOnlyController - Capability inspected without mutation.
 */
export function noSemanticEffect(readOnlyController: AbortController,): AbortSignal {
  return readOnlyController.signal;
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
