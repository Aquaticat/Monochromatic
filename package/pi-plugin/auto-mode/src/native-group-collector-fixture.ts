/**
 Independent collector consumers own original arguments, cancellation, and native completions. @module
 */
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';

/**
 Source members expose only fields the original collector consumes.
 */
type CollectorFixtureMember = Readonly<{
  ordinal: number;
  alias: string;
  argsJSON: string
}>;
/**
 Independent reached view preserves original group and frozen member identities.
 */
type CollectorFixtureView = Readonly<{
  handle: object;
  declaration: Readonly<{ source: string }>;
  members: readonly CollectorFixtureMember[]
}>;
/**
 Consumer call retains original source association and combined native signals.
 */
type CollectorFixtureCall = Readonly<{
  handle: object;
  declaration: Readonly<{
    source: string;
    members: readonly CollectorFixtureMember[]
  }>;
  members: readonly Readonly<{
    handle: object;
    declaration: CollectorFixtureMember;
    signal: AbortSignal
  }>[];
}>;
/**
 Independent inspection records observable transport and retained native outcomes.
 */
type CollectorFixtureInspection = Readonly<{
  phase: string;
  phaseAtReturn: unknown;
  failed: boolean;
  failure: unknown;
  failures: readonly Readonly<{
    error: unknown;
    at: string;
    ordinal: number
  }>[];
  dispatches: number;
  unboundPending: number;
  unboundOutcomes: readonly unknown[];
  members: readonly Readonly<{
    ordinal: number;
    arrival: string;
    state: string;
    completion: unknown
  }>[];
  executionState: string;
  effectQualification: string;
}>;
/**
 Native tools retain their original externally dictated argument and context signature.
 */
type CollectorFixtureRun = Readonly<{
  declaration: Readonly<{
    source: string;
    members: readonly CollectorFixtureMember[]
  }>;
  tools: readonly Readonly<{
    name: string;
    execute: (
      args: unknown,
      context: unknown
    ) => Promise<unknown>
  }>[];
  retire: () => void;
  drain: () => Promise<void>;
  inspect: () => CollectorFixtureInspection;
}>;
/**
 Permissive constructor input permits direct invalid-capability probes at the consumer boundary.
 */
type CollectorFixtureModule = Readonly<{ createReachedGroupRun: (input: Readonly<Record<string, unknown>>) => CollectorFixtureRun }>;
/**
 Fixture controls publish cancellation or callback failures at exact original reader boundaries.
 */
type CollectorFixtureControl = {
  view: CollectorFixtureView;
  reads: number;
  parents: number;
  read?: () => void;
  parent?: () => void;
  consume?: (input: CollectorFixtureCall) => unknown;
};
/**
 Complete fixture preserves caller-owned capabilities independently of the built collector.
 */
type CollectorFixture = Readonly<{
  group: object;
  view: CollectorFixtureView;
  input: Readonly<Record<string, unknown>>;
  parent: AbortController;
  native: readonly AbortController[];
  args: readonly Readonly<{
    path: string;
    mode: string
  }>[];
  completions: readonly PromiseWithResolvers<unknown>[];
  calls: CollectorFixtureCall[];
  events: string[];
  control: CollectorFixtureControl;
  run: CollectorFixtureRun;
  invoke: (input?: Readonly<{
    index?: number;
    args?: unknown;
    signal?: unknown
  }>) => Promise<unknown>;
}>;
/** Require the built collector before exercising original construction and arrival.
 @param value - built native namespace
 
 @returns independently declared original collector boundary
 
 @throws Error when the original collector factory is unavailable
 */
function assertCollectorModule(value: unknown): asserts value is CollectorFixtureModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createReachedGroupRun' in value))
    || ((typeof value.createReachedGroupRun) !== 'function')) throw new Error('Built original group collector is unavailable');
}
/**
 Dynamic built loading prevents production types from prescribing fixture expectations.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-collector.mjs',
  import.meta.url
).href);
assertCollectorModule(loaded);
/**
 Independent namespace remains available for direct invalid-constructor consumer probes.
 */
export const collectorFixtureModule: CollectorFixtureModule = loaded;

//region Independent callbacks expose exact original arrival, reader, and native completion ordering.
/** Require an installed original abort callback before testing its retained guards.
 @param value - independently inspected native event listener
 
 @returns narrowed original callable identity
 
 @throws Error when the expected original abort listener is absent
 */
function assertAbortListener(value: unknown): asserts value is () => void {
  if ((typeof value) !== 'function') throw new Error('Original abort listener is unavailable');
}
/** Capture the actual installed callback without replacing native event delivery.
 @param signal - fixture-owned original native signal
 
 @returns original installed callback identity
 
 @example originalCollectorAbortListener(signal);
 */
export function originalCollectorAbortListener(signal: AbortSignal): () => void {
  /**
   Node inspection returns the actual listener installed on this disposable original signal.
   */
  const listener: unknown = getEventListeners(
    signal,
    'abort'
  )[0];
  assertAbortListener(listener);
  return listener;
}
/** Create original native inputs whose lifetimes remain controlled by the consumer.
 @param memberCount - declared original native member cardinality
 
 @param startAborted - whether original parent cancellation precedes construction
 
 @returns built collector and independent original input capabilities
 
 @example createCollectorFixture();
 */
export function createCollectorFixture({
  memberCount = 2,
  startAborted = false
}: Readonly<{
  memberCount?: number;
  startAborted?: boolean
}> = {}): CollectorFixture {
  /**
   Original reached group is independently allocated before the frozen view exists.
   */
  const group = Object.freeze({ original: 'group' });
  /**
   Argument key order remains part of the original native serialization comparison.
   */
  const args = Array.from(
    { length: memberCount },
    function argumentsForMember(
      _unused,
      ordinal
    ) { 
    return Object.freeze({
      path: `member-${ordinal}`,
      mode: 'read'
    }); 
  }
  );
  /**
   Native callback aliases and ordinal association are independent fixture data.
   */
  const members = Object.freeze(args.map(function originalMember(
    value,
    ordinal
  ) { 
    return Object.freeze({
      ordinal,
      alias: `original-${ordinal}`,
      argsJSON: JSON.stringify(value)
    }); 
  }));
  /**
   Frozen original reached view retains original source and complete member association.
   */
  const view = Object.freeze({
    handle: group,
    declaration: Object.freeze({ source: 'original fixture source' }),
    members
  });
  /**
   Parent cancellation remains distinct from every original native member signal.
   */
  const parent = new AbortController();
  if (startAborted) parent.abort('original pre-construction cancellation');
  /**
   Every native member owns an independently controllable cancellation source.
   */
  const native = args.map(function originalCancellation() { 
    return new AbortController(); 
  });
  /**
   Every native outcome can settle independently after transport delivery closes.
   */
  const completions = args.map(function originalCompletion() { 
    return Promise.withResolvers<unknown>(); 
  });
  /**
   Actual complete-group calls remain independently observable.
   */
  const calls: CollectorFixtureCall[] = [];
  /**
   Callback events expose construction and parent-reader ordering.
   */
  const events: string[] = [];
  /**
   Mutable controls permit original callbacks to publish new state during arrival.
   */
  const control: CollectorFixtureControl = {
    view,
    reads: 0,
    parents: 0
  };
  /**
   Original input capabilities are preserved for direct constructor failure probes.
   */
  const input = {
    group,
    signal: parent.signal,
    readGroup(original: object): CollectorFixtureView {
      assert.equal(
        this,
        undefined
      );
      assert.equal(
        original,
        group
      );
      events.push('read');
      control.reads++;
      control.read?.();
      return control.view;
    },
    assertParentCurrent(): void {
      assert.equal(
        this,
        undefined
      );
      events.push('parent');
      control.parents++;
      control.parent?.();
    },
    dispatchGroup(call: CollectorFixtureCall): unknown {
      assert.equal(
        this,
        undefined
      );
      events.push('consumer');
      calls.push(call);
      if (control.consume) return control.consume(call);
      return completions.map(function issuedCompletion(completion) { 
        return completion.promise; 
      });
    },
  };
  /**
   Original construction observes the original reached view exactly once.
   */
  const run = collectorFixtureModule.createReachedGroupRun(input);
  /** Invoke the original selected tool with independent arguments and cancellation.
   @param index - declared member ordinal
   
   @param args - optional replacement native arguments
   
   @param signal - optional replacement native cancellation input
   
   @returns original transport delivery result
   */
  async function invoke({
    index = 0,
    args: suppliedArgs = args[index],
    signal = native[index]
      ?.signal
  }: Readonly<{
    index?: number;
    args?: unknown;
    signal?: unknown
  }> = {}): Promise<unknown> {
    /**
     Original callback identity is selected only from the built frozen tool array.
     */
    const tool = run.tools[index];
    assert.ok(tool);
    return await tool.execute(
      suppliedArgs,
      { signal }
    );
  }
  return {
    group,
    view,
    input,
    parent,
    native,
    args,
    completions,
    calls,
    events,
    control,
    run,
    invoke
  };
}
//endregion
