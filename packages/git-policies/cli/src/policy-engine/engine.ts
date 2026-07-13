/**
 * First stable-pass policy engine slice. @module
 */
import * as v from 'valibot';
import {
  ABSENT_GIT_VALUE,
  type LazyPolicyGitFacts,
} from '../api/context-types.ts';
import type {
  PolicyContext,
  PolicyTrigger,
} from '../api/policy-types.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { BUILT_IN_POLICIES, } from './built-ins.ts';
import { parsePolicyControls, } from './controls.ts';
import {
  createEngineFailureEvent,
  type PolicyEvent,
} from './events.ts';
import { applyFixedTransforms, } from './fixed-transforms.ts';
import { runPolicyStage, } from './policy-stage.ts';
import type {
  PolicyEngineResult,
  RunPolicyEngineOptions,
  RuntimePolicyDefinition,
} from './types.ts';

/**
 * Empty lazy Git facts for command-only built-ins in first slice.
 */
const EMPTY_LAZY_GIT_FACTS: LazyPolicyGitFacts = {
  candidates: function candidates() { return Promise.resolve([],); },
  headOid: function headOid() { return Promise.resolve(ABSENT_GIT_VALUE,); },
  landedCommitOid: function landedCommitOid() { return Promise.resolve(ABSENT_GIT_VALUE,); },
  pushUpdates: function pushUpdates() { return Promise.resolve([],); },
};
/**
 * Built-in-only configuration schema for this slice.
 */
const ENGINE_CONFIG_SCHEMA = v.looseObject({
  policies: v.optional(
    v.record(
      v.string(),
      v.picklist([
        'off',
        'warn',
        'error',
      ] as const,),
    ),
    {}
  ),
},);

/**
 * Creates current command policy context with lazy facts for this candidate version.
 *
 * @param rawArgs - exact wrapper arguments
 *
 * @param transformedArgs - wrapper controls removed before real Git
 *
 * @param escapedPolicyIds - invocation-wide skipped policy identifiers
 *
 * @param trigger - active lifecycle point
 *
 * @param gitFacts - lifecycle-specific lazy Git facts
 *
 * @param repositoryRoot - canonical repository root override
 *
 * @returns initial candidate-state context
 */
function createPolicyContext({
  rawArgs,
  transformedArgs,
  escapedPolicyIds,
  trigger,
  gitFacts,
  candidateVersion,
  repositoryRoot,
}: Readonly<{
  rawArgs: readonly string[];
  transformedArgs: readonly string[];
  escapedPolicyIds: ReadonlySet<string>;
  trigger: PolicyTrigger;
  gitFacts: LazyPolicyGitFacts;
  candidateVersion: number;
  repositoryRoot?: string;
}>,): PolicyContext {
  /**
   * Parsed command location and effective directory.
   */
  const {
    effectiveCwd,
    subcommandIndex,
  } = parseGlobalOptions(transformedArgs,);
  /**
   * Subcommand or explicit absence sentinel.
   */
  const subcommand = transformedArgs[subcommandIndex] ?? ABSENT_GIT_VALUE;
  return {
    candidateVersion,
    trigger,
    command: {
      rawArgs,
      transformedArgs,
      subcommand,
      effectiveCwd,
      repositoryRoot: repositoryRoot ?? effectiveCwd,
      escapedPolicyIds,
    },
    git: gitFacts,
    signal: new AbortController().signal,
  };
}

/**
 * Runs configured built-ins and buffers only settled pass events.
 *
 * @param args - exact wrapper arguments
 *
 * @param trigger - lifecycle point being checked
 *
 * @param transformedArgs - final command facts for later lifecycle stages
 *
 * @param gitFacts - lifecycle-specific lazy Git facts
 *
 * @param repositoryRoot - canonical repository root override
 *
 * @param config - persistent built-in settings
 *
 * @param selectedPolicyIds - direct-check filter
 *
 * @param registeredPolicies - internal deterministic registry adapter
 *
 * @param policyOptions - runtime-validated outputs by effective policy ID
 *
 * @returns policy decision and forwardable arguments
 *
 * @example
 * ```ts
 * await runPolicyEngine({ args: ['status'], trigger: 'pre-forward' });
 * ```
 */
export async function runPolicyEngine({
  args,
  trigger,
  transformedArgs,
  gitFacts = EMPTY_LAZY_GIT_FACTS,
  candidateVersion = 0,
  repositoryRoot,
  config = {},
  selectedPolicyIds,
  registeredPolicies = BUILT_IN_POLICIES,
  policyOptions = new Map(),
}: RunPolicyEngineOptions,): Promise<PolicyEngineResult> {
  /**
   * Wrapper controls and real-Git arguments.
   */
  const controls = parsePolicyControls({
    args,
    registeredPolicies,
  },);
  /**
   * Final transformed state supplied by later lifecycle or control-clean raw state.
   */
  const initialTransformedArgs = transformedArgs ?? controls.args;
  /**
   * Runtime-authoritative built-in configuration parse.
   */
  const parsedConfig = v.safeParse(
    ENGINE_CONFIG_SCHEMA,
    config,
  );
  if (!parsedConfig.success) {
    return {
      args: initialTransformedArgs,
      escapedPolicyIds: controls.escapedPolicyIds,
      events: [createEngineFailureEvent({
        sequence: 0,
        code: 'config-invalid',
        message: 'Built-in policy configuration is invalid.',
      },),],
      patches: [],
      exitCode: 2,
      shouldForward: false,
    };
  }

  /**
   * Every policy ID supported by current built-in registry.
   */
  const knownIds = new Set(registeredPolicies.map(function policyId(policy,) {
    return policy.name;
  },),);
  /**
   * IDs named by persistent configuration.
   */
  const configuredIds = Object.keys(parsedConfig.output
    .policies,);
  /**
   * IDs named by direct-check filter.
   */
  const selectedIds = selectedPolicyIds ?? [];
  /**
   * First ID outside built-in registry.
   */
  const unknownId = [
    ...configuredIds,
    ...selectedIds,
  ].find(function isUnknown(policyId,) {
    return !knownIds.has(policyId,);
  },);
  if (unknownId !== undefined) {
    return {
      args: initialTransformedArgs,
      escapedPolicyIds: controls.escapedPolicyIds,
      events: [createEngineFailureEvent({
        sequence: 0,
        code: 'config-invalid',
        message: `Unknown built-in policy ID: ${unknownId}`,
      },),],
      patches: [],
      exitCode: 2,
      shouldForward: false,
    };
  }

  /**
   * Direct-check filter optimized for sequential lookup.
   */
  const selectedSet = new Set(selectedIds,);
  /**
   * Canonical built-in IDs separating trusted plugins from fixed core.
   */
  const builtInIds = new Set(BUILT_IN_POLICIES.map(function builtInId(policy,) {
    return policy.name;
  },),);
  /**
   * Configurable built-ins retained in canonical registry order.
   */
  const builtInPolicies = registeredPolicies.filter(function isBuiltIn(policy,) {
    return builtInIds.has(policy.name,);
  },);
  /**
   * Trusted plugin policies retained after fixed transforms.
   */
  const pluginPolicies = registeredPolicies.filter(function isPlugin(policy,) {
    return !builtInIds.has(policy.name,);
  },);
  /**
   * Built-ins inspect control-clean raw semantic facts before transforms.
   */
  const builtInStage = await runPolicyStage({
    policies: builtInPolicies,
    context: createPolicyContext({
      rawArgs: args,
      transformedArgs: controls.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      trigger,
      gitFacts,
      candidateVersion,
      ...(repositoryRoot === undefined ? {} : { repositoryRoot, }),
    },),
    trigger,
    severities: parsedConfig.output
      .policies,
    selectedPolicyIds: selectedSet,
    escapedPolicyIds: controls.escapedPolicyIds,
    policyOptions,
    keepGoing: controls.keepGoing,
    sequence: 0,
  },);
  if ((!builtInStage.complete) || builtInStage.stopped
    || builtInStage.patchProposed) {
    return {
      args: initialTransformedArgs,
      escapedPolicyIds: controls.escapedPolicyIds,
      events: builtInStage.events,
      patches: builtInStage.patches,
      exitCode: builtInStage.complete ? 1 : 2,
      shouldForward: false,
    };
  }
  /**
   * Fixed transforms run only at forwarded command lifecycle point.
   */
  const fixedStage = trigger === 'pre-forward'
    ? await applyFixedTransforms({
      args: initialTransformedArgs,
      rawArgs: args,
      sequence: builtInStage.events
        .length,
    },)
    : {
      args: initialTransformedArgs,
      events: [],
      complete: true,
    };
  /**
   * Events settled before trusted plugins execute.
   */
  const stagedEvents: readonly PolicyEvent[] = [
    ...builtInStage.events,
    ...fixedStage.events,
  ];
  /**
   * Whether fixed core produced expected blocking rejection.
   */
  const coreBlocked = fixedStage.events
    .some(function isCoreFinding(event,) {
    return event.type === 'core-finding';
  },);
  if ((!fixedStage.complete) || (coreBlocked && (!controls.keepGoing))) {
    return {
      args: fixedStage.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      events: stagedEvents,
      patches: builtInStage.patches,
      exitCode: fixedStage.complete ? 1 : 2,
      shouldForward: false,
    };
  }
  /**
   * Plugins inspect exact raw input and fixed transformed command facts.
   */
  const pluginStage = await runPolicyStage({
    policies: pluginPolicies,
    context: createPolicyContext({
      rawArgs: args,
      transformedArgs: fixedStage.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      trigger,
      gitFacts,
      candidateVersion,
      ...(repositoryRoot === undefined ? {} : { repositoryRoot, }),
    },),
    trigger,
    severities: parsedConfig.output
      .policies,
    selectedPolicyIds: selectedSet,
    escapedPolicyIds: controls.escapedPolicyIds,
    policyOptions,
    keepGoing: controls.keepGoing,
    sequence: stagedEvents.length,
  },);
  /**
   * Complete ordered invocation events.
   */
  const events: readonly PolicyEvent[] = [
    ...stagedEvents,
    ...pluginStage.events,
  ];
  if (!pluginStage.complete) {
    return {
      args: fixedStage.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      events,
      patches: [
        ...builtInStage.patches,
        ...pluginStage.patches,
      ],
      exitCode: 2,
      shouldForward: false,
    };
  }
  /**
   * Whether stable pass contains any blocking policy or core finding.
   */
  const hasError = events.some(function isBlockingEvent(event,) {
    return (event.type === 'core-finding')
      || ((event.type === 'finding') && (event.severity === 'error'));
  },);
  /**
   * Whether provisional pass requires candidate mutation before forwarding.
   */
  const hasPatchProposal = pluginStage.patches
    .length
    > 0;
  return {
    args: fixedStage.args,
    escapedPolicyIds: controls.escapedPolicyIds,
    events,
    patches: [
      ...builtInStage.patches,
      ...pluginStage.patches,
    ],
    exitCode: (hasError || hasPatchProposal) ? 1 : 0,
    shouldForward: (!hasError) && (!hasPatchProposal),
  };
}
