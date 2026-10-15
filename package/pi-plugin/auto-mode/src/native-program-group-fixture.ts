/**
 Independent native groups expose original calls, preparation, cancellation, and returned outcomes. @module
 */
import assert from 'node:assert/strict';
import type {
  FixtureProgramCall,
  FixtureProgramMember,
  FixtureProgramOutcome,
  FixtureReachedGroup,
  ProgramOwnerFixture
} from './native-program-owner-fixture-types.ts';

/**
 Group fixtures retain their complete independent native inputs and original returned objects.
 */
export type ProgramGroupFixture = Readonly<{
  reached: FixtureReachedGroup;
  calls: readonly FixtureProgramCall[];
  tools: readonly Readonly<{
    name: string;
    outputSchema?: unknown
  }>[];
  members: readonly FixtureProgramMember[];
  controllers: readonly AbortController[];
  signals: readonly AbortSignal[];
  outcomes: readonly FixtureProgramOutcome[];
  options: object;
  invocations: Readonly<{
    call: unknown;
    options: unknown
  }>[];
  bind: (input?: Readonly<{ runNative?: (
    call: FixtureProgramCall,
    options: unknown
  ) => unknown }>) => readonly object[];
  prepare: () => readonly object[];
  markReturned: () => void;
  invoke: (index?: number) => Promise<unknown>;
  value: (index?: number) => string;
}>;

//region Fixtures supply native data while every ownership transition remains in the built program owner.
/**
 Reach an original source group and create independent matching native inputs.

 @param fixture - original disposable judgment owner

 @param program - original open program handle

 @param ordinal - original declared source group

 @param structured - whether original native tools declare structured output

 @returns independent native group and direct built-owner operations

 @example createProgramGroupFixture({ fixture, program });
 */
export function createProgramGroupFixture({
  fixture,
  program,
  ordinal = 0,
  structured = false
}: Readonly<{
  fixture: ProgramOwnerFixture;
  program: object;
  ordinal?: number;
  structured?: boolean;
}>): ProgramGroupFixture {
  /**
   Original built-owner operations and fixture-owned records remain separate capabilities.
   */
  const {
    owner,
    bindings
  } = fixture;
  /**
   The built owner materializes the original source group before native inputs are created.
   */
  const reached = owner.reachProgramGroup({
    program,
    ordinal
  });
  /**
   Native calls retain the original reached names and exact argument objects.
   */
  const calls = Object.freeze(reached.members
    .map(function originalCall(
      site,
      index
    ): FixtureProgramCall {
    return Object.freeze({
      type: 'toolCall',
      id: `group-${ordinal}-call-${index}`,
      name: site.name,
      arguments: site.args
    });
  }));
  /**
   Original callable metadata independently controls native result conversion.
   */
  const tools = Object.freeze(calls.map(function originalTool(call) { 
    return Object.freeze({
    name: call.name,
    ...(structured ? { outputSchema: {} } : {})
  }); 
  }));
  /**
   Final native members remain frozen independently from their later owner-issued handles.
   */
  const members = Object.freeze(calls.map(function preparedMember(call) { 
    return Object.freeze({
    id: call.id,
    name: call.name,
    input: call.arguments
  }); 
  }));
  /**
   Each original native child has an independent cancellation source.
   */
  const controllers = calls.map(function originalCancellation() { 
    return new AbortController(); 
  });
  /**
   Original native cancellation follows complete source member order.
   */
  const signals = controllers.map(function originalSignal(controller) { 
    return controller.signal; 
  });
  /**
   Exact mutable native outcomes expose replacement and delayed mutation contrasts.
   */
  const outcomes: FixtureProgramOutcome[] = calls.map(function originalOutcome(call) { 
    return {
    toolCall: call,
    isError: false,
    result: { content: [{
      type: 'text',
      text: 'original producer text'
    }] }
  }; 
  });
  /**
   Original native options must be forwarded by identity.
   */
  const options = Object.freeze({});
  /**
   The fixture records original native call and option references without substituting execution.
   */
  const invocations: Readonly<{
    call: unknown;
    options: unknown
  }>[] = [];
  /**
   Fixture-local controls expose only independently selected failures and publication outcomes.
   */
  const state: {
    slots?: readonly object[];
    handles?: readonly object[]
  } = {};
  /**
   Original child return state remains independent from successful native outcome conversion.
   */
  function markReturned(): void {
    assert.ok(state.handles);
    for (const member of state.handles) {
      /**
       Original prepared-member record remains independently controlled by the fixture.
       */
      const record = bindings.get(member);
      assert.ok(record);
      record.execution = {
        token: Object.freeze({}),
        state: 'returned',
        origin: { signal: record.effectiveSignal }
      };
    }
  }
  /**
   Fixed native callbacks preserve the positional signature supplied by the original native consumer.
   */
  const nativeRunner = {
    /**
     Fixed native runner returns exact original objects after independent child completion.
  
     @param call - original native call passed by the built consumer
  
     @param originalOptions - exact original options
  
     @returns original native outcome
     */
      runNative: function runOriginalNative(
    this: void,
    call: FixtureProgramCall,
    originalOptions: unknown
  ): unknown {
    invocations.push({
      call,
      options: originalOptions
    });
    assert.equal(
      originalOptions,
      options
    );
    /**
     Only an original call object can select its exact native outcome.
     */
    const index = calls.indexOf(call);
    assert.notEqual(
      index,
      -1
    );
    markReturned();
    return outcomes[index];
  }
  };
  /**
   Bind the complete original native group through the built owner.

   @param runNative - optional independently controlled native runner

   @returns original native slot handles
   */
  function bind({ runNative = nativeRunner.runNative }: Readonly<{ runNative?: typeof nativeRunner.runNative }> = {}): readonly object[] {
    /**
     The built owner publishes complete original native slot handles.
     */
    const slots = owner.bindProgramCalls({
      group: reached.handle,
      calls,
      tools,
      runNative
    });
    state.slots = slots;
    return slots;
  }
  /**
   Prepare the complete original child group through its real publication boundary.

   @returns original prepared member handles
   */
  function prepare(): readonly object[] {
    /**
     Final preparation returns only original owner-issued member handles.
     */
    const handles = owner.prepareReachedMembers({
      group: reached.handle,
      members,
      nativeSignals: signals
    });
    state.handles = handles;
    return handles;
  }
  /**
   Invoke one original native slot without reconstructing its call or options.

   @param index - original source member position

   @returns original built native outcome
   */
  async function invoke(index = 0): Promise<unknown> {
    /**
     The selected original slot must already belong to this bound fixture group.
     */
    const slot = state.slots?.[index];
    assert.ok(slot);
    /**
     The original native call is forwarded without cloning its arguments.
     */
    const call = calls[index];
    assert.ok(call);
    return await owner.invokeProgramNative({
      group: reached.handle,
      slot,
      call,
      options
    });
  }
  /**
   Consume only the exact original native outcome through the built program owner.

   @param index - original source member position

   @returns original supported script text
   */
  function value(index = 0): string {
    /**
     The selected original slot must already belong to this bound fixture group.
     */
    const slot = state.slots?.[index];
    assert.ok(slot);
    return owner.scriptValueFor({
      group: reached.handle,
      slot,
      outcome: outcomes[index]
    });
  }
  return {
    reached,
    calls,
    tools,
    members,
    controllers,
    signals,
    outcomes,
    options,
    invocations,
    bind,
    prepare,
    markReturned,
    invoke,
    value
  };
}
//endregion
