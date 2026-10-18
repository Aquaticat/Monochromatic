/**
 Independent built-consumer contracts describe original program ownership without importing source types. @module
 */

/**
 Original declarations retain source identity and complete source-group order.
 */
export type FixtureProgramDeclaration = Readonly<{
  source: string;
  groups: readonly Readonly<{
    ordinal: number;
    members: readonly Readonly<{ name: string }>[]
  }>[];
  sites: readonly Readonly<{ name: string }>[];
}>;

/**
 Original native child inputs remain frozen independently of the owner's handles.
 */
export type FixtureProgramMember = Readonly<{
  id: string;
  name: string;
  input: Readonly<Record<string, unknown>>;
}>;

/**
 Fixture execution state is controlled independently from native return shape.
 */
export type FixtureProgramExecution = {
  readonly token: object;
  state: 'active' | 'returned';
  readonly origin: Readonly<{ signal: AbortSignal }>;
};

/**
 Prepared inspection retains original member, input, and source declaration identities.
 */
export type FixturePreparedProgram = Readonly<{
  kind: string;
  member: object;
  prepared: FixtureProgramMember;
  declaration: FixtureProgramDeclaration;
  permission: boolean;
}>;

/**
 Fixture-owned records expose only original parent and child state needed by the injected owner callbacks.
 */
export type FixtureProgramRecord = {
  readonly prepared: FixtureProgramMember;
  readonly parent?: object;
  readonly effectiveSignal: AbortSignal;
  readonly group?: object;
  execution?: FixtureProgramExecution;
  preparedProgram?: Readonly<{
    view: FixturePreparedProgram;
    assertCurrent: () => void
  }>;
  program?: {
    readonly handle: object;
    readonly groups: readonly Readonly<{ handle: object }>[];
    status: string;
    failure?: unknown;
  };
};

/**
 Reached views retain complete materialized arguments before native binding.
 */
export type FixtureReachedGroup = Readonly<{
  handle: object;
  ordinal: number;
  declaration: FixtureProgramDeclaration;
  members: readonly Readonly<{
    name: string;
    args: Readonly<Record<string, unknown>>;
    argsJSON: string;
  }>[];
}>;

/**
 Original native call data stays independently inspectable in the fixture.
 */
export type FixtureProgramCall = Readonly<{
  type: 'toolCall';
  id: string;
  name: string;
  arguments: Readonly<Record<string, unknown>>;
}>;

/**
 Native outcomes remain mutable to verify conversion and producer receipts retain original values.
 */
export type FixtureProgramOutcome = {
  readonly toolCall: Readonly<{
    id: string;
    name: string
  }>;
  isError: boolean;
  result: {
    content: Readonly<{
      type: string;
      text: string
    }>[];
    structuredContent?: unknown;
  };
};

/**
 Retained diagnostics remain separate from current-use eligibility.
 */
export type FixtureGroupInspection = Readonly<{
  retainedOnly: boolean;
  ordinal: number;
  state: string;
  failure: unknown;
  members: readonly Readonly<{
    id: string;
    state: string
  }>[];
  nativeReturns: readonly Readonly<{
    state: string;
    conversionCount: number
  }>[];
}>;

/**
 Original public methods accept malformed test inputs without borrowing implementation declarations.
 */
export type FixtureProgramOwner = Readonly<{
  bindPreparedProgram: (input: Readonly<Record<string, unknown>>) => FixturePreparedProgram;
  preparedProgramFor: (member: unknown) => unknown;
  openProgram: (input: Readonly<Record<string, unknown>>) => object;
  programFor: (program: unknown) => Readonly<{
    declaration: FixtureProgramDeclaration;
    parent: object;
    judgment: object;
    response: object;
    stream: object;
    permission: string;
  }>;
  reachProgramGroup: (input: Readonly<Record<string, unknown>>) => FixtureReachedGroup;
  reachedGroupFor: (group: unknown) => FixtureReachedGroup;
  bindProgramCalls: (input: Readonly<Record<string, unknown>>) => readonly Readonly<{ open: (call: FixtureProgramCall) => Readonly<{ complete: (outcome: unknown) => unknown; fail: (error: unknown) => void }> }>[];
  prepareReachedMembers: (input: Readonly<Record<string, unknown>>) => readonly object[];
  scriptValueFor: (input: Readonly<Record<string, unknown>>) => string;
  markProgramGuard: (input: Readonly<Record<string, unknown>>) => Error;
  inspectReachedGroup: (group: unknown) => FixtureGroupInspection;
  inspectProgram: (program: unknown) => Readonly<{
    retainedOnly: boolean;
    status: string;
    failure: unknown;
    declaration?: FixtureProgramDeclaration;
    producerValueReady: boolean;
    guardFailures: readonly Error[];
    groups: readonly FixtureGroupInspection[];
  }>;
}>;

/**
 Built native namespace supplies every behavior under test.
 */
export type FixtureProgramModule = Readonly<{
  createJudgmentPrograms: (input: Readonly<Record<string, unknown>>) => FixtureProgramOwner;
}>;

/**
 Fixture state permits exact failures without mutating any shared or installed state.
 */
export type FixtureProgramState = {
  readyFailure?: Error;
  dependencyFailure?: Error;
  toolFailure?: Error;
  judgmentFailure?: Error;
  operationFailure?: Readonly<{
    callback: string;
    error: Error
  }>;
};

/**
 Original fixture capabilities and state support direct owner boundary assertions.
 */
export type ProgramOwnerFixture = Readonly<{
  owner: FixtureProgramOwner;
  input: Readonly<Record<string, unknown>>;
  declaration: FixtureProgramDeclaration;
  member: object;
  record: FixtureProgramRecord;
  judgment: object;
  response: object;
  stream: object;
  parent: AbortController;
  controller: AbortController;
  state: FixtureProgramState;
  events: string[];
  bindings: WeakMap<object, FixtureProgramRecord>;
  childGroups: object[];
  assertCurrent: () => void;
  begin: () => object;
  open: () => object;
}>;
