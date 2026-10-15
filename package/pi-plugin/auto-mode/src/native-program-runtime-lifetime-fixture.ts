/** Independent reached lifetimes expose original drain snapshots, retention order, and partial retirement. @module */
import assert from 'node:assert/strict';

/** Fixture inspection remains mutable so runtime snapshot ownership can be observed independently. */
type RuntimeLifetimeInspection = { failed: boolean; failure: unknown; original: object };
/** Original child lifetime callbacks preserve their receiver and return identity. */
type RuntimeLifetimeRun = Readonly<{ retire: () => void; drain: () => Promise<unknown>; inspect: () => RuntimeLifetimeInspection }>;
/** Each fixture child independently controls synchronous callback failures and asynchronous work. */
type RuntimeLifetimeEntry = Readonly<{
  run: RuntimeLifetimeRun;
  inspection: RuntimeLifetimeInspection;
  state: { retired: number; drained: number; inspected: number; work: Promise<unknown>; throwAt?: string; failure: unknown; onStep?: (point: string) => void };
}>;
/** Independent runtime lifetime snapshots expose only retained original child observations. */
type RuntimeLifetimeSnapshot = Readonly<{ retainedOnly: true; closed: boolean; reachedGroups: readonly Readonly<{ ordinal: number; collector: RuntimeLifetimeInspection }>[] }>;
/** Original runtime lifetime operations remain independently callable after closure. */
type RuntimeLifetimeOwner = Readonly<{ retire: () => void; drain: () => Promise<void>; inspect: () => RuntimeLifetimeSnapshot }>;
/** Guard retention keeps original program and failure identities at each callback. */
type RuntimeLifetimeFailure = Readonly<{ program: object; error: unknown }>;
/** Independent constructor contract avoids importing production lifetime declarations. */
type RuntimeLifetimeModule = Readonly<{ createProgramRuntimeLifetime: (input: Readonly<{
  judgment: Readonly<{ markProgramGuard: (input: RuntimeLifetimeFailure) => Error; inspectProgram: (program: object) => Readonly<{ guardFailures: readonly Error[] }> }>;
  program: object;
  lifetime: { closed: boolean };
  reached: ReadonlyMap<number, Readonly<{ run: RuntimeLifetimeRun }>>;
}>) => RuntimeLifetimeOwner }>;
/** Fixture exposes original map mutation and independently controlled guard history. */
type RuntimeLifetimeFixture = Readonly<{
  program: object;
  lifetime: { closed: boolean };
  reached: Map<number, RuntimeLifetimeEntry>;
  events: string[];
  marked: RuntimeLifetimeFailure[];
  guards: Error[];
  control: { throwAt?: string; failure: unknown };
  owner: RuntimeLifetimeOwner;
  add: (ordinal: number) => RuntimeLifetimeEntry;
  entry: (ordinal: number) => RuntimeLifetimeEntry;
}>;
/** Require the original built lifetime owner before exercising callback and publication ordering.
 @param value - built native namespace
 @returns independently declared original lifetime constructor
 @throws Error when the original lifetime owner is absent
 */
function assertRuntimeLifetimeModule(value: unknown): asserts value is RuntimeLifetimeModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('createProgramRuntimeLifetime' in value))
    || ((typeof value.createProgramRuntimeLifetime) !== 'function')) throw new Error('Built original runtime lifetime is unavailable');
}
/** Dynamic built loading keeps fixture contracts separate from production declarations. */
const loaded: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-runtime-lifetime.ts', import.meta.url).href);
assertRuntimeLifetimeModule(loaded);
/** Explicit narrowing survives delayed construction of independent lifetime fixtures. */
const lifetimeModule: RuntimeLifetimeModule = loaded;

//region Fixture children and judgment callbacks retain separate original failure and closure ownership.
/** Construct independently controlled reached lifetimes and original guard-retention callbacks.
 @returns original runtime lifetime with mutable fixture-owned child work and inspection
 @example createRuntimeLifetimeFixture();
 */
export function createRuntimeLifetimeFixture(): RuntimeLifetimeFixture {
  /** Original program identity remains distinct from child lifetime objects. */
  const program = Object.freeze({ original: 'program' });
  /** Shared closure flag can be inspected from original child retirement callbacks. */
  const lifetime = { closed: false };
  /** Original map insertion order remains independently mutable during asynchronous draining. */
  const reached = new Map<number, RuntimeLifetimeEntry>();
  /** Callback order is measured independently of runtime diagnostics. */
  const events: string[] = [];
  /** Guard observations retain the exact original failure values. */
  const marked: RuntimeLifetimeFailure[] = [];
  /** Existing guard history can precede newly retained drain and inspection failures. */
  const guards: Error[] = [];
  /** Judgment callbacks can throw opaque values without normalization. */
  const control: RuntimeLifetimeFixture['control'] = { failure: Object.freeze({ original: 'judgment failure' }) };
  /** Add an independently controlled child in original insertion order.
   @param ordinal - original source group ordinal
   @returns newly retained fixture child lifetime
   */
  function add(ordinal: number): RuntimeLifetimeEntry {
    /** Child work and callback failures remain independently controlled. */
    const state: RuntimeLifetimeEntry['state'] = { retired: 0, drained: 0, inspected: 0, work: Promise.resolve(), failure: Object.freeze({ original: 'child failure', ordinal }) };
    /** Caller-owned inspection must not be frozen or copied by the outer runtime. */
    const inspection = { failed: false, failure: undefined, original: Object.freeze({ ordinal }) } satisfies RuntimeLifetimeInspection;
    /** Observe one child callback before its independent publication or failure.
     @param point - original child boundary
     @throws Error when the fixture selects a failing child callback
     */
    function step(point: string): void { 
      events.push(`${ordinal}:${point}`); 
      state.onStep?.(point); 
      if (state.throwAt === point) throw state.failure; 
    }
    /** Original child callbacks retain their receiver even when the runtime extracts map entries. */
    const run = {
      retire(): void { 
        assert.equal(this, run); 
        assert.equal(lifetime.closed, true); 
        state.retired++; 
        step('retire'); 
      },
      drain(): Promise<unknown> { 
        assert.equal(this, run); 
        state.drained++; 
        step('drain'); 
        return state.work; 
      },
      inspect(): RuntimeLifetimeInspection { 
        assert.equal(this, run); 
        state.inspected++; 
        step('inspect'); 
        return inspection; 
      },
    };
    /** Entry retains the exact original callback owner and mutable inspection object. */
    const entry = { run, inspection, state };
    reached.set(ordinal, entry);
    return entry;
  }
  /** Read one independently registered original group.
   @param ordinal - original source group ordinal
   @returns exact fixture-owned entry
   */
  function entry(ordinal: number): RuntimeLifetimeEntry {
    const result = reached.get(ordinal);
    assert.ok(result);
    return result;
  }
  add(7);
  add(2);
  /** Original judgment methods preserve their receiver and exact program argument. */
  const judgment = {
    markProgramGuard(input: RuntimeLifetimeFailure): Error {
      assert.equal(this, judgment);
      assert.equal(input.program, program);
      marked.push(input);
      events.push('mark');
      if (control.throwAt === 'mark') throw control.failure;
      const guard = new Error(`original guard ${guards.length}`);
      guards.push(guard);
      return guard;
    },
    inspectProgram(original: object): Readonly<{ guardFailures: readonly Error[] }> {
      assert.equal(this, judgment);
      assert.equal(original, program);
      events.push('inspect-program');
      if (control.throwAt === 'inspect-program') throw control.failure;
      return { guardFailures: guards };
    },
  };
  /** Construction itself does not retire, drain, inspect, or mark any original child. */
  const owner = lifetimeModule.createProgramRuntimeLifetime({ judgment, program, lifetime, reached });
  return { program, lifetime, reached, events, marked, guards, control, owner, add, entry };
}
//endregion
