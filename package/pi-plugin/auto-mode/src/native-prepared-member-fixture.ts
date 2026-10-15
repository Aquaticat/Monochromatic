/**
 Independent built consumers observe original prepared-member lifecycle and retained ownership. @module
 */
import {
  PreparedBatchContractError,
  seal
} from './native-input-seal-fixture.ts';

/**
 Consumer records retain original opaque arguments and blocking reasons.
 */
export type MemberDecision = Readonly<{
  block?: unknown;
  reason?: unknown
}>;
/**
 Original scheduled call identity is independent of the implementation's declarations.
 */
type NativeCall = Readonly<{
  type: string;
  id: string;
  name: string;
  arguments: unknown
}>;
/**
 Prepared manifest observations retain original mode, identity, and cloned input.
 */
type Member = Readonly<{
  groupExecutionMode: string;
  id: string;
  name: string;
  input: unknown
}>;
/**
 Assessment receives original manifest and cancellation identities.
 */
type Assessment = Readonly<{
  members: readonly unknown[];
  signal: unknown
}>;
/**
 Disposable callbacks support synchronous, asynchronous, and opaque failures.
 */
type Control = {
  prepare: (hook: unknown) => unknown;
  assess: (input: Assessment) => unknown;
  active: (stage: string) => unknown;
  seal: (input: unknown) => unknown;
  release: () => unknown;
};
/**
 Independent fixture exposes original identities and recorded lifecycle boundaries.
 */
type MemberFixture = Readonly<{
  call: NativeCall;
  hook: { args: unknown };
  signal: object;
  memberState: { entered: boolean };
  batchState: {
    assessmentStarted: boolean;
    decision?: MemberDecision
  };
  ready: Map<string, Member>;
  scheduled: NativeCall[];
  snapshots: (readonly unknown[])[];
  failures: unknown[];
  events: string[];
  blockReasons: unknown[];
  assessments: Assessment[];
  gate: PromiseWithResolvers<MemberDecision>;
  control: Control;
  block: (reason: unknown) => void;
  run: (overrides?: Readonly<Record<string, unknown>>) => Promise<unknown>;
}>;
/**
 Built member admission accepts independent opaque boundary probes.
 */
type MemberModule = Readonly<{
  preparePreparedMember: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
}>;

/**
 Check the rebuilt native member export without implementation declarations.

 @param value - rebuilt native member namespace

 @returns narrowed independent consumer contract

 @throws Error when original member admission is absent
 */
function assertMemberModule(value: unknown): asserts value is MemberModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('preparePreparedMember' in value))
    || ((typeof value.preparePreparedMember) !== 'function')) throw new Error('Built prepared member export is unavailable');
}
/**
 Member admission is consumed only from the rebuilt native artifact.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/prepared-member.ts',
  import.meta.url
).href);
assertMemberModule(loaded);
/**
 Explicit contract retains callable narrowing across fixture creation.
 */
const member: MemberModule = loaded;

//region Bind disposable original group state without replacing any global callbacks.
/**
 Create an independent group whose original operations remain observable.

 @returns original state, callback controls, and native member entry

 @example createMemberFixture();
 */
export function createMemberFixture(): MemberFixture {
  /**
   Original scheduled identity remains separate from prepared arguments.
   */
  const call: NativeCall = {
    type: 'toolCall',
    id: 'one',
    name: 'tool',
    arguments: {}
  };
  /**
   Native preparation may replace its own argument slot.
   */
  const hook: { args: unknown } = { args: {
    path: 'original',
    nested: [1, 2]
  } };
  /**
   Original assessment cancellation identity is deliberately opaque.
   */
  const signal = { original: 'signal' };
  /**
   Native entry is observable before any preparation callback.
   */
  const memberState = { entered: false };
  /**
   Shared admission remains mutable only through original fixture operations.
   */
  const batchState: MemberFixture['batchState'] = { assessmentStarted: false };
  /**
   Readiness insertion order is independent of declared member order.
   */
  const ready = new Map<string, Member>();
  /**
   Declaration order can be extended by multi-member consumer fixtures.
   */
  const scheduled = [call];
  /**
   Original assessment manifests remain observable by identity.
   */
  const snapshots: (readonly unknown[])[] = [];
  /**
   Original opaque failures remain available to completion consumers.
   */
  const failures: unknown[] = [];
  /**
   Lifecycle observations remain local to this fixture.
   */
  const events: string[] = [];
  /**
   Blocking reasons are recorded before the first-decision owner selects one.
   */
  const blockReasons: unknown[] = [];
  /**
   Assessment arguments retain their exact original input objects.
   */
  const assessments: Assessment[] = [];
  /**
   Original group admission can be independently resolved or rejected.
   */
  const gate = Promise.withResolvers<MemberDecision>();
  /**
   Default operations preserve native absence, permission, and input sealing.
   */
  const control: Control = {
    prepare() { return undefined; },
    assess() { return { block: false }; },
    active() { return undefined; },
    seal,
    release() { return undefined; },
  };
  /**
   Model the dispatcher's original first-decision blocking owner.

   @param reason - original opaque block reason
   */
  function block(reason: unknown): void {
    events.push('block');
    blockReasons.push(reason);
    if (batchState.decision === undefined) {
      batchState.decision = Object.freeze({
        block: true,
        reason
      });
      gate.resolve(batchState.decision);
    }
  }
  /**
   Invoke the built native member with original state and independent overrides.

   @param overrides - disposable native dependency substitutions

   @returns original preparation outcome
   */
  function run(overrides: Readonly<Record<string, unknown>> = {}): Promise<unknown> {
    return member.preparePreparedMember({
      hook,
      call,
      memberState,
      batchState,
      ready,
      scheduled,
      snapshots,
      failures,
      serial: false,
      signal,
      gate: { promise: gate.promise, resolve(decision: MemberDecision) {
        events.push('resolve');
        gate.resolve(decision);
      } },
      active(stage: string) {
        events.push(`active:${stage}`);
        return control.active(stage);
      },
      prepare(input: unknown) {
        events.push('prepare');
        return control.prepare(input);
      },
      block,
      sealInput(input: unknown) {
        events.push('seal');
        return control.seal(input);
      },
      releasePreparation() {
        events.push('release');
        return control.release();
      },
      assess(input: Assessment) {
        events.push('assess');
        assessments.push(input);
        return control.assess(input);
      },
      PreparedBatchContractError,
      ...overrides,
    });
  }
  return {
    call,
    hook,
    signal,
    memberState,
    batchState,
    ready,
    scheduled,
    snapshots,
    failures,
    events,
    blockReasons,
    assessments,
    gate,
    control,
    block,
    run
  };
}
//endregion
