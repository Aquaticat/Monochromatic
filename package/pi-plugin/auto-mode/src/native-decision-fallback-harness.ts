/**
 Built harness bindings for the native decision fallback catalog.

 Untyped built modules load through their real URLs and narrow through consumer
 contracts, keeping artifact implementations outside this project's file list. @module
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { createBashToolDefinition } from '@earendil-works/pi-coding-agent';
import type { createAssessmentSender } from './assessment-sender.ts';
import type { askUser } from './ask-user.ts';
import type { createNativeSemanticOperatingPolicies } from './semantic-operating-policy.ts';
import type {
  DecisionFallbackOperationDecision,
  DecisionFallbackRelation,
  DecisionFallbackRuntimeInput,
  FixtureEnvironmentInput,
  FixtureRelevanceFactory,
  HarnessEnvironment,
  HarnessRootResult,
  HarnessSessionOptions
} from './native-decision-fallback-types.ts';

//region Consumer contracts describe only the fixture-consumed module surface.

/**
 Built environment factory forwarding fixture policy and provider selections.
 */
type EnvironmentModule = Readonly<{
  createEnvironment: (input: FixtureEnvironmentInput) => Promise<HarnessEnvironment>;
}>;

/**
 Owned session factory consuming the built environment definition.
 */
type RootSessionModule = Readonly<{
  createRootSessionFactory: (definition: HarnessEnvironment) => Readonly<{
    create: (input: Readonly<{ options: HarnessSessionOptions }>) => Promise<HarnessRootResult>;
  }>;
}>;

/**
 Policy runtime binding accepting the fixture's fixed transports and host.
 */
type PolicyRuntimeModule = Readonly<{
  bindNativePolicyRuntime: (input: DecisionFallbackRuntimeInput) => Readonly<{
    detach: () => void;
  }>;
}>;

/**
 Maintained bridge exports used before fixture HOME changes.
 */
type MaintainedPolicyModule = Readonly<{
  createNativeSemanticOperatingPolicies: typeof createNativeSemanticOperatingPolicies;
  maintainedPolicyEntry: string;
}>;

/**
 Release-bound entries retaining the original requester identity.
 */
export type MaintainedPolicyEntries = Readonly<{
  askUser: typeof askUser;
  VERDICT_ENTRY_TYPE: string;
}>;

/**
 Authored relation answers retain original request bytes and HTTP controls.
 */
export type AssessmentFixtureSettings = Readonly<{
  relation: string;
  unresolvedClause: DecisionFallbackRelation;
  operationDecision: DecisionFallbackOperationDecision;
  operatingPolicy: boolean;
  httpTransport: boolean;
  transientHttpFailure: 'none' | 'request' | 'unavailable';
}>;

/**
 Assessment fixture counters shared with the catalog observations.
 */
export type AssessmentFixtureObservations = {
  assessments: number;
  httpCalls: number;
};

/**
 Assessment fixture factory producing the maintained transport path.
 */
type AssessmentFixtureModule = Readonly<{
  createDomainFixtureAssessment: (input: Readonly<{
    settings: AssessmentFixtureSettings;
    observations: AssessmentFixtureObservations;
  }>) => ReturnType<typeof createAssessmentSender>;
}>;

/**
 Startup classification factory forwarded into the built environment.
 */
type RelevanceModule = Readonly<{
  createStartupRelevance: FixtureRelevanceFactory;
}>;

/**
 Installed SDK bash tool builder loaded from the same package's own artifact.
 */
type BashToolModule = Readonly<{
  createBashToolDefinition: typeof createBashToolDefinition;
}>;

//endregion

//region Narrowing guards verify the built exports before fixture use.

/**
 Check the built environment export before fixture construction.

 @param value - built environment module namespace

 @returns narrowed environment contract for fixture construction

 @throws Error when the environment factory is absent
 */
function assertEnvironmentModule(value: unknown): asserts value is EnvironmentModule {
  if (((typeof value) !== 'object') || (value === null)
    || (!('createEnvironment' in value))
    || ((typeof value.createEnvironment) !== 'function'))
    throw new Error('Built native batch environment factory is unavailable');
}

/**
 Check the owned session factory export before fixture construction.

 @param value - built session-root module namespace

 @returns narrowed owned factory contract for fixture construction

 @throws Error when the session factory is absent
 */
function assertRootSessionModule(value: unknown): asserts value is RootSessionModule {
  if (((typeof value) !== 'object') || (value === null)
    || (!('createRootSessionFactory' in value))
    || ((typeof value.createRootSessionFactory) !== 'function'))
    throw new Error('Built native session root factory is unavailable');
}

/**
 Check the policy runtime export before hook installation.

 @param value - built policy runtime module namespace

 @returns narrowed runtime binder contract for hook installation

 @throws Error when the runtime binder is absent
 */
function assertPolicyRuntimeModule(value: unknown): asserts value is PolicyRuntimeModule {
  if (((typeof value) !== 'object') || (value === null)
    || (!('bindNativePolicyRuntime' in value))
    || ((typeof value.bindNativePolicyRuntime) !== 'function'))
    throw new Error('Built native policy runtime binder is unavailable');
}

/**
 Check the maintained bridge export before fixture HOME changes.

 @param value - maintained policy bridge namespace

 @returns narrowed maintained bridge contract for policy construction

 @throws Error when policy construction or the maintained entry is absent
 */
function assertMaintainedPolicyModule(value: unknown): asserts value is MaintainedPolicyModule {
  if (((typeof value) !== 'object') || (value === null)
    || (!('createNativeSemanticOperatingPolicies' in value))
    || ((typeof value.createNativeSemanticOperatingPolicies) !== 'function')
    || (!('maintainedPolicyEntry' in value))
    || ((typeof value.maintainedPolicyEntry) !== 'string'))
    throw new Error('Maintained policy bridge exports are unavailable');
}

/**
 Check the release-bound policy entries before the approval host assembles.

 @param value - maintained policy entry module namespace

 @returns narrowed release-bound entry contract for the approval host

 @throws Error when the requester identity or verdict discriminator is absent
 */
function assertMaintainedPolicyEntries(value: unknown): asserts value is MaintainedPolicyEntries {
  if (((typeof value) !== 'object') || (value === null)
    || (!('askUser' in value))
    || ((typeof value.askUser) !== 'function')
    || (!('VERDICT_ENTRY_TYPE' in value))
    || ((typeof value.VERDICT_ENTRY_TYPE) !== 'string'))
    throw new Error('Maintained policy entry exports are unavailable');
}

/**
 Check the authored assessment fixture export before transport binding.

 @param value - built assessment fixture module namespace

 @returns narrowed assessment fixture contract for the wire sender

 @throws Error when the assessment fixture factory is absent
 */
function assertAssessmentFixtureModule(value: unknown): asserts value is AssessmentFixtureModule {
  if (((typeof value) !== 'object') || (value === null)
    || (!('createDomainFixtureAssessment' in value))
    || ((typeof value.createDomainFixtureAssessment) !== 'function'))
    throw new Error('Built domain fixture assessment factory is unavailable');
}

/**
 Check the startup relevance export before startup-failure selection.

 @param value - built startup relevance module namespace

 @returns narrowed relevance contract for startup-failure selection

 @throws Error when the relevance factory is absent
 */
function assertRelevanceModule(value: unknown): asserts value is RelevanceModule {
  if (((typeof value) !== 'object') || (value === null)
    || (!('createStartupRelevance' in value))
    || ((typeof value.createStartupRelevance) !== 'function'))
    throw new Error('Built startup relevance factory is unavailable');
}

/**
 Check the installed SDK bash tool export before wrapper construction.

 @param value - installed SDK bash tool module namespace

 @returns narrowed bash tool builder contract for wrapper construction

 @throws Error when the bash tool builder is absent
 */
function assertBashToolModule(value: unknown): asserts value is BashToolModule {
  if (((typeof value) !== 'object') || (value === null)
    || (!('createBashToolDefinition' in value))
    || ((typeof value.createBashToolDefinition) !== 'function'))
    throw new Error('Installed SDK bash tool builder is unavailable');
}

//endregion

//region Built modules load once in the original static import order.

/**
 Built environment module supplying isolated fixture construction.
 */
const loadedEnvironment: unknown = await import(new URL(
  '../dist/native/contract/integration/native-batch/environment.mjs',
  import.meta.url
).href);
assertEnvironmentModule(loadedEnvironment);
/**
 Environment factory retained for the fixture session owner.
 */
export const environmentHarness: EnvironmentModule = loadedEnvironment;

/**
 Built session-root module owning original construction registration.
 */
const loadedRootSession: unknown = await import(new URL(
  '../dist/native/contract/integration/native-batch/session-root.ts',
  import.meta.url
).href);
assertRootSessionModule(loadedRootSession);
/**
 Owned session factory retained for the fixture session owner.
 */
export const rootSessionHarness: RootSessionModule = loadedRootSession;

/**
 Built policy runtime module binding judgment and approval owners.
 */
const loadedPolicyRuntime: unknown = await import(new URL(
  '../dist/native/contract/integration/native-batch/runtime.mjs',
  import.meta.url
).href);
assertPolicyRuntimeModule(loadedPolicyRuntime);
/**
 Policy runtime binder retained for the fixture catalog runner.
 */
export const policyRuntimeHarness: PolicyRuntimeModule = loadedPolicyRuntime;

/**
 Maintained policy bridge exporting construction and the release entry.
 */
const loadedMaintainedPolicy: unknown = await import(new URL(
  '../dist/native/contract/integration/maintained-policy.mjs',
  import.meta.url
).href);
assertMaintainedPolicyModule(loadedMaintainedPolicy);
/**
 Maintained policy bridge retained for policies and entry selection.
 */
export const maintainedPolicyHarness: MaintainedPolicyModule = loadedMaintainedPolicy;

/**
 Built assessment fixture module authoring relation answers.
 */
const loadedAssessmentFixture: unknown = await import(new URL(
  '../dist/native/contract/integration/native-batch/domain-fixture-assessment.mjs',
  import.meta.url
).href);
assertAssessmentFixtureModule(loadedAssessmentFixture);
/**
 Assessment fixture factory retained for the fixture wire sender.
 */
export const assessmentFixtureHarness: AssessmentFixtureModule = loadedAssessmentFixture;

/**
 Built startup relevance module used only by startup-failure modes.
 */
const loadedRelevance: unknown = await import(new URL(
  '../dist/native/contract/integration/native-host/startup-relevance.mjs',
  import.meta.url
).href);
assertRelevanceModule(loadedRelevance);
/**
 Startup relevance factory retained for startup-failure environment selection.
 */
export const relevanceHarness: RelevanceModule = loadedRelevance;

//endregion

//region Deferred loads keep release entry and SDK artifact timing exact.

/**
 Load the release-bound policy entries before fixture HOME changes.

 @returns original requester identity and verdict discriminator

 @example
 ```ts
 const maintained = await loadMaintainedPolicyEntries();
 ```

 @throws Error when the maintained entry omits its exports
 */
export async function loadMaintainedPolicyEntries(): Promise<MaintainedPolicyEntries> {
  /**
   Release-bound entry URL is read before fixture HOME changes.
   */
  const entryUrl = maintainedPolicyHarness.maintainedPolicyEntry;
  /**
   Loaded entries stay unknown until their export guard narrows them.
   */
  const loaded: unknown = await import(entryUrl);
  assertMaintainedPolicyEntries(loaded);
  return loaded;
}

/**
 Load the installed SDK bash tool builder from its own package artifact.

 @param packageRoot - installed SDK package root owning the artifact

 @returns bash tool builder with its original execute identity

 @example
 ```ts
 const bashModule = await loadBashToolModule({ packageRoot });
 ```

 @throws Error when the installed artifact omits its export
 */
export async function loadBashToolModule({ packageRoot }: Readonly<{
  packageRoot: string;
}>): Promise<BashToolModule> {
  /**
   Artifact path stays inside the installed SDK package root.
   */
  const artifactPath = join(
    packageRoot,
    'dist/core/tools/bash.js'
  );
  /**
   File URL keeps the import on the installed artifact's own identity.
   */
  const artifactUrl = pathToFileURL(artifactPath)
    .href;
  /**
   Loaded module stays unknown until its export guard narrows it.
   */
  const loaded: unknown = await import(artifactUrl);
  assertBashToolModule(loaded);
  return loaded;
}

//endregion
