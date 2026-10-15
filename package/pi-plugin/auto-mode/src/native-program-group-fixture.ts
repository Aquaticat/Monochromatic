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
  const {
    owner,
    bindings
  } = fixture;
  const reached = owner.reachProgramGroup({
    program,
    ordinal
  });
  const calls = Object.freeze(reached.members
    .map(function originalCall(site, index): FixtureProgramCall {
    return Object.freeze({ type: 'toolCall', id: `group-${ordinal}-call-${index}`, name: site.name, arguments: site.args });
  }));
  const tools = Object.freeze(calls.map(function originalTool(call) { return Object.freeze({
    name: call.name,
    ...(structured ? { outputSchema: {} } : {})
  }); }));
  const members = Object.freeze(calls.map(function preparedMember(call) { return Object.freeze({
    id: call.id,
    name: call.name,
    input: call.arguments
  }); }));
  const controllers = calls.map(function originalCancellation() { return new AbortController(); });
  const signals = controllers.map(function originalSignal(controller) { return controller.signal; });
  const outcomes: FixtureProgramOutcome[] = calls.map(function originalOutcome(call) { return {
    toolCall: call,
    isError: false,
    result: { content: [{ type: 'text', text: 'original producer text' }] }
  }; });
  const options = Object.freeze({});
  const invocations: Readonly<{
    call: unknown;
    options: unknown
  }>[] = [];
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
   Fixed native runner returns exact original objects after independent child completion.

   @param call - original native call passed by the built consumer

   @param originalOptions - exact original options

   @returns original native outcome
   */
  function runOriginalNative(
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
    const index = calls.indexOf(call);
    assert.notEqual(
      index,
      -1
    );
    markReturned();
    return outcomes[index];
  }
  /**
   Bind the complete original native group through the built owner.

   @param runNative - optional independently controlled native runner

   @returns original native slot handles
   */
  function bind({ runNative = runOriginalNative }: Readonly<{ runNative?: typeof runOriginalNative }> = {}): readonly object[] {
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
    const slot = state.slots?.[index];
    assert.ok(slot);
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
