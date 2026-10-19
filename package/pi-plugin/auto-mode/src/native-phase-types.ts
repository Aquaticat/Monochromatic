/**
 Shared contracts for the native phase catalog.

 Mode plans, observation counters, and live fixture state stay typed here; SDK
 tool shapes come from the installed SDK's published declarations, which are
 source-audited ABI evidence distinct from any runtime check. @module
 */
import type {
  AgentSession,
  AgentToolResult,
  createBashToolDefinition,
  defineTool,
  ToolDefinition
} from '@earendil-works/pi-coding-agent';

//region Named catalog modes keep every native phase branch addressable.

/**
 Named fixture modes each drive one native phase branch.
 */
export type NativePhaseMode =
  | 'parallel'
  | 'sequential'
  | 'implicit-sequential'
  | 'invalid'
  | 'before-block'
  | 'tool-error'
  | 'deny'
  | 'cancel'
  | 'notification-context'
  | 'notification-turn'
  | 'notification-followup'
  | 'notification-primary'
  | 'notification-primary-turn'
  | 'notification-primary-followup'
  | 'steer-user'
  | 'steer-primary'
  | 'policy-change'
  | 'policy-primary';

/**
 Notification delivery options the real session receives.
 */
export type NativePhaseNotificationDelivery = Readonly<{
  triggerTurn: boolean;
  deliverAs?: 'steer' | 'followUp';
}>;

/**
 Mode facts derived once so each strict branch reads one shared expectation.
 */
export type NativePhasePlan = Readonly<{
  requestedMode: string;
  mode: NativePhaseMode;
  notification: boolean;
  notificationPrimary: boolean;
  steering: boolean;
  withheld: boolean;
  cancel: boolean;
  sequentialExecution: boolean;
  implicitSequential: boolean;
  expectedExecutions: number;
  expectedAttempts: number;
  expectedPrepares: number;
  expectedMaximumActive: number;
  ids: readonly string[];
  expectedBeforeIds: readonly string[];
  notificationDelivery: NativePhaseNotificationDelivery;
}>;

//endregion

//region Mutable fixture counters and state stay owned by the running catalog.

/**
 Counters recorded by fixture callbacks and asserted exactly at the end.
 */
export type NativePhaseObservations = {
  assessments: number;
  httpCalls: number;
  attempts: number;
  selections: number;
  executions: number;
  active: number;
  maximumActive: number;
};

/**
 Deferred native update completion retained per tool call identifier.
 */
export type NativePhaseUpdateDeferred = PromiseWithResolvers<void>;

/**
 Live fixture state shared by callbacks and transport.
 */
export type NativePhaseState = {
  abortTask?: Promise<void>;
  updates: Map<string, NativePhaseUpdateDeferred>;
  authoredUpdates: Set<unknown>;
  sawNotification: boolean;
  sawSteering: boolean;
  followupProposed: boolean;
};

/**
 Terminal summary keeps the original printed field set and order.
 */
export type NativePhaseSummary = Readonly<{
  complete: true;
  mode: string;
  assessments: number;
  httpCalls: number;
  attempts: number;
  selections: number;
  executions: number;
  active: number;
  maximumActive: number;
  events: readonly string[];
}>;

/**
 Session event handler shape taken from the original SDK subscription.
 */
export type SessionEventHandler = Parameters<AgentSession['agent']['subscribe']>[0];

//endregion

//region SDK declarations back the wrapped bash tool and hook shapes.

/**
 Original bash execute parameters retained from the installed SDK declaration.
 */
export type OriginalBashParameters = Parameters<ReturnType<typeof createBashToolDefinition>['execute']>;

/**
 Original bash execute signature retained from the installed SDK declaration.
 */
export type OriginalBashExecute = ReturnType<typeof createBashToolDefinition>['execute'];

/**
 Original update details retain the SDK tool's own declared detail shape.
 */
export type OriginalBashDetails = ReturnType<OriginalBashExecute> extends Promise<AgentToolResult<infer TDetails>>
  ? TDetails
  : never;

/**
 Update details carried by the fixture phase probe marker and by the
 forwarded original bash results.
 */
export type FixtureBashDetails = OriginalBashDetails | Readonly<{ phaseProbe?: boolean }>;

/**
 Wrapper execute signature dictated by the SDK tool interface, declaring the
 fixture's update details while forwarding original identities and arguments.
 */
export type FixtureBashExecute = ToolDefinition<
  ReturnType<typeof createBashToolDefinition>['parameters'],
  FixtureBashDetails
>['execute'];

/**
 Wrapped bash tool declared at the SDK `defineTool` erasure boundary.

 The base is the genuine `defineTool` return intersection, so `parameters` and
 the renderer members keep the SDK's erasure while `execute` and
 `prepareArguments` carry the fixture's own signatures. `prepareArguments` keeps
 the original normalizer's actual `unknown` result: the original returns the
 unvalidated input when its command member is not text, and the SDK's later
 schema validation rejects it exactly as before (`invalid` mode relies on
 that). The erased value is registered directly in `customTools`; renderers and
 the forwarded execute identity stay the originals.
 */
export type FixtureBashTool = Omit<ReturnType<typeof defineTool>, 'execute' | 'prepareArguments'> & Readonly<{
  execute: FixtureBashExecute;
  prepareArguments: (input: unknown) => unknown;
}>;

/**
 Dispose guard reproducing the original execute return accounting.
 */
export type PhaseExecutionReturnGuard = {
  [Symbol.dispose]: () => void;
};

//endregion
