/**
 Independent declared-program consumers own runtime, binding, and execution observations. @module
 */
/**
 Member transports preserve opaque native outcomes and explicit rejection callbacks.
 */
export type FacadeFixtureTicket = Readonly<{
  promise: Promise<unknown>;
  reject: (error: unknown) => void
}>;
/**
 Native result slot association remains caller-owned and independently replaceable.
 */
export type FacadeFixtureBinding = {
  slots: object[];
  tickets: FacadeFixtureTicket[]
};
/**
 Runtime receives only original owner capabilities and reached-group callbacks.
 */
export type FacadeFixtureRuntimeInput = Readonly<{
  judgment: object;
  program: object;
  signal: AbortSignal;
  assertParentCurrent: () => unknown;
  dispatchGroup: (group: Readonly<{ handle: object }>) => readonly Promise<unknown>[];
  scriptValueFor: (input: Readonly<{ group: object; ordinal: number; outcome: unknown }>) => unknown
}>;
/**
 Fixture runtime publication keeps opaque objects and methods for spread identity checks.
 */
export type FacadeFixtureRun = Readonly<{
  declaration: object;
  tools: readonly object[];
  inspect: () => unknown;
  retire: () => void;
  valueFor: (input: unknown) => unknown;
  drain: () => Promise<void>
}>;
/**
 Independent module surface never imports implementation contracts.
 */
export type FacadeFixtureModule = Readonly<{
  createDeclaredProgramFacade: (input: Readonly<Record<string, unknown>>) => FacadeFixtureRun;
}>;
/**
 Callback controls expose synchronous throws and asynchronous completion separately.
 */
export type FacadeFixtureControl = {
  failAt?: string;
  failure: unknown;
  onStep?: (point: string) => void;
  execution?: () => Promise<void>;
  drain?: () => Promise<void>
};
/**
 Fixture input preserves original judgment receiver and parent metadata.
 */
export type FacadeFixtureInput = {
  tools: unknown;
  code: unknown;
  carrier: Readonly<{ token: object }>;
  origin: {
    prepared: { id: string; name: string; input: { code: unknown } };
    signal: AbortSignal;
    judgment: Readonly<{ openProgram: (input: unknown) => object; scriptValueFor: (input: unknown) => unknown }>;
  };
  assertParentCurrent: () => void;
  bindGroup: (input: unknown) => FacadeFixtureBinding;
  executeGroup: (input: unknown) => Promise<void>;
  createReachedProgramRun: (input: FacadeFixtureRuntimeInput) => FacadeFixtureRun;
  NativeExecutionGuardError: new (input: Readonly<Record<string, unknown>>) => Error
};
/**
 Every test owns isolated work, callback failures, and member transports.
 */
export type RunnerFacadeFixture = Readonly<{
  input: FacadeFixtureInput;
  steps: string[];
  observations: unknown[][];
  control: FacadeFixtureControl;
  program: object;
  bound: FacadeFixtureBinding;
  runtime: FacadeFixtureRun;
  value: object;
  create: () => FacadeFixtureRun;
  runtimeInput: () => FacadeFixtureRuntimeInput
}>;
