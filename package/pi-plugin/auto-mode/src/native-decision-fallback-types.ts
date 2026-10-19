/**
 Shared contracts for the native decision fallback catalog.

 Fixture state, harness boundaries, and summary shapes stay typed here so every
 sibling module names the same roles without importing implementation graphs. @module
 */
import type {
  AgentSession,
  ExtensionAPI,
  ExtensionContext,
  ExtensionUIContext
} from '@earendil-works/pi-coding-agent';
import type { createAssessmentSender } from './assessment-sender.ts';
import type { askUser } from './ask-user.ts';
import type { SemanticAdmissionPolicy } from './semantic-admission-types.ts';

//region Named catalog modes keep every strict branch addressable.

/**
 Named fixture modes each drive one decision fallback branch.
 */
export type DecisionFallbackMode =
  | 'approve'
  | 'deny'
  | 'transient'
  | 'transient-deny'
  | 'unavailable'
  | 'unavailable-deny'
  | 'unknown'
  | 'low'
  | 'transport'
  | 'malformed'
  | 'initial-failure'
  | 'stop'
  | 'cancel'
  | 'headless'
  | 'stale'
  | 'abort'
  | 'prohibition'
  | 'deadline'
  | 'fresh'
  | 'allow-stale'
  | 'allow-abort';

/**
 Parsed mode plus its clause-deny and startup-failure prefixes.
 */
export type DecisionFallbackRequestedMode =
  | DecisionFallbackMode
  | `clause-deny-${DecisionFallbackMode}`
  | `startup-failure-${DecisionFallbackMode}`;

/**
 Unresolved clause relation sent to the clause question.
 */
export type DecisionFallbackRelation =
  | 'prohibition'
  | 'fresh-session-approval'
  | 'prerequisite';

/**
 Authored whole-operation answer choice.
 */
export type DecisionFallbackOperationDecision = 'approve' | 'deny' | 'unknown';

/**
 Mode facts derived once so each strict branch reads one shared expectation.
 */
export type DecisionFallbackPlan = Readonly<{
  requestedMode: string;
  mode: DecisionFallbackMode;
  clauseDenial: boolean;
  startupFailure: boolean;
  transient: boolean;
  operationDecision: DecisionFallbackOperationDecision;
  relation: DecisionFallbackRelation;
  allowed: boolean;
  manualReview: boolean;
  expectedAttempts: number;
}>;

//endregion

//region Mutable fixture counters and state stay owned by the running catalog.

/**
 Counters recorded by fixture callbacks and asserted exactly at the end.
 */
export type DecisionFallbackObservations = {
  assessments: number;
  httpCalls: number;
  attempts: number;
  selections: number;
  executions: number;
  updates: number;
};

/**
 Live fixture state shared by transport, host, and operation callbacks.

 Captured SDK capability and abort retention stay optional properties so
 absence is established before use instead of travelling as a nullish union.
 */
export type DecisionFallbackState = {
  pi?: ExtensionAPI;
  abortTask?: Promise<void>;
  ordinaryChatPending: boolean;
  requestCount: number;
  clockOffset: number;
};

/**
 Terminal summary keeps the original printed field set and order.
 */
export type DecisionFallbackSummary = Readonly<{
  complete: true;
  mode: string;
  assessments: number;
  httpCalls: number;
  attempts: number;
  selections: number;
  executions: number;
  updates: number;
  reconstructableDecisionLogs: true;
}>;

//endregion

//region Harness slots stay forwarded without claiming opaque shapes.

/**
 Forwarded native slot accepting no fixture-interpreted arguments.
 */
export type ForwardedNativeSlot = (...args: never[]) => unknown;

/**
 Maintained assessment transport reused by the fixture wire sender.
 */
export type AssessmentTransport = ReturnType<typeof createAssessmentSender>;

/**
 Input the maintained sender accepts for one authored decision request.
 */
export type AssessmentSendInput = Parameters<AssessmentTransport>[0];

/**
 Session options forwarded from the built environment to the owned factory.
 */
export type HarnessSessionOptions = Readonly<Record<string, unknown>> & Readonly<{
  cwd: string;
}>;

/**
 Original root pair returned by the owned session factory.
 */
export type HarnessRoot = Readonly<{
  session: AgentSession;
  manager: object;
}>;

/**
 Owned construction result carrying the original session and lifecycle.
 */
export type HarnessRootResult = Readonly<{
  session: AgentSession;
  root: HarnessRoot;
  lifecycle: unknown;
}>;

/**
 Built environment surface consumed by the fixture session and disposal.
 */
export type HarnessEnvironment = Readonly<{
  packageRoot: string;
  createAgentSession: ForwardedNativeSlot;
  SessionManager: ForwardedNativeSlot;
  readActiveSessionManager: ForwardedNativeSlot;
  readRootOccurrence: ForwardedNativeSlot;
  readSessionDisposalState: ForwardedNativeSlot;
  wrapToolDefinition: ForwardedNativeSlot;
  parser: Readonly<{ parse: ForwardedNativeSlot }>;
  policyInput: unknown;
  options: HarnessSessionOptions;
  drain: () => Promise<void>;
}>;

/**
 Extension factory receiving the original SDK extension surface.
 */
export type FixtureExtensionFactory = (pi: ExtensionAPI) => void;

/**
 Startup relevance factory shape forwarded into the built environment.
 */
export type FixtureRelevanceFactory = (input: Readonly<{
  root: string;
  parse: ForwardedNativeSlot;
}>) => unknown;

/**
 Environment construction input selecting fixture policy and provider paths.
 */
export type FixtureEnvironmentInput = Readonly<{
  policyText: string;
  useNativeProvider: boolean;
  extensionFactories: readonly FixtureExtensionFactory[];
  createRelevance?: FixtureRelevanceFactory;
}>;

//endregion

//region Approval host and runtime input keep real SDK callback identities.

/**
 Host context surface askUser actually drives during fixture confirmation.
 */
export type DecisionFallbackHostContext =
  & Readonly<Pick<ExtensionContext, 'hasUI' | 'abort'>>
  & Readonly<{ ui: Pick<ExtensionUIContext, 'select'> }>;

/**
 Receipt shape returned by the fixture notification runner.
 */
export type DecisionFallbackNotificationReceipt = Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
}>;

/**
 Approval host assembled from the original SDK callback and maintained requester.
 */
export type DecisionFallbackApprovalHost = Readonly<{
  pi: ExtensionAPI;
  ctx: DecisionFallbackHostContext;
  askUser: typeof askUser;
  verdictEntryType: string;
  trace: (event: string) => void;
  notificationInvoker: () => Promise<DecisionFallbackNotificationReceipt>;
}>;

/**
 Policy runtime input supplying the owned session and fixed fixture transports.
 */
export type DecisionFallbackRuntimeInput = Readonly<{
  root: HarnessRoot;
  lifecycle: unknown;
  policyInput: unknown;
  rootDirectory: string;
  parsePolicy: ForwardedNativeSlot;
  files: readonly unknown[];
  wrapToolDefinition: ForwardedNativeSlot;
  readSessionDisposalState: ForwardedNativeSlot;
  trace: (event: string) => void;
  now: () => number;
  approvalHost: () => DecisionFallbackApprovalHost;
  sendWire: AssessmentTransport;
  terminalFetch: typeof fetch;
  semanticAdmissionPolicy?: SemanticAdmissionPolicy;
  headingContextAdmissionPolicy?: SemanticAdmissionPolicy;
  unitAdoptionAdmissionPolicy?: SemanticAdmissionPolicy;
}>;

//endregion

//region Catalog pieces keep one role each across the run and its disposal.

/**
 Session fixture carrying the built environment with its original session.
 */
export type DecisionFallbackSessionFixture = Readonly<{
  environment: HarnessEnvironment;
  session: AgentSession;
  root: HarnessRoot;
  lifecycle: unknown;
}>;

/**
 Operation fixture owning the proposed commands and terminal stream replies.
 */
export type DecisionFallbackOperation = Readonly<{
  commands: readonly string[];
  terminalFetch: () => Promise<Response>;
}>;

/**
 Disposal owner reproducing the original cleanup order at scope exit.
 */
export type DecisionFallbackDisposal = {
  [Symbol.asyncDispose]: () => Promise<void>;
};
