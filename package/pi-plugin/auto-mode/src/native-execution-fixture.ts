/**
 Independent native execution fixtures exercise the built owner with disposable member records. @module
 */

/**
 Original prepared data remains independently owned by the consumer.
 */
export type ExecutionFixtureMember = Readonly<{
  id: string;
  name: string;
  input: Readonly<Record<string, unknown>>;
}>;

/**
 Consumer-visible native origin preserves every enclosing identity.
 */
export type ExecutionFixtureOrigin = Readonly<{
  judgment: object;
  response: object;
  stream: object;
  signal: AbortSignal;
  member: object;
  prepared: ExecutionFixtureMember;
  permission: string;
}>;

/**
 Shared fixture records expose original publication and terminal mutation.
 */
export type ExecutionFixtureRecord = {
  readonly prepared: ExecutionFixtureMember;
  readonly parent?: object;
  readonly effectiveSignal: AbortSignal;
  execution?: {
    readonly token: object;
    state: 'active' | 'returned';
    readonly origin: ExecutionFixtureOrigin;
  };
};

/**
 Independent public surface admits malformed values for real owner rejection tests.
 */
type ExecutionFixtureOwner = Readonly<{
  memberFor: (id: unknown) => object;
  knownMember: (member: unknown) => ExecutionFixtureRecord;
  knownExecution: (token: unknown) => ExecutionFixtureRecord;
  parentCurrent: (record: ExecutionFixtureRecord) => void;
  beginExecution: (member: unknown) => object;
  assertExecutionEntry: (token: unknown) => void;
  executionEntryFor: (token: unknown) => ExecutionFixtureOrigin;
  executionFor: (token: unknown) => ExecutionFixtureOrigin;
  finishExecution: (token: unknown) => void;
  inspectExecution: (token: unknown) => Readonly<{
    retainedOnly: boolean;
    state: string
  }>;
}>;

/**
 Built namespace supplies all original execution behavior under test.
 */
type ExecutionFixtureModule = Readonly<{
  createJudgmentExecutions: (input: Readonly<Record<string, unknown>>) => ExecutionFixtureOwner;
}>;

/**
 Authenticate the built owner before supplying independent original capabilities.

 @param value - unknown built native namespace

 @returns assertion exposing the built execution owner

 @throws Error when the built execution owner is absent
 */
function assertExecutionModule(value: unknown): asserts value is ExecutionFixtureModule {
  if ((value === null) || (typeof value) !== 'object'
    || (!('createJudgmentExecutions' in value))
    || (typeof value.createJudgmentExecutions) !== 'function') throw new Error('Built native execution owner is unavailable');
}

/**
 Native execution is imported from the rebuilt artifact used by the real judgment.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/execution-owner.ts',
  import.meta.url
).href);
assertExecutionModule(loaded);
/**
 Narrowed callable remains available to independently constructed fixture functions.
 */
const createExecutionOwner: ExecutionFixtureModule['createJudgmentExecutions'] = loaded.createJudgmentExecutions;

/**
 Construct an independent prepared root and mutable eligibility controls.

 @returns disposable original execution consumer

 @example const fixture = createExecutionFixture();
 */
export function createExecutionFixture(): ExecutionFixture {
  /**
   Original root signal remains independent from child-specific cancellation.
   */
  const controller = new AbortController();
  /**
   Independent enclosing identities must survive every native lookup unchanged.
   */
  const judgment = Object.freeze({});
  /**
   Original response identity is distinct from the judgment and stream.
   */
  const response = Object.freeze({});
  /**
   Original stream identity is distinct from the response.
   */
  const stream = Object.freeze({});
  /**
   Opaque root membership is independent of its declared identifier.
   */
  const member = Object.freeze({});
  /**
   Original prepared content is frozen before the owner receives it.
   */
  const prepared = Object.freeze({
    id: 'root',
    name: 'eval',
    input: Object.freeze({ code: 'return 1;' })
  });
  /**
   The real owner publishes and mutates this same fixture-owned record.
   */
  const record: ExecutionFixtureRecord = {
    prepared,
    effectiveSignal: controller.signal
  };
  /**
   Shared record custody is populated independently of native entry.
   */
  const bindings = new WeakMap<object, ExecutionFixtureRecord>([[
    member,
    record
  ]]);
  /**
   Declared identifiers select original handles without synthesizing them.
   */
  const byMember = new Map([[
    'root',
    member
  ]]);
  /**
   Events expose callback order, including checks that should never run after retirement.
   */
  const events: string[] = [];
  /**
   Closure and dependency failures can be changed without touching the production artifact.
   */
  const state: {
    finished: boolean;
    closeFailed: boolean;
    dependencyFailure?: Error;
    judgmentFailure?: Error;
  } = {
    finished: false,
    closeFailed: false
  };
  /**
   Observe original dependency reads and inject exact failure identities.
   */
  function assertDependenciesCurrent(): void {
    events.push('dependencies');
    if (state.dependencyFailure) throw state.dependencyFailure;
  }
  /**
   Supply closure flags independently of original source currentness.

   @returns current evidence-closure flags
   */
  function readClosure(): Readonly<{
    finished: boolean;
    closeFailed: boolean
  }> {
    events.push('closure');
    return {
      finished: state.finished,
      closeFailed: state.closeFailed
    };
  }
  /**
   Retain the original judgment identity at successful reservation.

   @returns original judgment
   */
  function readJudgment(): object {
    events.push('judgment');
    if (state.judgmentFailure) throw state.judgmentFailure;
    return judgment;
  }
  /**
   Independent host capabilities are supplied to the built native owner.
   */
  const input = {
    bindings,
    byMember,
    readClosure,
    readJudgment,
    response,
    stream,
    assertDependenciesCurrent
  };
  /**
   Every tested operation is implemented by the built artifact.
   */
  const owner = createExecutionOwner(input);
  return {
    owner,
    controller,
    judgment,
    response,
    stream,
    member,
    record,
    bindings,
    byMember,
    events,
    state,
    input
  };
}

/**
 Independent fixture contracts stay derived from consumer data rather than implementation declarations.
 */
export type ExecutionFixture = Readonly<{
  owner: ExecutionFixtureOwner;
  controller: AbortController;
  judgment: object;
  response: object;
  stream: object;
  member: object;
  record: ExecutionFixtureRecord;
  bindings: WeakMap<object, ExecutionFixtureRecord>;
  byMember: Map<string, object>;
  events: string[];
  state: {
    finished: boolean;
    closeFailed: boolean;
    dependencyFailure?: Error;
    judgmentFailure?: Error;
  };
  input: Readonly<Record<string, unknown>>;
}>;
