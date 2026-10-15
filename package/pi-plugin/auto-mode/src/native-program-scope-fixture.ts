/** Independent consumer contracts expose original native scope and queue operations. @module */

/** Native counters remain mutable across reached groups of one original parent. */
export type ScopeFixtureRecord = {
  recorder: object;
  owner: object;
  nextId: number;
  holdsQueue: boolean;
};

/** Original native queue stores its next pending turn before the current acquisition completes. */
export type ScopeFixtureQueue = { queueTail: Promise<unknown> };

/** Stable native entry is consumed without importing implementation types or helpers. */
type ScopeFixtureModule = Readonly<{
  requireProgramScope: (input: Readonly<{
    runner: Readonly<{ scopes: Map<string | object, ScopeFixtureRecord> }>;
    carrier: Readonly<{ token: object }>;
    parentId: string;
    NestedCallRecorder: new () => object;
  }>) => ScopeFixtureRecord;
  acquireProgramQueue: (runner: ScopeFixtureQueue) => Promise<Disposable>;
}>;

/**
 Require both original operations before invoking the native entry.

 @param value - built native namespace

 @throws Error when original scope or queue operations are unavailable
 */
function assertScopeFixtureModule(value: unknown): asserts value is ScopeFixtureModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('requireProgramScope' in value)) || ((typeof value.requireProgramScope) !== 'function')
    || (!('acquireProgramQueue' in value)) || ((typeof value.acquireProgramQueue) !== 'function'))
    throw new Error('Built original program scope operations are unavailable');
}

/** Original native bridge remains the runner's consumer boundary. */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-runner-scope.mjs',
  import.meta.url,
).href);
assertScopeFixtureModule(loaded);
/** Explicit namespace narrowing remains valid inside delayed test callbacks. */
export const scopeModule: ScopeFixtureModule = loaded;
