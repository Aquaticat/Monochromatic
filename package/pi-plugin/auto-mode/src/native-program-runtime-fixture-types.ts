/**
 Independent program-runtime consumers define original source, group, and callback observations. @module
 */

/**
 Declared fixture sites retain source group and member order without importing parser declarations.
 */
export type RuntimeFixtureSite = Readonly<{
  group: number;
  ordinal: number;
  alias: string
}>;
/**
 Original native callback arguments remain independently supplied fixture data.
 */
export type RuntimeFixtureArguments = Readonly<{ site: string }>;
/**
 Reached members preserve exact serialized original native arguments.
 */
export type RuntimeFixtureMember = RuntimeFixtureSite & Readonly<{
  args: RuntimeFixtureArguments;
  argsJSON: string
}>;
/**
 Original source declaration is a stable identity captured before runtime publication.
 */
export type RuntimeFixtureDeclaration = Readonly<{
  source: string;
  sites: readonly RuntimeFixtureSite[]
}>;
/**
 Independently frozen reached views retain exact source and complete member association.
 */
export type RuntimeFixtureView = Readonly<{
  handle: object;
  declaration: RuntimeFixtureDeclaration;
  members: readonly RuntimeFixtureMember[]
}>;
/**
 Native script conversion retains the exact original group, ordinal, and outcome.
 */
export type RuntimeFixtureValue = Readonly<{
  group: object;
  ordinal: number;
  outcome: unknown
}>;
/**
 Complete-group consumer inputs retain original member association and cancellation.
 */
export type RuntimeFixtureCall = Readonly<{
  handle: object;
  declaration: Readonly<{
    source: string;
    members: readonly RuntimeFixtureMember[]
  }>;
  members: readonly Readonly<{
    handle: object;
    declaration: RuntimeFixtureMember;
    signal: AbortSignal
  }>[];
}>;
/**
 Collector inspection remains opaque except for independently asserted retained transport fields.
 */
export type RuntimeFixtureCollectorInspection = Readonly<{
  failed: boolean;
  failure: unknown;
  phase: string;
  members: readonly Readonly<{
    arrival: string;
    state: string;
    completion: unknown
  }>[];
}>;
/**
 Runtime snapshots expose insertion-ordered original retained groups and closure.
 */
export type RuntimeFixtureInspection = Readonly<{
  retainedOnly: true;
  closed: boolean;
  reachedGroups: readonly Readonly<{
    ordinal: number;
    collector: RuntimeFixtureCollectorInspection
  }>[];
}>;
/**
 Original public tool objects are the runtime's source-membership keys.
 */
export type RuntimeFixtureTool = Readonly<{
  name: string;
  execute: (
    args: unknown,
    context: unknown
  ) => Promise<unknown>
}>;
/**
 Independent native consumer exercises only the runtime's observable public operations.
 */
export type RuntimeFixtureRun = Readonly<{
  declaration: RuntimeFixtureDeclaration;
  tools: readonly RuntimeFixtureTool[];
  valueFor: (input: Readonly<{
    tool: unknown;
    outcome: unknown
  }>) => unknown;
  retire: () => void;
  drain: () => Promise<void>;
  inspect: () => RuntimeFixtureInspection;
}>;
/**
 Retained program failures preserve original input and opaque caller-selected guard identity.
 */
export type RuntimeFixtureFailure = Readonly<{
  program: object;
  error: unknown
}>;
/**
 Fixture controls can fail or publish state at exact original callback boundaries.
 */
export type RuntimeFixtureControl = {
  programView: unknown;
  views: Map<number, unknown>;
  currentViews: Map<object, unknown>;
  failAt?: string;
  failure: unknown;
  value: unknown;
  onStep?: (point: string) => void;
};
/**
 Fixture retains independently authored source, native completions, and judgment observations.
 */
export type ProgramRuntimeFixture = Readonly<{
  program: object;
  declaration: RuntimeFixtureDeclaration;
  views: readonly RuntimeFixtureView[];
  parent: AbortController;
  native: readonly AbortController[];
  calls: RuntimeFixtureCall[];
  converted: RuntimeFixtureValue[];
  marked: RuntimeFixtureFailure[];
  guard: Error;
  guards: Error[];
  events: string[];
  control: RuntimeFixtureControl;
  input: Readonly<Record<string, unknown>>;
  run: RuntimeFixtureRun;
  tool: (index?: number) => RuntimeFixtureTool;
  invoke: (index?: number) => Promise<unknown>;
  completions: (ordinal?: number) => readonly PromiseWithResolvers<unknown>[];
}>;
/**
 Dynamic runtime namespace remains independent of production type declarations.
 */
export type RuntimeFixtureModule = Readonly<{
  createReachedProgramRun: (input: Readonly<Record<string, unknown>>) => RuntimeFixtureRun;
  ReachedProgramRuntimeError: new (message: string) => Error;
}>;
